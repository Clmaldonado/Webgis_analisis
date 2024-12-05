CREATE TABLE reports (
    id SERIAL PRIMARY KEY,                     -- ID único del reporte
    reporter_name VARCHAR(255) NOT NULL,       -- Nombre del reportante
    email VARCHAR(255) NOT NULL,               -- Correo institucional
    location_description VARCHAR(255),         -- Descripción de la ubicación
    gps_location VARCHAR(255),                 -- Ubicación GPS
    issue_type VARCHAR(100) NOT NULL,          -- Tipo de afectación
    issue_description TEXT NOT NULL,           -- Descripción detallada del problema
    urgency_level VARCHAR(50) NOT NULL,        -- Grado de urgencia
    detection_date DATE NOT NULL,              -- Fecha de detección
    photo_evidence TEXT,                       -- Evidencia fotográfica (URL o texto)
    additional_notes TEXT,                     -- Observaciones adicionales
    resolved BOOLEAN DEFAULT FALSE             -- Estado: no resuelto por defecto
);
