const express = require('express');
const request = require('axios'); // Usando Axios en lugar de Request
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = 'https://kf.kobotoolbox.org/api/v2/assets/aPk24s6jb5BSdEJRnPqpW7/data/';

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Ruta para manejar la API
app.get('/api', async (req, res) => {
    try {
        const response = await request.get(API_URL, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`, // Usa variable de entorno para el token
            },
        });
        res.status(response.status).send(response.data);
    } catch (error) {
        console.error('Error al realizar la solicitud a la API:', error);
        res.status(500).send('Error al procesar los datos de la API.');
    }
});

// Ruta principal para servir `Webgis.html`
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Webgis.html'));
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
