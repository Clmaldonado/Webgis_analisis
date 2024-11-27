// URL de la API del Proxy local
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api' // En desarrollo local
    : 'https://webgis-analisis.onrender.com/api'; // En producción

let allReports = []; // Almacenar todos los reportes
let heatLayer; // Variable para almacenar la capa del mapa de calor

// Inicializar el mapa con el centro y zoom ajustado
const map = L.map("map", {
    center: [-37.47197, -72.34518], // Coordenadas del campus UDEC
    zoom: 17, // Cambia el nivel de zoom aquí (prueba con 17 o 18)
    maxZoom: 19, // Nivel máximo de zoom
    minZoom: 16, // Nivel mínimo de zoom
    zoomControl: false, // Deshabilitar el control de zoom
    dragging: true, // Permitir arrastrar el mapa
    scrollWheelZoom: true, // Permitir zoom con la rueda del ratón
    doubleClickZoom: true, // Permitir zoom con doble clic
    boxZoom: true, // Permitir zoom de caja
    keyboard: true // Permitir controles del teclado
});

// Agregar la capa del mapa base
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20, // Zoom máximo soportado por la capa base
}).addTo(map);

// Función para generar un mapa de calor basado en la densidad de reportes
async function updateHeatmapDensity() {
    const heatmapData = await fetchHeatmapDataFromKobo();

    if (!heatmapData.length) {
        alert("No hay datos disponibles para el mapa de calor.");
        return;
    }

   // Si la capa de calor ya existe, primero asegúrate de eliminarla del mapa antes de agregarla nuevamente
    if (heatLayer) {
        map.removeLayer(heatLayer); // Eliminar capa anterior si existe
    }

    // Crear una nueva capa de calor con los datos actualizados
    heatLayer = L.heatLayer(heatmapData.map(([lat, lon]) => [lat, lon, 1]), {
        radius: 30, // Ajusta el tamaño de los puntos
        blur: 25, // Ajusta el desenfoque para mayor suavidad
        maxZoom: 19,
        opacity: 0.75, // Opacidad del mapa de calor
        gradient: {
            0.4: "blue",
            0.6: "lime",
            0.8: "yellow",
            1: "red",
        },
    }).addTo(map); // Agregar la nueva capa al mapa
}

// Función para alternar el mapa de calor de densidad
function toggleDensityHeatmap() {
    const heatmapButton = document.getElementById("toggle-heatmap");

    if (heatLayer && map.hasLayer(heatLayer)) {
        map.removeLayer(heatLayer); // Ocultar mapa de calor
        heatmapButton.textContent = "Activar Mapa de Densidad";
    } else {
        updateHeatmapDensity(); // Mostrar mapa de calor
        heatmapButton.textContent = "Desactivar Mapa de Densidad";
    }
}

// Crear botón para alternar el mapa de densidad
const densityHeatmapControl = L.control({ position: "bottomright" });

densityHeatmapControl.onAdd = function (map) {
    const div = L.DomUtil.create("div", "heatmap-control");
    div.innerHTML = `<button id="toggle-heatmap" class="heatmap-btn">Activar Mapa de Densidad</button>`;
    div.style.padding = "10px";
    div.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    div.style.borderRadius = "5px";

    L.DomEvent.disableClickPropagation(div);
    return div;
};

// Agregar el control al mapa
densityHeatmapControl.addTo(map);

// Manejar evento del botón de mapa de densidad
document.addEventListener("click", (event) => {
    if (event.target && event.target.id === "toggle-heatmap") {
        toggleDensityHeatmap();
    }
});

// Función para extraer datos de KoboToolbox con solo latitud y longitud
async function fetchHeatmapDataFromKobo() {
    try {
        const response = await fetch(API_URL); // API_URL apunta a la fuente de datos de KoboToolbox
        if (!response.ok) throw new Error(`Error al obtener datos: ${response.statusText}`);

        const data = await response.json();

        const heatmapData = [];

        data.results.forEach((report) => {
            const location = report.location; // Campo "location" en KoboToolbox
            if (location) {
                // Separar por espacios y tomar solo latitud y longitud
                const [lat, lon] = location.split(" ").slice(0, 2).map(parseFloat);

                if (!isNaN(lat) && !isNaN(lon)) {
                    heatmapData.push([lat, lon]); // Agregar solo latitud y longitud
                }
            }
        });

        return heatmapData;
    } catch (error) {
        console.error("Error al procesar los datos de KoboToolbox:", error);
        alert("No se pudieron obtener los datos para el mapa de densidad.");
        return [];
    }
}

// Evento para exportar la tabla a Excel
document.getElementById("exportExcel").addEventListener("click", function () {
    // Seleccionar la tabla
    const table = document.getElementById("reportTable");

    if (!table) {
        console.error("La tabla no se encuentra en el DOM.");
        return;
    }

    // Crear una nueva hoja de Excel desde la tabla
    const worksheet = XLSX.utils.table_to_sheet(table, {
        raw: true, // Mantener datos numéricos
        cellDates: true, // Preservar fechas
    });

    // Ignorar la columna de imágenes (última columna)
    Object.keys(worksheet).forEach((key) => {
        if (key.startsWith("G")) delete worksheet[key]; // "G" corresponde a la columna de imágenes
    });

    // Crear el libro de Excel
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reportes");

    // Obtener la fecha de hoy en formato YYYY-MM-DD
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Formato: YYYY-MM-DD

    // Descargar el archivo con la fecha en el nombre
    const filename = `reportes_${formattedDate}.xlsx`;
    XLSX.writeFile(workbook, filename);
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
            id: report._id, // Asegúrate de que la API retorne este campo
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
            <td>${report.id || "N/A"}</td>
            <td>${report.report_name}</td>
            <td>${report.email}</td>
            <td>${report.issue_type}</td>
            <td>${report.urgency_level}</td>
            <td>${report.detection_date}</td>
            <td>${report.issue_description || "No disponible"}</td>
            <td style="display: none;">${report.location || ""}</td> <!-- Columna oculta para ubicación -->
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
