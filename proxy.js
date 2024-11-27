const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = 'https://kf.kobotoolbox.org/api/v2/assets/aPk24s6jb5BSdEJRnPqpW7/data/';

// Middleware para manejar JSON
app.use(express.json());

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Ruta para manejar la API GET (obtener datos)
app.get('/api', async (req, res) => {
    try {
        const response = await axios.get(API_URL, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`,
            },
        });
        res.status(response.status).send(response.data);
    } catch (error) {
        console.error('Error al realizar la solicitud a la API:', error);
        res.status(500).send('Error al procesar los datos de la API.');
    }
});

// Ruta para manejar la API DELETE (eliminar un reporte por ID)
app.delete('/api/reports/:id', async (req, res) => {
    const reportId = req.params.id;

    try {
        const response = await axios.delete(`${API_URL}${reportId}/`, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`,
            },
        });

        res.status(response.status).send({ message: `Reporte con ID ${reportId} eliminado.` });
    } catch (error) {
        console.error(`Error al eliminar el reporte con ID ${reportId}:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).send({
            error: `Error al eliminar el reporte con ID ${reportId}.`,
        });
    }
});

// Ruta para manejar la API PUT (resolver un reporte)
app.put('/api/reports/:id', async (req, res) => {
    const reportId = req.params.id;

    try {
        // Actualiza el reporte en KoboToolbox
        const response = await axios.patch(`${API_URL}${reportId}/`, { resolved: true }, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`,
            },
        });

        res.status(response.status).send({
            message: `Reporte con ID ${reportId} resuelto.`,
            data: response.data,
        });
    } catch (error) {
        console.error(`Error al resolver el reporte con ID ${reportId}:`, error.response?.data || error.message);
        res.status(error.response?.status || 500).send({
            error: `Error al resolver el reporte con ID ${reportId}.`,
        });
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
