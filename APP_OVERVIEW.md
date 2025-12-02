# Visión General de la Aplicación

Este documento describe la estructura y funcionamiento del código fuente de la aplicación de planificación de trayectorias WRO (World Robot Olympiad). La aplicación permite a los usuarios diseñar, visualizar y simular recorridos de robots sobre tapetes de competición oficiales.

## Estructura de Archivos

La lógica principal se encuentra en `build_app/src`, organizada de la siguiente manera:

```
build_app/src/
├── main.jsx                        # Punto de entrada de la aplicación React
├── App.jsx                         # Componente raíz que monta el planificador
├── App.css                         # Estilos del componente raíz (no utilizado en producción)
├── index.css                       # Estilos globales, Tailwind y clases personalizadas
├── wroplayback_planner_fix_snap_15.jsx # Re-export del planificador
├── wroplayback_planner_og.jsx      # (Backup) Versión original monolítica
├── assets/                         # Recursos estáticos (imágenes de tapetes)
└── wro-planner/                    # Módulo principal del planificador (Refactorizado)
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
**Punto de entrada de la aplicación React.**

Responsabilidades:
- Importa `React` y `ReactDOM` para renderizar la aplicación
- Busca el elemento DOM `#root` en `index.html`
- Renderiza el componente `<App />` envuelto en `React.StrictMode` para detectar problemas potenciales
- Importa los estilos globales desde `index.css`

```jsx
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

#### `App.jsx`
**Componente raíz de la aplicación.**

Es un componente contenedor minimalista que:
- Importa el componente principal `WroPlaybackPlanner`
- Lo envuelve en un `div` con clases Tailwind (`w-full h-screen`) para ocupar toda la pantalla
- Actúa como punto de montaje único para toda la lógica del planificador

```jsx
function App() {
  return (
    <div className="w-full h-screen">
      <WroPlaybackPlanner />
    </div>
  )
}
```

#### `App.css`
**Estilos del template original de Vite (no utilizado).**

Contiene estilos predeterminados de Vite como animaciones de logos y configuración de `#root`. Este archivo no afecta a la aplicación del planificador WRO ya que se utiliza `index.css` para todos los estilos.

#### `index.css`
**Archivo de estilos principal de la aplicación.**

Contiene tres secciones fundamentales:

1. **Directivas de Tailwind CSS**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

2. **Clases Personalizadas para Componentes**:
   - `.app-shell`: Layout principal con grid responsivo
   - `.toolbar-card`: Estilo de la barra de herramientas con sombras y bordes
   - `.canvas-container`: Contenedor del canvas con configuración de cursor
   - `.section-card`: Tarjetas de secciones con efectos hover
   - `.canvas-legend`: Leyenda visual del canvas (centro/punta del robot)
   - `.footer-note`: Texto informativo en el pie de página

3. **Animaciones y Transiciones**:
   - Animaciones suaves para hover effects
   - Transiciones de color y transform
   - Estados de focus y active para elementos interactivos

Este archivo es crítico porque define toda la apariencia visual de la interfaz del planificador, fusionando Tailwind con estilos personalizados específicos del dominio WRO.

#### `wroplayback_planner_fix_snap_15.jsx`
**Archivo de compatibilidad/wrapper.**

Su función es mantener la retrocompatibilidad con importaciones antiguas. Simplemente re-exporta el componente del módulo refactorizado:

```jsx
export { default } from './wro-planner/WROPlaybackPlanner.jsx';
```

Esto permite que `App.jsx` importe desde la ruta antigua mientras el código se encuentra en la nueva estructura modular.

### Módulo del Planificador (`src/wro-planner/`)

#### `CanvasBoard.jsx`
**El componente más complejo y crítico de la aplicación.**

**Responsabilidades Principales**:

1. **Renderizado con Canvas API**:
   - Dibuja el fondo del tapete WRO con opacidad ajustable
   - Renderiza la cuadrícula (grid) con espaciado configurable
   - Visualiza las secciones de trayectoria con líneas de colores
   - Dibuja flechas direccionales en los segmentos de trayecto
   - Renderiza puntos numerados con radio variable según el estado (hover, selección, último punto)
   - Muestra el robot en su pose actual o durante la reproducción
   - Dibuja herramientas auxiliares (regla de medición, guías del cursor)

