const express = require('express');
const axios = require('axios');
const app = express();

const PORT = 3000;
const API_URL = 'https://kf.kobotoolbox.org/api/v2/assets/aPk24s6jb5BSdEJRnPqpW7/data/';

// Middleware para CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Permitir cualquier origen
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Ruta para manejar las solicitudes al proxy
app.get('/api', async (req, res) => {
    try {
        const response = await axios.get(API_URL, {
            headers: {
                Authorization: 'Token ffa135f8b667ddb65202f7b5209e6ebd881aa542',
                Accept: 'application/json',
            },
        });
        res.status(response.status).send(response.data);
    } catch (error) {
        console.error('Error al realizar la solicitud a la API:', error.message);
        res.status(500).send('Error al procesar los datos de la API.');
    }
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Proxy corriendo en http://localhost:${PORT}`);
});
