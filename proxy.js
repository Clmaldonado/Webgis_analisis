const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg'); // Importar el cliente de PostgreSQL

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'tu_usuario',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'webgis',
    password: process.env.DB_PASSWORD || 'tu_contraseña',
    port: process.env.DB_PORT || 5432,
});

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = 'https://kf.kobotoolbox.org/api/v2/assets/aPk24s6jb5BSdEJRnPqpW7/data/';

// Middleware para habilitar CORS y JSON
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Crear tabla si no existe al iniciar el servidor
async function createTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            report_name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            location VARCHAR(255),
            issue_type VARCHAR(100),
            urgency_level VARCHAR(50),
            detection_date DATE,
            issue_description TEXT,
            photo_evidence TEXT,
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
        res.status(response.status).send(response.data);
    } catch (error) {
        console.error('Error al realizar la solicitud a la API:', error);
        res.status(500).send('Error al procesar los datos de la API.');
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

// Ruta para obtener todos los reportes de la base de datos
app.get('/api/reports', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reports');
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error al obtener reportes:', error);
        res.status(500).send('Error al obtener los reportes.');
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
