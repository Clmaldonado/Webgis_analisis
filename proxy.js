const express = require('express');
const axios = require('axios'); // Aquí asegúrate de usar 'axios' en lugar de 'request'
const cors = require('cors'); // Habilitar CORS
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = 'https://kf.kobotoolbox.org/api/v2/assets/aPk24s6jb5BSdEJRnPqpW7/data/';

// Middleware para habilitar CORS
app.use(cors()); // Permitir todas las solicitudes de todos los orígenes

// Middleware para manejar JSON
app.use(express.json());

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Ruta para manejar la API GET (obtener datos)
app.get('/api', async (req, res) => {
    try {
        const response = await axios.get(API_URL, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`, // Usa la variable de entorno para el token
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

// Base de datos temporal en memoria
let database = [];

// Endpoint para cargar datos desde KoboToolbox y almacenarlos en `database`
app.get('/api', async (req, res) => {
    try {
        const response = await request.get(API_URL, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`,
            },
        });

        database = response.data.results.map(report => ({
            id: report._id.toString(),
            report_name: report.report_name,
            email: report.email,
            location: report.location,
            issue_type: report.issue_type,
            urgency_level: report.urgency_level,
            detection_date: report.detection_date,
            issue_description: report.issue_description,
            photo_evidence: report._attachments?.[0]?.download_medium_url || null,
            resolved: false,
        }));

        res.status(200).send({ count: database.length, results: database });
    } catch (error) {
        console.error('Error al cargar datos de KoboToolbox:', error);
        res.status(500).send('Error al procesar los datos de KoboToolbox.');
    }
});

let resolvedReports = []; // Lista de reportes resueltos (almacenada en memoria por ahora)

// Ruta para manejar la acción de resolver un reporte
app.post('/api/reports/:id/resolve', (req, res) => {
    const { id } = req.params;

    // Busca el reporte en la base de datos simulada de KoboToolbox
    const report = database.find(r => r._id === id); // Ajusta `_id` según tus datos reales
    if (!report) {
        return res.status(404).send({ error: 'Reporte no encontrado' });
    }

    // Marca el reporte como resuelto
    report.resolved = true;

    // Mueve el reporte a la lista de reportes resueltos
    resolvedReports.push(report);

    // Responde con éxito
    res.status(200).send({ message: `Reporte con ID ${id} marcado como resuelto.` });
});

// Ruta principal para servir `Webgis.html`
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Webgis.html'));
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
