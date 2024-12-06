const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // Importar el cliente de PostgreSQL

// Configurar conexión al pool de PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // SSL necesario en Render
});

// Ejemplo de prueba para verificar conexión
pool.connect()
    .then(() => console.log('Conexión exitosa a PostgreSQL'))
    .catch(err => console.error('Error de conexión a PostgreSQL:', err));

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = 'https://kf.kobotoolbox.org/api/v2/assets/aPk24s6jb5BSdEJRnPqpW7/data/';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Crear tabla si no existe al iniciar el servidor
async function createTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            reporter_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            location_description VARCHAR(255),
            gps_location VARCHAR(255),
            issue_type VARCHAR(100) NOT NULL,
            issue_description TEXT NOT NULL,
            urgency_level VARCHAR(50) NOT NULL,
            detection_date DATE NOT NULL,
            photo_evidence TEXT,
            additional_notes TEXT,
            resolved BOOLEAN DEFAULT FALSE
        );
    `;
    try {
        await pool.query(query);
        console.log('Tabla reports creada o ya existe.');
    } catch (error) {
        console.error('Error al crear la tabla:', error);
    }
}

// Ruta principal para servir `Webgis.html`
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Webgis.html'));
});

// Ruta para manejar la API GET (obtener datos de KoboToolbox)
app.get('/api', async (req, res) => {
    try {
        const response = await axios.get(API_URL, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`,
            },
        });

        const reports = response.data.results;

        for (const report of reports) {
            const query = `
                INSERT INTO reports (reporter_name, email, location_description, gps_location, issue_type, issue_description, urgency_level, detection_date, photo_evidence, additional_notes, resolved)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (id) DO NOTHING;
            `;
            const values = [
                report.reporter_name,
                report.email,
                report.location_description,
                report.gps_location,
                report.issue_type,
                report.issue_description,
                report.urgency_level,
                report.detection_date,
                report.photo_evidence,
                report.additional_notes,
                false, // Siempre inicia como no resuelto
            ];

            await pool.query(query, values);
        }

        res.status(200).json({ message: 'Datos sincronizados con la base de datos.' });
    } catch (error) {
        console.error('Error al sincronizar datos de KoboToolbox:', error);
        res.status(500).send('Error al procesar los datos de KoboToolbox.');
    }
});


// Ruta para insertar un reporte en la base de datos
app.post('/api/reports', async (req, res) => {
    const { report_name, email, location, issue_type, urgency_level, detection_date, issue_description, photo_evidence } = req.body;

    try {
        const query = `
            INSERT INTO reports (report_name, email, location, issue_type, urgency_level, detection_date, issue_description, photo_evidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;
        const values = [report_name, email, location, issue_type, urgency_level, detection_date, issue_description, photo_evidence];
        const result = await pool.query(query, values);

        res.status(201).send(result.rows[0]);
    } catch (error) {
        console.error('Error al insertar el reporte:', error);
        res.status(500).send('Error al insertar el reporte en la base de datos.');
    }
});

// Endpoints en tu servidor/proxy
app.get('/api/reports/pending', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reports WHERE resolved = false');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener reportes pendientes:', error);
        res.status(500).send('Error al obtener reportes pendientes.');
    }
});

app.get('/api/reports/resolved', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reports WHERE resolved = true');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener reportes resueltos:', error);
        res.status(500).send('Error al obtener reportes resueltos.');
    }
});


// Ruta para eliminar un reporte por ID
app.delete('/api/reports/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = 'DELETE FROM reports WHERE id = $1';
        const result = await pool.query(query, [id]);

        if (result.rowCount > 0) {
            res.status(200).send({ message: `Reporte con ID ${id} eliminado.` });
        } else {
            res.status(404).send({ error: 'Reporte no encontrado.' });
        }
    } catch (error) {
        console.error('Error al eliminar el reporte:', error);
        res.status(500).send('Error al eliminar el reporte.');
    }
});

// Ruta para resolver un reporte por ID
app.post('/api/reports/:id/resolve', async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            UPDATE reports
            SET resolved = true
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [id]);

        if (result.rowCount > 0) {
            res.status(200).send({ message: `Reporte con ID ${id} marcado como resuelto.` });
        } else {
            res.status(404).send({ error: 'Reporte no encontrado.' });
        }
    } catch (error) {
        console.error('Error al resolver el reporte:', error);
        res.status(500).send('Error al resolver el reporte.');
    }
});

// Inicia el servidor y crea la tabla
app.listen(PORT, async () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    await createTable();
});
