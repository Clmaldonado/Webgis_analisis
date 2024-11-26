const express = require('express');
const cors = require('cors'); // Importar CORS
const request = require('axios'); // Usando Axios en lugar de Request
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

// Endpoint para resolver un reporte
app.put('/api/reports/:id', (req, res) => {
    const { id } = req.params;

    console.log('ID recibido para resolver:', id);

    // Buscar el reporte en `database`
    const reportIndex = database.findIndex(report => report.id === id);
    if (reportIndex === -1) {
        console.error('Reporte no encontrado');
        return res.status(404).send({ error: 'Reporte no encontrado' });
    }

    // Marcar el reporte como resuelto
    database[reportIndex].resolved = true;
    console.log('Reporte actualizado:', database[reportIndex]);

    res.status(200).send({ message: `Reporte con ID ${id} resuelto.`, report: database[reportIndex] });
});


// Ruta principal para servir `Webgis.html`
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Webgis.html'));
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