2. **Gestión de Interacción**:
   - **Modo Dibujo**: Captura clics y arrastre del mouse para añadir puntos a la trayectoria actual
   - **Modo Edición**: Permite seleccionar, arrastrar y eliminar puntos existentes
   - **Inserción de Puntos**: Detecta clics en segmentos de línea para insertar puntos intermedios
   - **Eliminación de Puntos**: Responde a teclas Delete/Backspace para borrar puntos seleccionados
   - **Selección Persistente**: Mantiene el punto seleccionado resaltado después de soltar el mouse

3. **Lógica de Snapping**:
   - Ajusta el cursor a la cuadrícula cuando `snapGrid` está activo
   - Aplica restricciones de ángulo (snap 45°) mediante `projectPointWithReference`
   - Calcula la proyección correcta del robot considerando el modo de referencia (centro vs. punta)

4. **Sistema de "Ghosting"**:
   - Muestra una previsualización semitransparente del robot mientras el usuario arrastra el cursor
   - Dibuja una línea punteada desde el último punto confirmado hasta la posición del cursor
   - Proporciona retroalimentación visual inmediata antes de confirmar una acción

5. **Gestión de Estado de Puntos**:
   - Clears the `heading` property when points are inserted or dragged to allow automatic recalculation based on geometry
   - Resets heading of the point following a deleted point to ensure correct trajectory recalculation
   - Prevents "buggy" playback where the robot would snap to old, invalid headings

**Eventos Manejados**:
  - `onPointerDown`: Inicia dibujo, selecciona puntos, inicia arrastre
  - `onPointerMove`: Actualiza posición del ghost, arrastra puntos, actualiza regla
  - `onPointerUp`: Finaliza arrastre, persiste selección para permitir eliminación
  - `onClick`: Añade punto en modo dibujo (si no se añadió durante arrastre)
  - `onContextMenu`: Previene menú contextual del navegador
  - Eventos de teclado: `Delete`/`Backspace` para eliminar, `Space` para alternar modo reversa

**Funciones Auxiliares Internas**:
  - `canvasPos()`: Convierte coordenadas de pantalla a coordenadas de canvas, aplicando zoom y snapping
  - `hitTestNode()`: Detecta si el cursor está sobre un punto existente (radio de 8px)
  - `hitTestSegment()`: Detecta si el cursor está sobre un segmento de línea, incluyendo el primer segmento desde `startPose`
  - `drawRobot()`: Renderiza el robot con rotación, considerando imagen personalizada o rectángulo con ruedas

#### `Toolbar.jsx`
**Barra de herramientas superior con todos los controles de la aplicación.**

**Secciones de Controles**:

1. **Controles de Reproducción**:
   - Botón Play Mission: Reproduce toda la misión desde el inicio
   - Botón Play Section: Reproduce solo la sección seleccionada
   - Botón Pause/Resume: Pausa o reanuda la reproducción
   - Botón Stop: Detiene la reproducción y reinicia a la pose inicial
   - Controles de reproducción inversa para Mission y Section

2. **Selectores de Modo**:
   - Toggle Draw Mode / Edit Mode: Alterna entre dibujar nuevos puntos y editar existentes
   - Selector Reference Mode: Cambia entre "Centro" y "Punta" del robot como referencia de dibujo

3. **Herramientas de Ayuda Visual**:
   - Toggle Snap to Grid: Ajusta el cursor a la cuadrícula
   - Toggle Snap 45°: Restringe ángulos a múltiplos de 45°
   - Toggle Ruler: Activa herramienta de medición de distancias
   - Indicador de modo Reverse Drawing (reversa activa con Space)

4. **Control de Zoom**:
   - Botón Zoom In (+)
   - Botón Zoom Out (-)
   - Botón Reset Zoom (1:1)
   - Muestra el nivel de zoom actual (ej. "100%")

5. **Configuración Global**:
   - Botón de engranaje para abrir `OptionsPanel` con configuraciones de tapete, grid y robot
   - Control de velocidad de reproducción (playback speed)

