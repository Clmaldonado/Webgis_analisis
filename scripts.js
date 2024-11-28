// URL de la API del Proxy local
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api' // En desarrollo local
    : 'https://webgis-analisis.onrender.com/api'; // En producción

let allReports = []; // Almacenar todos los reportes
let heatLayer; // Variable para almacenar la capa del mapa de calor

// Inicializar el mapa con el centro y zoom bloqueado dentro de un área
const map = L.map("map", {
    center: [-37.47197, -72.34518], // Coordenadas del centro del campus UDEC
    zoom: 18, // Nivel de zoom inicial
    maxZoom: 19, // Nivel máximo de zoom
    minZoom: 18, // Nivel mínimo de zoom
    zoomControl: true, // Control de zoom
    dragging: true, // Permitir arrastrar el mapa
    scrollWheelZoom: true, // Permitir zoom con la rueda del ratón
    doubleClickZoom: true, // Permitir zoom con doble clic
    boxZoom: true, // Permitir zoom de caja
    keyboard: true // Permitir controles del teclado
});

// Definir los dos límites rectangulares
const expandedBounds = L.latLngBounds(
    [-37.473, -72.347], // Esquina suroeste extendida
    [-37.470, -72.343]  // Esquina noreste extendida
);

// Evento para limitar el movimiento del mapa dentro de los límites ampliados
map.on("drag", function () {
    const center = map.getCenter(); // Obtener el centro actual del mapa

    if (!expandedBounds.contains(center)) {
        // Si el centro está fuera de los límites permitidos, reubicarlo dentro
        map.panInsideBounds(expandedBounds, { animate: true });
    }
});

// Aplicar límites máximos al mapa
map.setMaxBounds(expandedBounds);

// Agregar la capa del mapa base
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20, // Zoom máximo soportado por la capa base
}).addTo(map);

// URL del formulario de KoboToolbox
const FORM_URL = "https://ee.kobotoolbox.org/z0lihxcE"; // Reemplaza con la URL de tu formulario

// Agregar evento al botón para abrir el formulario
document.getElementById("openFormButton").addEventListener("click", () => {
    window.open(FORM_URL, "_blank"); // Abrir el formulario en una nueva pestaña
});

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
    if (!allReports.length && !resolvedReports.length) {
        alert("No hay datos disponibles para exportar.");
        return;
    }

    // Preparar datos para exportar
       const exportData = allReports.map((report) => ({
        ID: report.id || "N/A",
        Nombre: report.report_name,
        Correo: report.email,
        "Tipo de Afectación": report.issue_type,
        Urgencia: report.urgency_level,
        Fecha: report.detection_date,
        Descripción: report.issue_description || "No disponible",
        Estado: "Pendiente",
    }));
    
    const resolvedData = resolvedReports.map((report) => ({
        ID: report.id || "N/A",
        Nombre: report.report_name,
        Correo: report.email,
        "Tipo de Afectación": report.issue_type,
        Urgencia: report.urgency_level,
        Fecha: report.detection_date,
        Descripción: report.issue_description || "No disponible",
        Estado: "Resuelto",
    }));

    // Crear el libro de Excel
    const workbook = XLSX.utils.book_new();
    if (exportData.length) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportData), "Pendientes");
    }
    if (resolvedData.length) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resolvedData), "Resueltos");
    }

    // Descargar el archivo Excel
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0]; // Formato YYYY-MM-DD
    XLSX.writeFile(workbook, `reportes_${formattedDate}.xlsx`);
});

