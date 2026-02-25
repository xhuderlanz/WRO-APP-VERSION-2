# WRO App – Planificador de misiones y rutas para robots

Aplicación web para diseñar y simular rutas de robots sobre tapetes oficiales de la **World Robot Olympiad (WRO)**. Permite dibujar la ruta en un lienzo, obtener automáticamente las instrucciones (giros y avances) y exportar/importar misiones en JSON con coordenadas en milímetros.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

---

## Características

- **Tapetes oficiales WRO 2025:** Junior, Elementary, RoboSports Double Tennis y tapete personalizado (imagen de fondo).
- **Edición visual de la ruta:** Waypoints en un canvas con arrastre, reversa por tramo y referencia centro/punta del robot.
- **Cálculo automático de instrucciones:** Giros (grados) y avances (cm o mm) listos para trasladar al código del robot.
- **Simulación (playback):** Reproducción de la misión completa o por sección, en sentido normal o inverso.
- **Obstáculos y colisiones:** Rectángulos con posición, tamaño y rotación; detección opcional de colisión con la ruta (margen configurable).
- **Marcadores de misión:** Objetivos y zonas con formas y etiquetas.
- **Exportación e importación:** Misión completa, obstáculos y marcadores en JSON con `coordSystem: "mm"` y tapete 2362×1143 mm para integración con otras herramientas.

La aplicación es **frontend-only**: no requiere servidor ni base de datos; todo se ejecuta en el navegador y la persistencia se hace mediante archivos JSON.

---

## Requisitos

- [Node.js](https://nodejs.org/) (recomendado v18 o superior)
- npm

---

## Instalación y uso

```bash
cd build_app
npm install
npm run dev
```

Abre en el navegador la URL que muestre Vite (normalmente `http://localhost:5173`).

### Otros comandos

| Comando        | Descripción              |
|----------------|--------------------------|
| `npm run build`| Build de producción      |
| `npm run preview` | Vista previa del build |
| `npm run lint` | Ejecutar ESLint          |

---

## Estructura del proyecto

```
build_app/
├── src/
│   ├── wro-planner/           # Planificador WRO
│   │   ├── WROPlaybackPlanner.jsx   # Componente principal y estado
│   │   ├── CanvasBoard.jsx          # Lienzo (tapete, ruta, robot)
│   │   ├── TopBar.jsx               # Barra superior y controles
│   │   ├── SectionsPanel.jsx        # Lista de secciones
│   │   ├── WaypointsPanel.jsx       # Waypoints e instrucciones
│   │   ├── OptionsPanel.jsx         # Configuración (campo, robot, grid, etc.)
│   │   └── domain/                  # Lógica sin dependencias de React
│   │       ├── pathCalculator.js    # Cálculo de giros y avances
│   │       ├── geometry.js          # Geometría y poses
│   │       ├── collision.js         # Detección de colisiones
│   │       ├── playback.js          # Hook de reproducción
│   │       └── ...
│   ├── App.jsx
│   └── main.jsx
├── DOCUMENTACION_TECNICA.md   # Arquitectura y diseño
├── EXPORT_IMPORT_FORMAT.md    # Formato JSON para integración
└── package.json
```

---

## Documentación

- **[DOCUMENTACION_TECNICA.md](build_app/DOCUMENTACION_TECNICA.md)** – Arquitectura, componentes, flujos y algoritmos.
- **[EXPORT_IMPORT_FORMAT.md](build_app/EXPORT_IMPORT_FORMAT.md)** – Formato de exportación/importación (misiones, obstáculos y marcadores) en mm para integración externa.

---

## Tecnologías

- **React 19** – Interfaz y estado
- **Vite (rolldown-vite)** – Build y dev server
- **Tailwind CSS 4** – Estilos
- **JavaScript (ES modules) + JSX** – Sin TypeScript

---

## Licencia

[Indica aquí tu licencia, por ejemplo: MIT, GPL, o "Uso educativo".]

---

## Contribuciones

Las contribuciones son bienvenidas. Abre un *issue* o un *pull request* si quieres proponer mejoras o correcciones.
