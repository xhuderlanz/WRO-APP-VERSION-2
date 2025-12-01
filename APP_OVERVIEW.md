# Visión General de la Aplicación

Este documento describe la estructura y funcionamiento del código fuente de la aplicación de planificación de trayectorias WRO (World Robot Olympiad). La aplicación permite a los usuarios diseñar, visualizar y simular recorridos de robots sobre tapetes de competición oficiales.

## Estructura de Archivos

La lógica principal se encuentra en `build_app/src`, organizada de la siguiente manera:

```
build_app/src/
├── main.jsx                        # Punto de entrada de la aplicación React
├── App.jsx                         # Componente raíz que monta el planificador
├── index.css                       # Estilos globales y utilidades Tailwind
├── wroplayback_planner_fix_snap_15.jsx # Wrapper/Re-export del planificador principal
├── wroplayback_planner_og.jsx      # (Backup) Versión original del planificador
├── assets/                         # Recursos estáticos (imágenes de tapetes)
└── wro-planner/                    # Módulo principal del planificador (Refactorizado)
    ├── WROPlaybackPlanner.jsx      # Contenedor principal y gestión de estado global
    ├── CanvasBoard.jsx             # Lienzo interactivo (dibujo, renderizado, eventos)
    ├── Toolbar.jsx                 # Barra de herramientas superior
    ├── SectionsPanel.jsx           # Panel lateral de gestión de secciones
    ├── OptionsPanel.jsx            # Panel de configuración (tapete, robot, grid)
    ├── icons.jsx                   # Componentes de iconos SVG
    └── domain/                     # Lógica de negocio pura (sin UI)
        ├── constants.js            # Constantes, configuración y presets
        ├── geometry.js             # Cálculos geométricos, proyecciones y snapping
        ├── playback.js             # Hook personalizado para la animación/reproducción
        └── sections.js             # Lógica para recálculo de secciones en cadena
```

## Descripción Detallada de Archivos

### Archivos Raíz (`src/`)

#### `main.jsx`
Es el punto de entrada de Vite/React. Se encarga de:
- Buscar el elemento DOM `#root`.
- Renderizar el componente `<App />` dentro de `React.StrictMode`.
- Importar los estilos globales `index.css`.

#### `App.jsx`
Componente contenedor simple. Su única función es montar `WroPlaybackPlanner` dentro de un `div` que ocupa toda la pantalla (`w-full h-screen`).

#### `wroplayback_planner_fix_snap_15.jsx`
Actúa como un archivo de "puente" o "wrapper". Actualmente solo re-exporta el componente `WROPlaybackPlanner` desde la carpeta `wro-planner`. Esto permite mantener la compatibilidad con importaciones existentes mientras se organiza el código en una estructura modular.

#### `index.css`
Contiene:
- Las directivas de Tailwind CSS (`@tailwind base`, etc.).
- Estilos personalizados para componentes específicos como `.toolbar-card`, `.section-card`, `.canvas-container`.
- Definiciones de animaciones y transiciones para la interfaz.

### Módulo del Planificador (`src/wro-planner/`)

#### `WROPlaybackPlanner.jsx`
Es el **cerebro** de la aplicación.
- **Gestión de Estado**: Mantiene el estado de la misión (secciones, puntos, acciones), configuración (grid, robot, tapete) y estado de la UI (paneles, modos de edición).
- **Coordinación**: Pasa el estado y las funciones de actualización a los componentes hijos (`Toolbar`, `CanvasBoard`, paneles).
- **Persistencia**: Maneja la carga y guardado de misiones (JSON) y la subida de imágenes personalizadas.
- **Responsive**: Calcula y ajusta el tamaño base del canvas según el tamaño de la ventana.

#### `CanvasBoard.jsx`
El componente más complejo, encargado de la visualización y edición gráfica.
- **Renderizado (Canvas API)**: Dibuja el tapete, la cuadrícula, el recorrido, el robot y las guías visuales en un elemento `<canvas>` HTML5.
- **Interacción**: Captura eventos de ratón/táctiles para dibujar trayectorias, arrastrar nodos y medir distancias.
- **Snapping**: Implementa la lógica visual para ajustar el cursor a la cuadrícula o a ángulos específicos.
- **Ghosting**: Muestra una previsualización "fantasma" del robot antes de confirmar un movimiento.

#### `Toolbar.jsx`
Barra de herramientas superior que contiene:
- Controles de reproducción (Play, Pause, Stop).
- Selectores de modo (Dibujo/Edición, Referencia Centro/Punta).
- Toggles para herramientas de ayuda (Regla, Snap 45°, Snap Grid).
- Control de Zoom.
- Menú rápido contextual para acciones inmediatas.

#### `SectionsPanel.jsx`
Panel lateral izquierdo para gestionar la estructura de la misión.
- Lista las "Secciones" de la misión.
- Permite editar propiedades de sección (nombre, color, visibilidad).
- Muestra la lista detallada de acciones (avanzar, girar) dentro de cada sección.
- Permite reordenar acciones mediante Drag & Drop.
- Permite editar manualmente valores numéricos de distancia y ángulo.

#### `OptionsPanel.jsx`
Panel modal/drawer para configuraciones globales.
- **Tapete**: Selección de tapetes oficiales (Junior, Elementary, Tennis) o carga de imagen propia.
- **Grid**: Ajuste de tamaño de celda, opacidad y offsets.
- **Robot**: Configuración de dimensiones físicas y apariencia del robot.
- **Unidades**: Alternar entre visualización en cm o mm.

### Lógica de Dominio (`src/wro-planner/domain/`)

#### `constants.js`
Define valores constantes utilizados en toda la app:
- Dimensiones oficiales del tapete WRO (2362x1143 mm).
- Presets de imágenes de tapetes.
- Valores por defecto para el robot y la cuadrícula.
- Factores de conversión (grados a radianes).

#### `geometry.js`
Biblioteca de funciones matemáticas puras para geometría 2D:
- `normalizeAngle`: Mantiene los ángulos dentro de -PI a PI.
- `computePoseUpToSection`: Calcula la posición del robot al inicio de una sección específica basándose en el historial de acciones.
- `projectPointWithReference`: Calcula dónde terminará el robot dado un punto de destino, considerando si se mueve desde el centro o la punta, y aplicando restricciones de ángulo (snap 45°).
- `buildActionsFromPolyline`: Convierte una lista de puntos (coordenadas) en una secuencia de acciones (avanzar X, girar Y).

#### `playback.js`
Un Custom Hook (`usePlayback`) que gestiona el bucle de animación (`requestAnimationFrame`).
- Interpola la posición del robot paso a paso para simular el movimiento suave.
- Maneja la reproducción normal y en reversa.
- Controla el cursor de acción actual para resaltar qué instrucción se está ejecutando.

#### `sections.js`
Utilidades para la gestión de la integridad de las secciones.
- `recalcAllFollowingSections`: Cuando se modifica una sección intermedia, esta función recalcula las posiciones iniciales y trayectorias de todas las secciones posteriores para mantener la coherencia de la misión completa.
