const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar conexión a PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Configurada en Render o localmente
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false, // Requerido por Render
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Crear tabla al iniciar el servidor si no existe
async function createTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            kobo_id VARCHAR(255) UNIQUE,
            report_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            location VARCHAR(255),
            issue_type VARCHAR(100) NOT NULL,
            urgency_level VARCHAR(50) NOT NULL,
            detection_date DATE NOT NULL,
            issue_description TEXT NOT NULL,
            photo_evidence TEXT,
            resolved BOOLEAN DEFAULT FALSE
        );
    `;
    try {
        await pool.query(query);
        console.log("Tabla reports creada o ya existe.");
    } catch (error) {
        console.error("Error al crear la tabla:", error);
    }
}

// Ruta para obtener datos de KoboToolbox y almacenarlos en la base de datos
app.get("/api/sync", async (req, res) => {
    const API_URL = "https://kf.kobotoolbox.org/api/v2/assets/aPk24s6jb5BSdEJRnPqpW7/data/";
    try {
        const response = await axios.get(API_URL, {
            headers: {
                Authorization: `Token ${process.env.KOBOTOOLBOX_API_KEY}`,
            },
        });

        const reports = response.data.results.map(report => ({
            kobo_id: report._id.toString(),
            report_name: report.report_name || "N/A",
            email: report.email || "N/A",
            location: report.location || "N/A",
            issue_type: report.issue_type || "Otro",
            urgency_level: report.urgency_level || "Bajo",
            detection_date: report.detection_date || new Date(),
            issue_description: report.issue_description || "No disponible",
            photo_evidence: report._attachments?.[0]?.download_medium_url || null,
        }));

        for (const report of reports) {
            await pool.query(
                `INSERT INTO reports (kobo_id, report_name, email, location, issue_type, urgency_level, detection_date, issue_description, photo_evidence)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (kobo_id) DO NOTHING`,
                [
                    report.kobo_id,
                    report.report_name,
                    report.email,
                    report.location,
                    report.issue_type,
                    report.urgency_level,
                    report.detection_date,
                    report.issue_description,
                    report.photo_evidence,
                ]
            );
        }

        res.status(200).send({ message: "Datos sincronizados con éxito." });
    } catch (error) {
        console.error("Error al sincronizar datos:", error);
        res.status(500).send("Error al sincronizar datos.");
    }
});

// Ruta para obtener todos los reportes
app.get("/api/reports", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM reports");
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error al obtener reportes:", error);
        res.status(500).send("Error al obtener reportes.");
    }
});

// Ruta para marcar un reporte como resuelto
app.post("/api/reports/:id/resolve", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            "UPDATE reports SET resolved = TRUE WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).send({ error: "Reporte no encontrado." });
        }

        res.status(200).send({ message: "Reporte marcado como resuelto.", report: result.rows[0] });
    } catch (error) {
        console.error("Error al marcar reporte como resuelto:", error);
        res.status(500).send("Error al marcar reporte como resuelto.");
    }
});

// Ruta principal para servir `Webgis.html`
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Webgis.html"));
});

// Inicializar servidor
app.listen(PORT, async () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    await createTable();
});
