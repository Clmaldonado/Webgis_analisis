const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const FORM_ID = 'aPk24s6jb5BSdEJRnPqpW7'; // ID del formulario
const API_URL = `https://kf.kobotoolbox.org/api/v2/assets/${FORM_ID}/data/`;
const SECRET_KEY = process.env.SECRET_KEY || 'clave_super_secreta'; // Cambia esto en producción

// Middleware para habilitar CORS
app.use(cors());
app.use(express.json());

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// Simulación de usuarios registrados
const users = [
    {
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10), // Contraseña "admin123" hasheada
    },
];

// Middleware de autenticación
const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(403).send('Token requerido');
    }
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).send('Token inválido');
        }
        req.user = user;
        next();
    });
};

// Rutas de autenticación
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Usuario y contraseña son requeridos');
    }

    // Verifica si el usuario ya existe
    if (users.some((user) => user.username === username)) {
        return res.status(400).send('El usuario ya existe');
    }

    // Hashea la contraseña y guarda el usuario
    const hashedPassword = await bcrypt.hash(password, 10);
    users.push({ username, password: hashedPassword });
    res.status(201).send('Usuario registrado con éxito');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = users.find((u) => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send('Credenciales inválidas');
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
});

// Ruta protegida para eliminar reportes
app.delete('/api/reports/:id', authenticateJWT, async (req, res) => {
    const reportId = req.params.id;

    try {
        const response = await axios.delete(`${API_URL}${reportId}/`, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`,
            },
        });
        res.status(response.status).send({ message: `Reporte con ID ${reportId} eliminado.` });
    } catch (error) {
        console.error(`Error al eliminar en KoboToolbox:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).send({
            error: `Error al eliminar el reporte con ID ${reportId}.`,
            details: error.response?.data,
        });
    }
});

// Ruta principal para servir el archivo HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Webgis.html'));
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
