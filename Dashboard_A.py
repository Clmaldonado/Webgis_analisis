import dash
from dash import dcc, html, Input, Output, State, dash_table
import dash_leaflet as dl
import requests
import pandas as pd
import geopandas as gpd
import json

# Configuración de la API de KoboToolbox
API_TOKEN = "ffa135f8b667ddb65202f7b5209e6ebd881aa542"
HEADERS = {"Authorization": f"Token {API_TOKEN}", "Accept": "application/json"}

# ID del formulario actualizado
FORM_ID = "aPk24s6jb5BSdEJRnPqpW7"
FORM_URL = f"https://kf.kobotoolbox.org/api/v2/assets/{FORM_ID}/data/"

# Función para obtener datos desde KoboToolbox (ya existe en tu código)
def fetch_form_data(url):
    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        data = response.json().get("results", [])
        df = pd.DataFrame(data)

        # Filtrar columnas según los campos del formulario diseñado
        columnas_relevantes = [
            "_id", "report_name", "contact_info", "location", 
            "issue_type", "location_desc", "urgency_level", 
            "issue_description", "detection_date", "photo_evidence"
        ]
        df = df[columnas_relevantes] if not df.empty else pd.DataFrame(columns=columnas_relevantes)
        return df
    except requests.RequestException as e:
        print(f"Error al obtener los datos: {e}")
        return pd.DataFrame()

# Función para convertir coordenadas en formato adecuado
def parse_gps_location(location_str):
    try:
        values = list(map(float, location_str.split()))
        if len(values) >= 2:
            return [values[0], values[1]]  # Orden: [latitud, longitud]
    except (ValueError, AttributeError):
        print(f"Error procesando ubicación GPS: {location_str}")
    return None

# Crear la aplicación Dash
app = dash.Dash(__name__, suppress_callback_exceptions=True)

# Layout del dashboard
app.layout = html.Div([
    html.H1("WebGIS para la Gestión de Infraestructura"),
    html.Div([
        dl.Map(
            id='map_afectaciones',
            center=[-37.47197, -72.34518],
            zoom=17,
            children=[
                dl.TileLayer(url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
            ],
            style={"width": "100%", "height": "60vh"}
        ),
    ], style={"margin": "20px 0"}),

    html.H2("Tabla de Reportes"),
    dash_table.DataTable(
        id='table_reportes',
        columns=[
            {"name": "ID", "id": "_id"},
            {"name": "Tipo de Afectación", "id": "tipo_afectacion"},
            {"name": "Urgencia", "id": "grado_urgencia"},
            {"name": "Descripción", "id": "descripcion"},
            {"name": "Fecha", "id": "fecha_registro"}
        ],
        style_table={'overflowX': 'auto'}
    ),

    html.Div([
        dcc.Graph(id='grafico_afectaciones')
    ], style={"margin": "20px 0"}),

    dcc.Interval(
        id='interval_component',
        interval=60000,  # Actualización cada 60 segundos
        n_intervals=0
    )
])

# Callbacks para cargar datos
@app.callback(
    [Output("table_reportes", "data"),
     Output("map_afectaciones", "children"),
     Output("grafico_afectaciones", "figure")],
    Input("interval_component", "n_intervals")
)
def actualizar_dashboard(_):
    # Cargar datos del formulario
    data = fetch_form_data(FORM_URL)

    if not data.empty:
        # Procesar datos para el mapa
        markers = []
        for _, row in data.iterrows():
            coords = parse_gps_location(row.get("coordenadas", ""))
            if coords:
                markers.append(dl.Marker(
                    position=coords,
                    children=[
                        dl.Tooltip(f"{row['tipo_afectacion']} - {row['grado_urgencia']}"),
                        dl.Popup(row["descripcion"])
                    ]
                ))

        # Generar figura para el gráfico
        grafico = {
            "data": [
                {
                    "x": data["tipo_afectacion"].value_counts().index,
                    "y": data["tipo_afectacion"].value_counts().values,
                    "type": "bar",
                    "name": "Afectaciones"
                }
            ],
            "layout": {
                "title": "Distribución de Afectaciones por Tipo"
            }
        }

        return data.to_dict("records"), [
            dl.TileLayer(url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
        ] + markers, grafico

    return [], [], {"data": [], "layout": {"title": "Distribución de Afectaciones por Tipo"}}

if __name__ == '__main__':
    app.run