// Función para formatear fechas
function formatDate(date) {
    if (!date) return "No disponible";
    const d = new Date(date);
    if (isNaN(d)) return "Fecha inválida";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

        // Verifica qué datos devuelve la API
        console.log("Datos obtenidos de la API:", data.results);

        return data.results.map(report => ({
            id: report._id?.toString() || "N/A", // Convertir _id a string si está presente
            report_name: report.report_name || "Nombre no disponible", // Valor por defecto
            email: report.email || "Correo no disponible",
            location: report.location || "Ubicación no especificada",
            // Traducción de tipos de problema
            issue_type: report.issue_type === "structural" ? "Falla estructural" :
                        report.issue_type === "electrical" ? "Problema eléctrico" :
                        report.issue_type === "landscaping" ? "Daño en áreas verdes" :
                        report.issue_type === "other" ? "Otro" :
                        "Tipo no especificado", // Valor por defecto si no coincide
            // Traducción de urgencia
            urgency_level: report.urgency_level === "low" ? "Bajo" :
                           report.urgency_level === "medium" ? "Medio" :
                           report.urgency_level === "high" ? "Alto" :
                           "Urgencia no especificada", // Valor por defecto si no coincide
            detection_date: report.detection_date || "Fecha no disponible",
            issue_description: report.issue_description || "Descripción no disponible",
            photo_evidence: report._attachments?.[0]?.download_medium_url || null, // Nulo si no hay evidencia
        }));
    } catch (error) {
        console.error("Error al cargar los datos:", error);
        alert("Hubo un problema al cargar los reportes. Por favor, inténtelo más tarde.");
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

function updateStatistics() {
    // Contar reportes pendientes
    const totalPending = allReports.length;
    const highUrgencyPending = allReports.filter((r) => r.urgency_level === "Alto").length;
    const mediumUrgencyPending = allReports.filter((r) => r.urgency_level === "Medio").length;
    const lowUrgencyPending = allReports.filter((r) => r.urgency_level === "Bajo").length;

    // Contar reportes resueltos
    const totalResolved = resolvedReports.length;
    const highUrgencyResolved = resolvedReports.filter((r) => r.urgency_level === "Alto").length;
    const mediumUrgencyResolved = resolvedReports.filter((r) => r.urgency_level === "Medio").length;
    const lowUrgencyResolved = resolvedReports.filter((r) => r.urgency_level === "Bajo").length;

    // Actualizar el HTML de las estadísticas
    const statsSection = document.getElementById("statistics");
    statsSection.innerHTML = `
        <p><strong>Total de Reportes Pendientes:</strong> ${totalPending}</p>
        <p><strong>Reportes de Urgencia Alta (Pendientes):</strong> ${highUrgencyPending}</p>
        <p><strong>Reportes de Urgencia Media (Pendientes):</strong> ${mediumUrgencyPending}</p>
        <p><strong>Reportes de Urgencia Baja (Pendientes):</strong> ${lowUrgencyPending}</p>
        <p><strong>Total de Reportes Resueltos:</strong> ${totalResolved}</p>
        <p><strong>Reportes de Urgencia Alta (Resueltos):</strong> ${highUrgencyResolved}</p>
        <p><strong>Reportes de Urgencia Media (Resueltos):</strong> ${mediumUrgencyResolved}</p>
        <p><strong>Reportes de Urgencia Baja (Resueltos):</strong> ${lowUrgencyResolved}</p>
    `;
}

 // Graficos
function calculateStats(allReports, resolvedReports) {
    const stats = {
        totalReports: allReports.length + resolvedReports.length,
        totalPending: allReports.length,
        totalResolved: resolvedReports.length,
        byType: {
            pending: {},
            resolved: {},
        },
        byUrgency: {
            pending: { high: 0, medium: 0, low: 0 },
            resolved: { high: 0, medium: 0, low: 0 },
        },
    };

    allReports.forEach(report => {
        const type = report.issue_type || "Otro";
        const urgency = report.urgency_level.toLowerCase();

        stats.byType.pending[type] = (stats.byType.pending[type] || 0) + 1;
        stats.byUrgency.pending[urgency]++;
    });

    resolvedReports.forEach(report => {
        const type = report.issue_type || "Otro";
        const urgency = report.urgency_level.toLowerCase();

        stats.byType.resolved[type] = (stats.byType.resolved[type] || 0) + 1;
        stats.byUrgency.resolved[urgency]++;
    });

    return stats;
}

let resolvedReports = []; // Lista de reportes resueltos

function renderCharts(allReports, resolvedReports) {
    const typeData = {
        labels: ["Falla estructural", "Problema eléctrico", "Daño en áreas verdes", "Otro"],
        datasets: [
            {
                label: "Pendientes",
                data: [
                    allReports.filter(r => r.issue_type === "Falla estructural").length,
                    allReports.filter(r => r.issue_type === "Problema eléctrico").length,
                    allReports.filter(r => r.issue_type === "Daño en áreas verdes").length,
                    allReports.filter(r => r.issue_type === "Otro").length,
                ],
                backgroundColor: "rgba(255, 99, 132, 0.5)",
            },
            {
                label: "Resueltos",
                data: [
                    resolvedReports.filter(r => r.issue_type === "Falla estructural").length,
                    resolvedReports.filter(r => r.issue_type === "Problema eléctrico").length,
                    resolvedReports.filter(r => r.issue_type === "Daño en áreas verdes").length,
                    resolvedReports.filter(r => r.issue_type === "Otro").length,
                ],
                backgroundColor: "rgba(54, 162, 235, 0.5)",
            },
        ],
    };

    const urgencyData = {
        labels: ["Alta", "Media", "Baja"],
        datasets: [
            {
                label: "Pendientes",
                data: [
                    allReports.filter(r => r.urgency_level === "Alto").length,
                    allReports.filter(r => r.urgency_level === "Medio").length,
                    allReports.filter(r => r.urgency_level === "Bajo").length,
                ],
                backgroundColor: ["red", "orange", "yellow"],
            },
            {
                label: "Resueltos",
                data: [
                    resolvedReports.filter(r => r.urgency_level === "Alto").length,
                    resolvedReports.filter(r => r.urgency_level === "Medio").length,
                    resolvedReports.filter(r => r.urgency_level === "Bajo").length,
                ],
                backgroundColor: ["darkred", "darkorange", "darkyellow"],
            },
        ],
    };

    // Gráfico de tipos de afectación
    const ctxType = document.getElementById("typeChart").getContext("2d");
    new Chart(ctxType, {
        type: "bar",
        data: typeData,
    });

    // Gráfico de urgencias
    const ctxUrgency = document.getElementById("urgencyChart").getContext("2d");
    new Chart(ctxUrgency, {
        type: "pie",
        data: urgencyData,
    });
}


// Llama a renderCharts después de actualizar estadísticas
renderCharts(allReports, resolvedReports);


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
            <td>
                <button class="resolve-btn" onclick="handleResolve('${report.id}')">Resolver</button>
                <button class="delete-btn" data-id="${report.id}">Eliminar</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Añadir eventos a los botones de resolver/eliminar
    document.querySelectorAll(".resolve-btn").forEach((button) => {
        button.addEventListener("click", (e) => handleResolve(e.target.dataset.id));
    });

    document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", (e) => handleDelete(e.target.dataset.id));
    });
}