**Características de UI**:
  - Diseño responsivo que colapsa o agrupa controles en pantallas pequeñas
  - Iconos SVG personalizados desde `icons.jsx`
  - Estados visuales claros (activo/inactivo, habilitado/deshabilitado)
  - Tooltips implícitos mediante aria-labels

#### `SectionsPanel.jsx`
**Panel lateral izquierdo para gestión de secciones de la misión.**

**Funcionalidades Principales**:

1. **Gestión de Secciones**:
   - Lista expandible/colapsable de todas las secciones
   - Botón "+" para añadir nuevas secciones
   - Selector de sección activa (resaltada)
   - Toggle de visibilidad (ojo) para cada sección
   - Input de nombre editable para cada sección
   - Selector de color para diferenciar visualmente las secciones

2. **Visualización de Acciones**:
   - Muestra la lista detallada de acciones (rotate, move) dentro de cada sección
   - Formato legible: "Girar +90°", "Avanzar 45.2 cm"
   - Numeración secuencial de acciones

3. **Edición Manual de Acciones**:
   - Inputs numéricos para modificar distancias y ángulos directamente
   - Validación en tiempo real de valores
   - Actualización de la trayectoria visual al cambiar valores

4. **Drag & Drop** (si implementado):
   - Reordenamiento de acciones dentro de una sección
   - Retroalimentación visual durante el arrastre

5. **Exportación e Importación**:
   - Botón "Exportar Misión": Guarda el estado completo en JSON
   - Input de archivo para importar misiones guardadas
   - Preserva toda la configuración (grid, robot, tapete, secciones)

**Estructura de Datos**:
Cada sección contiene:
```javascript
{
  id: "sec_xxx",
  name: "Sección 1",
  color: "#3b82f6",
  isVisible: true,
  points: [{x, y, heading, reverse, reference}, ...],
  actions: [{type: "rotate", angle: 90}, {type: "move", distance: 45.2}, ...]
}
```

#### `OptionsPanel.jsx`
**Panel modal/drawer de configuración global de la aplicación.**

**Secciones de Configuración**:

1. **Configuración de Tapete (Field)**:
   - Selector desplegable de tapetes oficiales:
     - WRO Future Engineers (2362x1143mm)
     - WRO Junior Elementary (1200x1200mm)
     - RoboCup Junior Soccer (2440x1830mm)
   - Botón de carga de imagen personalizada
   - Slider de opacidad del fondo (0-100%)

2. **Configuración de Cuadrícula (Grid)**:
   - Input de tamaño de celda (en cm o mm según unidad seleccionada)
   - Selector de color de líneas de cuadrícula
   - Slider de opacidad de líneas (alpha)
   - Inputs de offset X e Y para ajustar la posición del grid
   - Botón "Set Grid Origin": Permite hacer clic en el canvas para definir el origen

3. **Configuración del Robot**:
   - Inputs numéricos para largo y ancho del robot (en cm o mm)
   - Selector de color del robot
   - Slider de opacidad del robot
   - Botón de carga de imagen personalizada del robot (.png, .jpg)

4. **Configuración de Pose Inicial**:
   - Inputs numéricos para X, Y del robot
   - Input para ángulo inicial (theta) en grados
   - Visualización en tiempo real en el canvas

5. **Preferencias Globales**:
   - Toggle de unidades: Centímetros (cm) vs. Milímetros (mm)
   - Afecta todos los valores mostrados en la UI

**Interacción con el Canvas**:
  - Cambios en tiempo real: Al ajustar valores, el canvas se actualiza inmediatamente
  - Modal responsivo: Se puede cerrar haciendo clic fuera o con botón de cerrar
  - Validación de inputs: Previene valores negativos o fuera de rango

#### `icons.jsx`
**Componentes de iconos SVG reutilizables.**

Contiene iconos personalizados para:
- Controles de reproducción (Play, Pause, Stop)
- Herramientas (Regla, Cuadrícula, Ángulo)
- Estados (Visibilidad, Expandir/Colapsar)
- Acciones (Añadir, Eliminar, Configuración)

Cada icono es un componente React funcional que acepta props como `className`, `size`, `color` para personalización.

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
