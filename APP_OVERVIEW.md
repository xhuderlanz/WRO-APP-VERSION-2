# Visión general

Este documento resume el funcionamiento de la aplicación de planificación WRO y describe la estructura de archivos relevantes del proyecto.

## Funcionamiento general

- La interfaz se monta con `src/main.jsx`, que carga estilos globales (`src/index.css`) y renderiza el componente principal `App`.
- `src/App.jsx` sirve como contenedor y delega toda la lógica a `src/wroplayback_planner_fix_snap_15.jsx`.
- El componente `WROPlaybackPlanner` gestiona estado, renderizado y eventos del planificador usando un lienzo HTML5 y paneles laterales React.
- La visualización usa imágenes de tapetes WRO 2025 (`src/assets/*.jpg`) combinadas con una cuadrícula configurable y el esquema de colores definido en `src/index.css`.

## Características principales

### Configuración del entorno de trabajo
- Selección de tapetes predefinidos (Junior, Elementary, Double Tennis) o subida de un fondo personalizado.
- Control de opacidad del tapete, parámetros de cuadrícula (tamaño de celda, offsets, densidad) y unidad de medida intercambiable cm/mm.
- Personalización del robot (dimensiones, color, imagen) y ajuste de la pose inicial directamente desde el panel de opciones.

### Planificación de trayectorias
- Dibujo en canvas con soporte de snapping a cuadrícula o a incrementos de 15 grados (corrección incluida para asegurar que el punto trazado respeta el ángulo).
- Modo de dibujo en reversa para registrar trayectos desde el final hacia el inicio.
- Alternancia de referencia entre centro de las ruedas y punta del robot al generar movimientos.
- Edición posterior de nodos con arrastre y actualización visual del recorrido.

### Gestión de secciones y acciones
- Creación de múltiples secciones de misión, cada una con su color, visibilidad y nombre editable.
- Conversión automática de trazos en acciones discretas (`move` y `rotate`) que pueden reorganizarse mediante drag and drop.
- Reproducción individual de secciones o del conjunto completo en sentido normal o inverso, con menú rápido activado por pulsación prolongada.

### Herramientas complementarias
- Regla interactiva para medir distancias entre puntos del canvas.
- Ajuste manual del origen de coordenadas directamente sobre el tapete.
- Controles de zoom con límites definidos y restablecimiento rápido.
- Exportación de la misión a JSON descargable e importación para restaurar sesiones previas.

## Estructura de archivos

- `package.json` y `package-lock.json` definen dependencias y scripts (React 19, Vite, Tailwind, ESLint).
- `vite.config.js`, `postcss.config.cjs`, `tailwind.config.cjs` y `eslint.config.js` configuran la toolchain de build, estilos y linting.
- `index.html` establece la plantilla base y carga el bundle de React.
- `src/main.jsx` monta la aplicación y aplica los estilos globales.
- `src/App.jsx` encapsula el componente del planificador.
- `src/index.css` aporta las utilidades Tailwind y los estilos detallados de paneles, toolbar y canvas.
- `src/wroplayback_planner_fix_snap_15.jsx` contiene la lógica completa del planificador: estados, renders, snapping corregido, reproducción y paneles auxiliares.
- `src/assets/` alberga las imágenes de tapetes de juego y el icono SVG del template.
- `public/vite.svg` se usa como favicon por defecto en `index.html`.

## Consideraciones adicionales

- No se documentan módulos dentro de `node_modules`, porque pertenecen al ecosistema de dependencias externas.
- Los estilos originales del template (`src/App.css`, `src/assets/react.svg`) permanecen en el proyecto pero no participan en la vista principal actual.