// Crear una lista para las afectaciones resueltas
let resolvedReports = [];

// Función para manejar la resolución de reportes
async function handleResolve(reportId) {
    console.log(`ID recibido en handleResolve: ${reportId}`);
    if (!reportId || reportId === "undefined") {
        console.warn("Warning: Report ID is undefined. Verifica los datos de los botones o el HTML.");
        return;
    }

    console.log(`Intentando resolver reporte con ID: ${reportId}`);

    try {
        
        // Buscar el reporte en la lista de pendientes
        const reportIndex = allReports.findIndex((r) => r.id === reportId);
        if (reportIndex === -1) {
            console.error(`Reporte con ID ${reportId} no encontrado en la lista de pendientes.`);
            return;
        }

        // Obtener el reporte y marcarlo como resuelto
        const report = allReports[reportIndex];
        report.resolved = true; // Marcar como resuelto

        // Mover el reporte a la lista de resueltos
        allReports.splice(reportIndex, 1); // Remover de la lista de pendientes
        resolvedReports.push(report); // Agregar a la lista de resueltos

        // Actualizar la interfaz
        renderMapMarkers(allReports); // Actualizar marcadores
        renderTable(allReports); // Actualizar tabla de pendientes
        renderResolvedTable(resolvedReports); // Actualizar tabla de resueltos
        updateStatistics(); // Llamar para actualizar las estadísticas

        alert(`Reporte con ID ${reportId} marcado como resuelto.`);
    } catch (error) {
        // Manejo de errores
        console.error("Error al resolver el reporte:", error);
        alert("Hubo un error al resolver el reporte.");
    }
}

