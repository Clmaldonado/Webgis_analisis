const express = require('express');
const axios = require('axios'); // Usar Axios para solicitudes HTTP
const cors = require('cors'); // Middleware para habilitar CORS
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = 'https://kf.kobotoolbox.org/api/v2/assets/aPk24s6jb5BSdEJRnPqpW7/data/';

// Middleware para habilitar CORS y JSON
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos temporal en memoria
let database = [];
let resolvedReports = [];

// Ruta para cargar datos desde KoboToolbox y almacenarlos en memoria
app.get('/api', async (req, res) => {
    try {
        const response = await axios.get(API_URL, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`, // Token API de KoboToolbox
            },
        });

        // Procesar y guardar en la base de datos temporal
        database = response.data.results.map(report => ({
            id: report._id.toString(),
            report_name: report.report_name || "Sin nombre",
            email: report.email || "Sin correo",
            location: report.location || "Sin ubicación",
            issue_type: report.issue_type || "No especificado",
            urgency_level: report.urgency_level || "No especificado",
            detection_date: report.detection_date || "Sin fecha",
            issue_description: report.issue_description || "No disponible",
            photo_evidence: report._attachments?.[0]?.download_medium_url || null,
            resolved: false, // Inicialmente sin resolver
        }));

        res.status(200).json({ count: database.length, results: database });
    } catch (error) {
        console.error('Error al cargar datos desde KoboToolbox:', error.message);
        res.status(500).send('Error al cargar datos desde KoboToolbox.');
    }
});

// Ruta para marcar un reporte como resuelto
app.post('/api/reports/:id/resolve', (req, res) => {
    const { id } = req.params;

    // Buscar el reporte en la base de datos temporal
    const reportIndex = database.findIndex(r => r.id === id);
    if (reportIndex === -1) {
        return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    // Marcar como resuelto
    const report = database.splice(reportIndex, 1)[0];
    report.resolved = true;
    resolvedReports.push(report);

    res.status(200).json({ message: `Reporte con ID ${id} marcado como resuelto.`, report });
});

// Ruta para obtener los reportes resueltos
app.get('/api/reports/resolved', (req, res) => {
    res.status(200).json({ count: resolvedReports.length, results: resolvedReports });
});

// Ruta para eliminar un reporte
app.delete('/api/reports/:id', (req, res) => {
    const { id } = req.params;

    // Buscar en la base de datos temporal
    const dbIndex = database.findIndex(r => r.id === id);
    const resolvedIndex = resolvedReports.findIndex(r => r.id === id);

    if (dbIndex !== -1) {
        database.splice(dbIndex, 1);
        return res.status(200).json({ message: `Reporte con ID ${id} eliminado.` });
    }

    if (resolvedIndex !== -1) {
        resolvedReports.splice(resolvedIndex, 1);
        return res.status(200).json({ message: `Reporte con ID ${id} eliminado de la lista de resueltos.` });
    }

    res.status(404).json({ error: 'Reporte no encontrado.' });
});

// Ruta principal para servir `Webgis.html`
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Webgis.html'));
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
