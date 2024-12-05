CREATE TABLE reports (
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