// Función para renderizar la tabla de reportes resueltos
function renderResolvedTable(reports) {
    const resolvedTableBody = document.querySelector("#resolvedTable tbody");
    resolvedTableBody.innerHTML = ""; // Limpiar la tabla antes de llenarla

    reports.forEach((report) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${report.id || "N/A"}</td>
            <td>${report.report_name}</td>
            <td>${report.email}</td>
            <td>${report.issue_type}</td>
            <td>${report.urgency_level}</td>
            <td>${report.detection_date}</td>
            <td>${report.issue_description || "No disponible"}</td>
            <td>${report.photo_evidence 
                ? `<a href="${report.photo_evidence}" target="_blank">Ver evidencia</a>` 
                : "No disponible"}
            </td>
        `;
        resolvedTableBody.appendChild(row);
    });
    console.log("Tabla de resueltos actualizada.");
}

// Función para manejar la eliminación de reportes
async function handleDelete(reportId) {
    try {
        console.log(`Intentando eliminar reporte con ID: ${reportId}`);
        
        // Solicitud DELETE al servidor
        const response = await fetch(`${API_URL}/reports/${reportId}`, { // Ajusta `/reports/` si tu endpoint espera otro formato
            method: 'DELETE',
        });

        if (!response.ok) {
            throw new Error(`Error al eliminar el reporte: ${response.status}`);
        }

        console.log(`Reporte con ID ${reportId} eliminado correctamente.`);

        // Actualiza la tabla y elimina el marcador correspondiente
        removeReportFromTable(reportId);
        removeMarkerFromMap(reportId);

        alert(`Reporte con ID ${reportId} eliminado exitosamente.`);
    } catch (error) {
        console.error("Error al eliminar el reporte:", error);
        alert("No se pudo eliminar el reporte. Verifica la consola para más detalles.");
    }
}

// Función para eliminar un reporte de la tabla
function removeReportFromTable(reportId) {
    const rows = document.querySelectorAll("#reportTable tbody tr");
    rows.forEach(row => {
        const cell = row.querySelector("td"); // Suponiendo que la primera celda contiene el ID
        if (cell && cell.textContent === reportId) {
            row.remove(); // Elimina la fila correspondiente
        }
    });
    console.log(`Reporte con ID ${reportId} eliminado de la tabla.`);
}

// Función para eliminar el marcador del mapa
function removeMarkerFromMap(reportId) {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.options.reportId === reportId) {
            map.removeLayer(layer); // Elimina el marcador correspondiente
        }
    });
    console.log(`Reporte con ID ${reportId} eliminado del mapa.`);
}

// Función para agregar un marcador al mapa con botón de eliminar
function addMarker(report) {
    const coords = report.location.split(" ").map(parseFloat);
    if (coords.length >= 2) {
        const marker = L.marker([coords[0], coords[1]], {
            reportId: report.id, // Asociar el marcador al ID del reporte
        }).addTo(map);
        marker.bindPopup(`
            <b>${report.report_name}</b><br>
            <b>Tipo:</b> ${report.issue_type}<br>
            <b>Descripción:</b> ${report.issue_description}<br>
            <b>Urgencia:</b> ${report.urgency_level}<br>
            <button onclick="handleDelete('${report.id}')">Eliminar</button>
            <button onclick="handleResolve('${report.id}')">Resolver</button>
      `);
   }
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
