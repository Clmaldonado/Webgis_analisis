// URL de la API del Proxy local
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api' // En desarrollo local
    : 'https://webgis-analisis.onrender.com/api'; // En producción

let allReports = []; // Almacenar todos los reportes

// Inicializar el mapa con el centro y zoom bloqueado
const map = L.map("map", {
    center: [-37.47197, -72.34518], // Coordenadas del campus UDEC
    zoom: 17, // Nivel de zoom inicial
    maxZoom: 17, // Nivel máximo de zoom
    minZoom: 17, // Nivel mínimo de zoom
    zoomControl: false, // Deshabilitar el control de zoom
    dragging: false, // Deshabilitar el arrastre del mapa
    scrollWheelZoom: false, // Deshabilitar el zoom con la rueda del ratón
    doubleClickZoom: false, // Deshabilitar el zoom con doble clic
    boxZoom: false, // Deshabilitar el zoom de caja
    keyboard: false // Deshabilitar controles del teclado
});

// Agregar la capa del mapa base
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, // Zoom máximo soportado por la capa base
}).addTo(map);

// Evento para exportar la tabla a Excel
document.getElementById("exportExcel").addEventListener("click", function () {
    // Seleccionar la tabla
    const table = document.getElementById("reportTable");

    // Crear una hoja de Excel
    const worksheet = XLSX.utils.table_to_sheet(table, {
        raw: true, // Mantener datos como números
        cellDates: true, // Conservar formato de fechas
    });

    // Ignorar la columna de imágenes (última columna, columna G)
    Object.keys(worksheet).forEach((key) => {
        if (key.startsWith("G")) delete worksheet[key];
    });

    // Crear un libro de trabajo
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reportes");

    // Descargar el archivo Excel
    XLSX.writeFile(workbook, "reportes.xlsx");
});

// Agregar leyenda al mapa
const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () {
    const div = L.DomUtil.create("div", "legend");
    div.innerHTML = `
        <h4>Leyenda</h4>
        <div><span class="color-box red"></span> Alto</div>
        <div><span class="color-box orange"></span> Medio</div>
        <div><span class="color-box yellow"></span> Bajo</div>
    `;
    return div;
};
legend.addTo(map);

// Función para obtener el color del marcador según la urgencia
function getMarkerOptions(urgencyLevel) {
    const color = urgencyLevel === "Alto" ? "red" :
                  urgencyLevel === "Medio" ? "orange" : "yellow";

    return {
        icon: L.divIcon({
            className: `custom-marker-${color}`,
            html: `<div style="background-color:${color}; width: 25px; height: 25px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [25, 25],
            iconAnchor: [12, 12]
        }),
    };
}

// Función para cargar reportes desde la API
async function fetchReports() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();

        return data.results.map(report => ({
            report_name: report.report_name,
            email: report.email,
            location: report.location,
            issue_type: report.issue_type === "structural" ? "Falla estructural" : report.issue_type,
            urgency_level: report.urgency_level === "low" ? "Bajo" :
                           report.urgency_level === "medium" ? "Medio" : "Alto",
            detection_date: report.detection_date,
            issue_description: report.issue_description,
            photo_evidence: report._attachments?.[0]?.download_medium_url || null,
        }));
    } catch (error) {
        console.error("Error al cargar los datos:", error);
        return [];
    }
}

// Función para calcular estadísticas
function calculateStatistics(reports) {
    const totalReports = reports.length;
    const urgencyCounts = {
        Alto: reports.filter(report => report.urgency_level === "Alto").length,
        Medio: reports.filter(report => report.urgency_level === "Medio").length,
        Bajo: reports.filter(report => report.urgency_level === "Bajo").length,
    };

    return { totalReports, ...urgencyCounts };
}

// Función para mostrar estadísticas
function displayStatistics(statistics) {
    const statsContainer = document.querySelector("#statistics");
    statsContainer.innerHTML = `
        <h4>Estadísticas Generales</h4>
        <p>Total de Reportes: ${statistics.totalReports}</p>
        <p>Reportes de Urgencia Alta: ${statistics.Alto}</p>
        <p>Reportes de Urgencia Media: ${statistics.Medio}</p>
        <p>Reportes de Urgencia Baja: ${statistics.Bajo}</p>
    `;
}

// Función para renderizar marcadores en el mapa
function renderMapMarkers(reports) {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    reports.forEach(report => {
        if (report.location) {
            const coords = report.location.split(" ").map(parseFloat);
            if (coords.length >= 2) {
                const markerOptions = getMarkerOptions(report.urgency_level);
                L.marker([coords[0], coords[1]], markerOptions).addTo(map)
                    .bindPopup(`
                        <b>${report.report_name}</b><br>
                        <b>Tipo:</b> ${report.issue_type}<br>
                        <b>Descripción:</b> ${report.issue_description}<br>
                        <b>Urgencia:</b> ${report.urgency_level}
                    `);
            }
        }
    });
}

// Función para renderizar la tabla
function renderTable(reports) {
    const tableBody = document.querySelector("#reportTable tbody");
    tableBody.innerHTML = ""; // Limpiar la tabla

    reports.forEach(report => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${report.report_name}</td>
            <td>${report.email}</td>
            <td>${report.issue_type}</td>
            <td>${report.urgency_level}</td>
            <td>${report.detection_date}</td>
            <td>${report.issue_description || "No disponible"}</td>
            <td>
                ${report.photo_evidence 
                    ? `<a href="${report.photo_evidence}" target="_blank">
                        <img src="${report.photo_evidence}" alt="Evidencia" style="width: 50px; height: auto;">
                       </a>` 
                    : "No disponible"}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Función para aplicar filtros
function applyFilters() {
    const startDate = document.querySelector("#filter-start-date").value;
    const endDate = document.querySelector("#filter-end-date").value;
    const filterType = document.querySelector("#filter-type").value;
    const filterUrgency = document.querySelector("#filter-urgency").value;

    const filteredReports = allReports.filter(report => {
        const reportDate = new Date(report.detection_date);

        const matchesDateRange = (!startDate || reportDate >= new Date(startDate)) &&
                                 (!endDate || reportDate <= new Date(endDate));
        const matchesType = !filterType || report.issue_type === filterType;
        const matchesUrgency = !filterUrgency || report.urgency_level === filterUrgency;

        return matchesDateRange && matchesType && matchesUrgency;
    });

    // Renderizar resultados filtrados
    const statistics = calculateStatistics(filteredReports);
    displayStatistics(statistics);
    renderMapMarkers(filteredReports);
    renderTable(filteredReports);
}

// Función principal para cargar datos y mostrar todo
async function displayReports() {
    allReports = await fetchReports(); // Cargar todos los reportes

    // Mostrar todo inicialmente
    const statistics = calculateStatistics(allReports);
    displayStatistics(statistics);
    renderMapMarkers(allReports);
    renderTable(allReports);

    // Agregar evento al botón de filtros
    document.querySelector("#apply-filters").addEventListener("click", applyFilters);
}

// Ejecutar al cargar la página
displayReports();
