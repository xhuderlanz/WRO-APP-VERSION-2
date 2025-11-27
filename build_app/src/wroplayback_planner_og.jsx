import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import juniorFieldImg from "./assets/WRO-2025-GameMat-Junior2025.jpg";
import elementaryFieldImg from "./assets/WRO-2025-GameMat-Elementary2025.jpg";
import doubleTennisFieldImg from "./assets/WRO-2025_RoboSports_Double-Tennis_Playfield.jpg";


// WRO Mission Planner – Reproducción (v19 - Snap 45°)
// - Actualizado: el botón "Snap 45°" bloquea la dirección del siguiente segmento al múltiplo
//   de 45° más cercano (0°, 45°, 90°, ...), proyectando el punto sobre dicho eje.
// - Sin cambios en la lógica de snap a cuadrícula ni en el modo regla.

/** @typedef {{x:number, y:number}} Vec2 */
/** @typedef {{x:number, y:number, theta:number}} Pose */
/** @typedef {{type:'move', distance:number, reference?:'center'|'tip'} | {type:'rotate', angle:number}} Action */
/** @typedef {{id:string, name:string, points:Vec2[], actions:Action[], color?:string, isVisible:boolean}} Section */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const MAT_MM = { w: 2362, h: 1143 };
const MAT_CM = { w: MAT_MM.w / 10, h: MAT_MM.h / 10 };
const FIELD_PRESETS = [
    { key: "junior", name: "RoboMission Junior 2025", bg: juniorFieldImg },
    { key: "elementary", name: "RoboMission Elementary 2025", bg: elementaryFieldImg },
    { key: "double-tennis", name: "RoboSports Double Tennis 2025", bg: doubleTennisFieldImg },
    { key: "custom", name: "Personalizado", bg: null },
];
const DEFAULT_GRID = { cellSize: 1, pixelsPerUnit: 5, lineAlpha: 0.35, offsetX: 0, offsetY: 0 };
const DEFAULT_ROBOT = { width: 18, length: 20, color: "#0ea5e9", imageSrc: null, opacity: 1 };
const ZOOM_LIMITS = { min: 0.5, max: 2, step: 0.25 };
const SNAP_45_BASE_ANGLES = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];

const IconChevronLeft = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const IconChevronRight = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>;
const IconChevronDown = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
const IconGripVertical = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-slate-400"><circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" /></svg>;
const IconEye = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconEyeOff = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>;
const IconRuler = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L3 8.4a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0L15.3 21.3"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>;
const IconTarget = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;

const OptionsPanel = ({ showOptions, setShowOptions, fieldKey, setFieldKey, bgOpacity, setBgOpacity, grid, setGrid, robot, setRobot, initialPose, setInitialPose, handleBgUpload, handleRobotImageUpload, setIsSettingOrigin, unit, setUnit }) => {
    const isMM = unit === 'mm';
    const sizeMin = isMM ? 1 : 0.1;
    const sizeMax = isMM ? 50 : 5;
    const sliderStep = isMM ? 1 : 0.1;
    const numberStep = isMM ? 0.1 : 0.01;

    useEffect(() => {
        if (!showOptions) return undefined;
        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setShowOptions(false);
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [showOptions, setShowOptions]);

    const handleSizeChange = (valueStr) => {
        const value = parseFloat(valueStr) || 0;
        const cmValue = isMM ? value / 10 : value;
        setGrid(g => ({ ...g, cellSize: Math.max(0.1, Math.min(5, cmValue)) }));
    };

    const numericCellSize = isMM ? grid.cellSize * 10 : grid.cellSize;
    const formattedCellSize = isMM ? numericCellSize.toFixed(1) : numericCellSize.toFixed(2);

    return (
        <div className={`options-overlay ${showOptions ? 'options-overlay--visible' : ''}`} aria-hidden={!showOptions}>
            <div
                className="options-overlay__backdrop"
                onClick={() => setShowOptions(false)}
                role="presentation"
            />
            <div
                className="options-drawer"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="options-drawer__header">
                    <div>
                        <h3 className="options-drawer__title">Opciones</h3>
                        <p className="options-drawer__subtitle">Configura el tapete, la cuadrícula y el robot para organizar mejor tu planificación.</p>
                    </div>
                    <button className="options-close-btn" onClick={() => setShowOptions(false)}>Cerrar</button>
                </div>
                <div className="options-drawer__intro">El tapete se escala automáticamente a <b>2362mm × 1143mm</b>. Ajusta los controles para que coincida con tu entorno.</div>
                <div className="options-drawer__content">
                    <section className="option-section">
                        <header className="option-section__header">
                            <h4 className="option-section__title">Tapete</h4>
                            <p className="option-section__subtitle">Elige un tapete predefinido o sube una imagen personalizada.</p>
                        </header>
                        <div className="option-card">
                            <div className="option-card__grid option-card__grid--auto">
                                <label className="option-field">
                                    <span className="option-field__label">Tapete base</span>
                                    <select className="option-field__control" value={fieldKey} onChange={e => setFieldKey(e.target.value)}>
                                        {FIELD_PRESETS.map(p => (
                                            <option key={p.key} value={p.key}>{p.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="option-field option-field--file">
                                    <span className="option-field__label">Fondo personalizado</span>
                                    <span className="option-upload">
                                        <input type="file" accept="image/*" onChange={handleBgUpload} />
                                        <span className="option-upload__text">Subir imagen</span>
                                    </span>
                                    <span className="option-field__hint">Ideal para mapas escaneados o fotografías de tu tapete.</span>
                                </label>
                                <div className="option-field option-field--range">
                                    <div className="option-field__label">Opacidad del fondo</div>
                                    <div className="option-field__controls">
                                        <input type="range" min={0} max={1} step={0.05} value={bgOpacity} onChange={e => setBgOpacity(Number(e.target.value))} />
                                        <span className="option-field__value">{Math.round(bgOpacity * 100)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="option-section">
                        <header className="option-section__header">
                            <h4 className="option-section__title">Cuadrícula y unidades</h4>
                            <p className="option-section__subtitle">Controla la densidad de la cuadrícula y alinea el origen con tu referencia física.</p>
                        </header>
                        <div className="option-card">
                            <div className="option-card__grid option-card__grid--two">
                                <div className="option-field">
                                    <span className="option-field__label">Unidad de trabajo</span>
                                    <div className="option-field__controls option-field__controls--single">
                                        <button
                                            type="button"
                                            className="option-chip-button"
                                            onClick={() => setUnit(u => u === 'cm' ? 'mm' : 'cm')}
                                        >
                                            Mostrar en {unit === 'cm' ? 'milímetros' : 'centímetros'}
                                        </button>
                                    </div>
                                    <span className="option-field__hint">Actualmente estás introduciendo valores en {unit === 'cm' ? 'centímetros' : 'milímetros'}.</span>
                                </div>
                                <div className="option-field">
                                    <span className="option-field__label">Origen de coordenadas</span>
                                    <div className="option-field__controls option-field__controls--single">
                                        <button
                                            type="button"
                                            className="option-action-button"
                                            onClick={() => { setIsSettingOrigin(true); setShowOptions(false); }}
                                        >
                                            <IconTarget /> Fijar en el mapa
                                        </button>
                                    </div>
                                    <span className="option-field__hint">Pulsa sobre el tapete para definir dónde se ubica (0, 0).</span>
                                </div>
                            </div>
                            <div className="option-divider" />
                            <div className="option-field option-field--range">
                                <div className="option-field__label">Tamaño de celda</div>
                                <span className="option-field__hint">Cada cuadrícula representa {formattedCellSize} {unit}.</span>
                                <div className="option-field__controls">
                                    <input
                                        type="range"
                                        min={sizeMin}
                                        max={sizeMax}
                                        step={sliderStep}
                                        value={numericCellSize}
                                        onChange={e => handleSizeChange(e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        min={sizeMin}
                                        max={sizeMax}
                                        step={numberStep}
                                        className="option-number"
                                        value={Number(numericCellSize.toFixed(isMM ? 1 : 2))}
                                        onChange={e => handleSizeChange(e.target.value)}
                                    />
                                    <span className="option-field__value">{unit}</span>
                                </div>
                            </div>
                            <div className="option-field option-field--range">
                                <div className="option-field__label">Opacidad de líneas</div>
                                <div className="option-field__controls">
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={grid.lineAlpha}
                                        onChange={e => setGrid(g => ({ ...g, lineAlpha: Number(e.target.value) }))}
                                    />
                                    <span className="option-field__value">{Math.round(grid.lineAlpha * 100)}%</span>
                                </div>
                            </div>
                            <div className="option-card__grid option-card__grid--two">
                                <div className="option-field option-field--range">
                                    <div className="option-field__label">Offset X</div>
                                    <span className="option-field__hint">Desplaza la cuadrícula horizontalmente.</span>
                                    <div className="option-field__controls">
                                        <input
                                            type="range"
                                            min="-100"
                                            max="100"
                                            step="1"
                                            value={grid.offsetX}
                                            onChange={e => setGrid(g => ({ ...g, offsetX: Number(e.target.value) }))}
                                        />
                                        <input
                                            type="number"
                                            step="1"
                                            className="option-number"
                                            value={grid.offsetX}
                                            onChange={e => setGrid(g => ({ ...g, offsetX: Number(e.target.value) }))}
                                        />
                                        <span className="option-field__value">px</span>
                                    </div>
                                </div>
                                <div className="option-field option-field--range">
                                    <div className="option-field__label">Offset Y</div>
                                    <span className="option-field__hint">Desplaza la cuadrícula verticalmente.</span>
                                    <div className="option-field__controls">
                                        <input
                                            type="range"
                                            min="-100"
                                            max="100"
                                            step="1"
                                            value={grid.offsetY}
                                            onChange={e => setGrid(g => ({ ...g, offsetY: Number(e.target.value) }))}
                                        />
                                        <input
                                            type="number"
                                            step="1"
                                            className="option-number"
                                            value={grid.offsetY}
                                            onChange={e => setGrid(g => ({ ...g, offsetY: Number(e.target.value) }))}
                                        />
                                        <span className="option-field__value">px</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="option-section">
                        <header className="option-section__header">
                            <h4 className="option-section__title">Robot</h4>
                            <p className="option-section__subtitle">Define las dimensiones y apariencia del robot en pantalla.</p>
                        </header>
                        <div className="option-card">
                            <div className="option-card__grid option-card__grid--two">
                                <label className="option-field">
                                    <span className="option-field__label">Ancho (cm)</span>
                                    <input
                                        type="number"
                                        className="option-field__control"
                                        value={robot.width}
                                        onChange={e => setRobot(r => ({ ...r, width: Number(e.target.value) || 0 }))}
                                    />
                                </label>
                                <label className="option-field">
                                    <span className="option-field__label">Largo (cm)</span>
                                    <input
                                        type="number"
                                        className="option-field__control"
                                        value={robot.length}
                                        onChange={e => setRobot(r => ({ ...r, length: Number(e.target.value) || 0 }))}
                                    />
                                </label>
                                <label className="option-field">
                                    <span className="option-field__label">Color</span>
                                    <input
                                        type="color"
                                        className="option-field__control option-field__control--color"
                                        value={robot.color}
                                        onChange={e => setRobot(r => ({ ...r, color: e.target.value }))}
                                    />
                                </label>
                                <label className="option-field option-field--file">
                                    <span className="option-field__label">Imagen del robot</span>
                                    <span className="option-upload">
                                        <input type="file" accept="image/*" onChange={handleRobotImageUpload} />
                                        <span className="option-upload__text">Seleccionar archivo</span>
                                    </span>
                                    <span className="option-field__hint">Utiliza PNG con fondo transparente para mejores resultados.</span>
                                </label>
                            </div>
                            <div className="option-field option-field--range">
                                <div className="option-field__label">Opacidad del robot</div>
                                <div className="option-field__controls">
                                    <input
                                        type="range"
                                        min={0.1}
                                        max={1}
                                        step={0.05}
                                        value={robot.opacity ?? 1}
                                        onChange={e => setRobot(r => ({ ...r, opacity: Number(e.target.value) }))}
                                    />
                                    <span className="option-field__value">{Math.round((robot.opacity ?? 1) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="option-section">
                        <header className="option-section__header">
                            <h4 className="option-section__title">Posición inicial</h4>
                            <p className="option-section__subtitle">Ajusta la ubicación inicial del robot en el plano.</p>
                        </header>
                        <div className="option-card">
                            <div className="option-card__grid option-card__grid--three">
                                <label className="option-field">
                                    <span className="option-field__label">Posición X (px)</span>
                                    <input
                                        type="number"
                                        className="option-field__control"
                                        value={Math.round(initialPose.x)}
                                        onChange={e => setInitialPose(p => ({ ...p, x: Number(e.target.value) }))}
                                    />
                                </label>
                                <label className="option-field">
                                    <span className="option-field__label">Posición Y (px)</span>
                                    <input
                                        type="number"
                                        className="option-field__control"
                                        value={Math.round(initialPose.y)}
                                        onChange={e => setInitialPose(p => ({ ...p, y: Number(e.target.value) }))}
                                    />
                                </label>
                                <label className="option-field">
                                    <span className="option-field__label">Ángulo (°)</span>
                                    <input
                                        type="number"
                                        className="option-field__control"
                                        value={Math.round(initialPose.theta * RAD2DEG)}
                                        onChange={e => setInitialPose(p => ({ ...p, theta: Number(e.target.value) * DEG2RAD }))}
                                    />
                                </label>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

const SectionsPanel = ({ sections, setSections, selectedSectionId, setSelectedSectionId, addSection, exportMission, importMission, updateSectionActions, computePoseUpToSection, pxToUnit, isCollapsed, setIsCollapsed, expandedSections, toggleSectionExpansion, toggleSectionVisibility, unit }) => {
    const [draggedAction, setDraggedAction] = useState(null);

    const handleActionDragStart = (e, sectionId, actionIndex) => { setDraggedAction({ sectionId, actionIndex }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); };
    const handleActionDrop = (e, targetSectionId, targetActionIndex) => { e.preventDefault(); if (!draggedAction || draggedAction.sectionId !== targetSectionId) return; const { actionIndex: draggedIndex } = draggedAction; if (draggedIndex === targetActionIndex) return; const section = sections.find(s => s.id === targetSectionId); if (!section) return; const reorderedActions = [...section.actions]; const [draggedItem] = reorderedActions.splice(draggedIndex, 1); reorderedActions.splice(targetActionIndex, 0, draggedItem); updateSectionActions(targetSectionId, reorderedActions); };

    if (isCollapsed) {
        return (
            <div className="panel-card self-start flex items-center justify-center w-16 h-16">
                <button
                    onClick={() => setIsCollapsed(false)}
                    className="toolbar-btn toolbar-btn--muted"
                    title="Expandir Panel"
                >
                    <IconChevronRight />
                </button>
            </div>
        );
    }

    return (
        <div className="panel-card self-start">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-slate-700">Secciones</h2>
                <div className="flex items-center gap-2">
                    <button onClick={addSection} className="toolbar-btn toolbar-btn--emerald text-sm">+ Añadir</button>
                    <button onClick={() => setIsCollapsed(true)} className="toolbar-btn toolbar-btn--muted" title="Minimizar Panel">
                        <IconChevronLeft />
                    </button>
                </div>
            </div>
            <div className="section-scroll space-y-3">
                {sections.map(s => {
                    const isExpanded = expandedSections.includes(s.id);
                    return (
                        <div
                            key={s.id}
                            className={`section-card ${selectedSectionId === s.id ? 'section-card--active' : ''}`}
                            onClick={() => setSelectedSectionId(s.id)}
                        >
                            <div className="section-card__header px-3 py-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSectionExpansion(s.id); }}
                                    className="toolbar-btn toolbar-btn--muted px-2 py-1"
                                >
                                    {isExpanded ? <IconChevronDown /> : <IconChevronRight />}
                                </button>
                                <input
                                    className="flex-1 border border-slate-200/70 rounded-lg px-3 py-1 text-sm bg-white/80"
                                    value={s.name}
                                    onChange={e => setSections(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                                    onClick={e => e.stopPropagation()}
                                />
                                <input
                                    type="color"
                                    className="w-9 h-9 rounded-lg border border-slate-200/50"
                                    value={s.color || '#0ea5e9'}
                                    onChange={e => setSections(prev => prev.map(x => x.id === s.id ? { ...x, color: e.target.value } : x))}
                                    onClick={e => e.stopPropagation()}
                                />
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(s.id); }}
                                    className={`toolbar-btn px-2 py-1 ${s.isVisible ? 'toolbar-btn--muted' : 'toolbar-btn--muted opacity-40'}`}
                                >
                                    {s.isVisible ? <IconEye /> : <IconEyeOff />}
                                </button>
                            </div>
                            {isExpanded && (
                                <div className="section-card__content" onDrop={() => setDraggedAction(null)} onDragEnd={() => setDraggedAction(null)}>
                                    <div className="text-xs text-slate-500">Inicio: {(() => { const start = computePoseUpToSection(s.id); return `${pxToUnit(start.x).toFixed(1)}cm, ${pxToUnit(start.y).toFixed(1)}cm, ${Math.round(start.theta * RAD2DEG)}°`; })()}</div>
                                    <div className="text-xs text-slate-600 font-semibold">Acciones:</div>
                                    {s.actions.length === 0 ? (<div className="text-xs text-slate-500">Sin acciones. Dibuja para crear.</div>) : (
                                        s.actions.map((a, i) => {
                                            const isDragging = draggedAction?.sectionId === s.id && draggedAction?.actionIndex === i;
                                            return (
                                                <div
                                                    key={i}
                                                    draggable
                                                    onDragStart={(e) => handleActionDragStart(e, s.id, i)}
                                                    onDrop={(e) => handleActionDrop(e, s.id, i)}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    className={`section-card__actions ${isDragging ? 'opacity-60 border-dashed border-indigo-300' : 'border-slate-200/70'}`}
                                                >
                                                    <span className="cursor-move touch-none p-1 text-slate-400"><IconGripVertical /></span>
                                                    <span className="text-xs font-medium text-slate-600">{a.type === 'move' ? 'Avanzar' : 'Girar'}</span>
                                                    {a.type === 'move' ? (
                                                        <div className="section-card__field">
                                                            <label className="text-xs flex items-center gap-2">Dist ({unit})
                                                                <input
                                                                    type="number"
                                                                    step={unit === 'mm' ? 0.1 : 0.01}
                                                                    className="w-full border border-slate-200/80 rounded-lg px-2 py-1 text-slate-700 bg-white/80"
                                                                    value={unit === 'mm' ? (a.distance * 10).toFixed(1) : a.distance.toFixed(2)}
                                                                    onChange={e => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        const cmValue = unit === 'mm' ? val / 10 : val;
                                                                        const newActions = s.actions.map((act, idx) => (i === idx ? { ...act, distance: cmValue } : act));
                                                                        updateSectionActions(s.id, newActions);
                                                                    }}
                                                                />
                                                            </label>
                                                            <div className={`section-card__meta ${a.reference === 'tip' ? 'section-card__meta--tip' : 'section-card__meta--center'}`}>
                                                                {a.reference === 'tip' ? 'Medido desde la punta del robot' : 'Medido desde el centro de las ruedas'}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <label className="text-xs flex items-center gap-2">Ángulo (°)
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                className="w-full border border-slate-200/80 rounded-lg px-2 py-1 text-slate-700 bg-white/80"
                                                                value={a.angle}
                                                                onChange={e => {
                                                                    const newActions = s.actions.map((act, idx) => (i === idx ? { ...act, angle: parseFloat(e.target.value) || 0 } : act));
                                                                    updateSectionActions(s.id, newActions);
                                                                }}
                                                            />
                                                        </label>
                                                    )}
                                                    <button
                                                        onClick={() => { const newActions = s.actions.filter((_, idx) => idx !== i); updateSectionActions(s.id, newActions); }}
                                                        className="toolbar-btn toolbar-btn--rose px-2 py-1 text-[11px]"
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="pt-2 flex flex-wrap gap-2">
                <button onClick={exportMission} className="toolbar-btn toolbar-btn--amber text-sm">Guardar (.json)</button>
                <label className="toolbar-btn toolbar-btn--muted text-sm cursor-pointer">
                    Cargar
                    <input type="file" accept="application/json" className="hidden" onChange={importMission} />
                </label>
            </div>
        </div>
    );
};

const Toolbar = ({
    drawMode,
    setDrawMode,
    snap45,
    setSnap45,
    snapGrid,
    setSnapGrid,
    isRunning,
    isPaused,
    startMission,
    startMissionReverse,
    startSection,
    startSectionReverse,
    pauseResume,
    stopPlayback,
    setShowOptions,
    rulerActive,
    handleRulerToggle,
    reverseDrawing,
    onToggleReverse,
    referenceMode,
    onReferenceModeChange,
    zoom,
    onZoomIn,
    onZoomOut,
    onZoomReset,
}) => {
    const [quickMenu, setQuickMenu] = useState({ open: false, target: null, anchor: { x: 0, y: 0 } });
    const longPressTimerRef = useRef(null);
    const pointerStateRef = useRef({ pointerId: null, target: null, triggered: false });
    const ignoreClickRef = useRef(false);
    const LONG_PRESS_DELAY = 350;

    const closeQuickMenu = useCallback(() => {
        setQuickMenu({ open: false, target: null, anchor: { x: 0, y: 0 } });
    }, []);

    useEffect(() => {
        if (!quickMenu.open) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeQuickMenu();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [quickMenu.open, closeQuickMenu]);

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const triggerQuickMenu = useCallback((target, buttonElement) => {
        const rect = buttonElement.getBoundingClientRect();
        setQuickMenu({
            open: true,
            target,
            anchor: {
                x: rect.right + 12,
                y: rect.top + rect.height / 2,
            },
        });
    }, []);

    const handlePointerDown = useCallback((event, target) => {
        if (event.button !== 0) return;
        ignoreClickRef.current = false;
        pointerStateRef.current = { pointerId: event.pointerId, target, triggered: false };
        event.currentTarget.setPointerCapture(event.pointerId);
        clearLongPressTimer();
        longPressTimerRef.current = window.setTimeout(() => {
            ignoreClickRef.current = true;
            pointerStateRef.current = { pointerId: event.pointerId, target, triggered: true };
            triggerQuickMenu(target, event.currentTarget);
            longPressTimerRef.current = null;
        }, LONG_PRESS_DELAY);
    }, [triggerQuickMenu]);

    const handlePointerUp = useCallback((event, target) => {
        const state = pointerStateRef.current;
        if (state.pointerId !== event.pointerId || state.target !== target) {
            return;
        }
        event.currentTarget.releasePointerCapture(event.pointerId);
        pointerStateRef.current = { pointerId: null, target: null, triggered: false };
        clearLongPressTimer();
    }, []);

    const handlePointerCancel = useCallback((event) => {
        const state = pointerStateRef.current;
        if (state.pointerId !== event.pointerId) return;
        clearLongPressTimer();
        if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        pointerStateRef.current = { pointerId: null, target: null, triggered: false };
        ignoreClickRef.current = false;
    }, []);

    const handleClick = useCallback((event, onForward) => {
        if (ignoreClickRef.current) {
            ignoreClickRef.current = false;
            event.preventDefault();
            return;
        }
        onForward();
    }, []);

    const runForward = useCallback((target) => {
        if (target === 'mission') {
            startMission();
        } else {
            startSection();
        }
    }, [startMission, startSection]);

    const runReverse = useCallback((target) => {
        if (target === 'mission') {
            startMissionReverse();
        } else {
            startSectionReverse();
        }
        closeQuickMenu();
    }, [startMissionReverse, startSectionReverse, closeQuickMenu]);

    const handleQuickForward = useCallback((target) => {
        runForward(target);
        closeQuickMenu();
    }, [runForward, closeQuickMenu]);

    const handleSnapGridToggle = () => {
        const isTurningOn = !snapGrid;
        setSnapGrid(isTurningOn);
    };

    const handleSnap45Toggle = useCallback(() => {
        setSnap45(prev => !prev);
    }, [setSnap45]);

    const zoomLabel = Math.round(zoom * 100);

    return (
        <div className="toolbar-card sticky top-4 z-20">
            <button
                type="button"
                className={`toolbar-btn toolbar-reverse-btn ${reverseDrawing ? 'toolbar-reverse-btn--active' : ''}`}
                onClick={onToggleReverse}
                aria-pressed={reverseDrawing}
            >
                <span className="toolbar-reverse-label">Modo reversa</span>
                <span className="toolbar-reverse-state">{reverseDrawing ? 'Dibujando hacia atrás' : 'Dibujando hacia adelante'}</span>
                <span className="toolbar-reverse-chip">Espacio</span>
            </button>
            <div className="toolbar-group toolbar-group--measure">
                <span className="toolbar-group__label">Referencia</span>
                <div className="toolbar-segmented">
                    <button
                        type="button"
                        className={`toolbar-segmented__btn ${referenceMode === 'center' ? 'toolbar-segmented__btn--active' : ''}`}
                        onClick={() => onReferenceModeChange('center')}
                        aria-pressed={referenceMode === 'center'}
                    >
                        Centro ruedas
                    </button>
                    <button
                        type="button"
                        className={`toolbar-segmented__btn ${referenceMode === 'tip' ? 'toolbar-segmented__btn--active' : ''}`}
                        onClick={() => onReferenceModeChange('tip')}
                        aria-pressed={referenceMode === 'tip'}
                    >
                        Punta robot
                    </button>
                </div>
            </div>
            <button onClick={() => setDrawMode(d => !d)} className={`toolbar-btn w-28 ${drawMode ? 'toolbar-btn--emerald' : 'toolbar-btn--muted'}`}>
                {drawMode ? 'Dibujando' : 'Editando'}
            </button>
            <button onClick={handleRulerToggle} className={`toolbar-btn ${rulerActive ? 'toolbar-btn--rose' : 'toolbar-btn--muted'}`}>
                <IconRuler /> Regla
            </button>
            <button
                onClick={handleSnap45Toggle}
                className={`toolbar-btn ${snap45 ? 'toolbar-btn--indigo' : 'toolbar-btn--muted'}`}
                title="Bloquea la dirección en múltiplos de 45°"
            >
                Snap 45°
            </button>
            <button onClick={handleSnapGridToggle} className={`toolbar-btn ${snapGrid ? 'toolbar-btn--indigo' : 'toolbar-btn--muted'}`}>Snap Grid</button>
            <div className="toolbar-divider" />
            <button
                onPointerDown={(event) => handlePointerDown(event, 'mission')}
                onPointerUp={(event) => handlePointerUp(event, 'mission')}
                onPointerLeave={handlePointerCancel}
                onPointerCancel={handlePointerCancel}
                onClick={(event) => handleClick(event, startMission)}
                className="toolbar-btn toolbar-btn--sky"
            >
                Misión ▶
            </button>
            <button
                onPointerDown={(event) => handlePointerDown(event, 'section')}
                onPointerUp={(event) => handlePointerUp(event, 'section')}
                onPointerLeave={handlePointerCancel}
                onPointerCancel={handlePointerCancel}
                onClick={(event) => handleClick(event, startSection)}
                className="toolbar-btn toolbar-btn--indigo"
            >
                Sección ▶
            </button>
            <button onClick={pauseResume} disabled={!isRunning} className={`toolbar-btn ${isPaused ? 'toolbar-btn--emerald' : 'toolbar-btn--amber'}`}>{isPaused ? 'Reanudar' : 'Pausar'}</button>
            <button onClick={stopPlayback} disabled={!isRunning} className="toolbar-btn toolbar-btn--rose">Detener</button>
            <div className="toolbar-group toolbar-group--zoom">
                <span className="toolbar-group__label">Zoom</span>
                <div className="toolbar-zoom-control">
                    <button type="button" className="toolbar-zoom-btn" onClick={onZoomOut} aria-label="Alejar">−</button>
                    <span className="toolbar-zoom-value">{zoomLabel}%</span>
                    <button type="button" className="toolbar-zoom-btn" onClick={onZoomIn} aria-label="Acercar">+</button>
                    <button type="button" className="toolbar-zoom-reset" onClick={onZoomReset}>Restablecer</button>
                </div>
            </div>
            <div className="ml-auto flex items-center gap-2 text-sm">
                <button onClick={() => setShowOptions(true)} className="toolbar-btn toolbar-btn--slate">Opciones</button>
            </div>

            {quickMenu.open && (
                <div className="playback-menu" role="dialog" aria-modal="true">
                    <div className="playback-menu__backdrop" role="presentation" onClick={closeQuickMenu} />
                    <div
                        className={`playback-menu__panel playback-menu__panel--${quickMenu.target}`}
                        style={{ top: `${quickMenu.anchor.y}px`, left: `${quickMenu.anchor.x}px` }}
                    >
                        <div className="playback-menu__title">{quickMenu.target === 'mission' ? 'Reproducir misión' : 'Reproducir sección'}</div>
                        <div className="playback-menu__actions">
                            <button type="button" className="playback-menu__btn playback-menu__btn--forward" onClick={() => handleQuickForward(quickMenu.target)}>▶ Adelante</button>
                            <button type="button" className="playback-menu__btn playback-menu__btn--reverse" onClick={() => runReverse(quickMenu.target)}>◀ Reversa</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function WROPlaybackPlanner() {
    const [fieldKey, setFieldKey] = useState(FIELD_PRESETS[0].key);
    const [bgImage, setBgImage] = useState(null);
    const [bgOpacity, setBgOpacity] = useState(1);
    const [grid, setGrid] = useState({ ...DEFAULT_GRID });
    const [robot, setRobot] = useState({ ...DEFAULT_ROBOT });
    const [robotImgObj, setRobotImgObj] = useState(null);
    const [sections, setSections] = useState([{ id: uid('sec'), name: 'Sección 1', points: [], actions: [], color: DEFAULT_ROBOT.color, isVisible: true }]);
    const [selectedSectionId, setSelectedSectionId] = useState(sections[0].id);
    const [expandedSections, setExpandedSections] = useState([sections[0].id]);
    const [initialPose, setInitialPose] = useState({ x: 120, y: 120, theta: 0 });
    const [playPose, setPlayPose] = useState({ ...initialPose });
    const [drawMode, setDrawMode] = useState(true);
    const [snapGrid, setSnapGrid] = useState(true);
    const [snap45, setSnap45] = useState(false);
    const [ghost, setGhost] = useState({
        x: 0,
        y: 0,
        theta: 0,
        reference: 'center',
        displayX: 0,
        displayY: 0,
        originX: 0,
        originY: 0,
        active: false,
    });
    const [dragging, setDragging] = useState({ active: false, sectionId: null, index: -1 });
    const [hoverNode, setHoverNode] = useState({ sectionId: null, index: -1 });
    const [draggingStart, setDraggingStart] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [isSectionsPanelCollapsed, setIsSectionsPanelCollapsed] = useState(false);
    const [rulerActive, setRulerActive] = useState(false);
    const [rulerPoints, setRulerPoints] = useState({ start: null, end: null });
    const [isDraggingRuler, setIsDraggingRuler] = useState(false);
    const [isSettingOrigin, setIsSettingOrigin] = useState(false);
    const [unit, setUnit] = useState('cm');
    const [reverseDrawing, setReverseDrawing] = useState(false);
    const [referenceMode, setReferenceMode] = useState('center');
    const [zoom, setZoom] = useState(1);
    const [canvasBaseSize, setCanvasBaseSize] = useState({ width: 0, height: 0 });
    const [cursorGuide, setCursorGuide] = useState({ x: 0, y: 0, visible: false });
    const drawSessionRef = useRef({ active: false, lastPoint: null, addedDuringDrag: false });
    const drawThrottleRef = useRef({ lastAutoAddTs: 0 });
    const DRAW_STEP_MIN_PX = 6;
    const DRAW_AUTO_INTERVAL_MS = 340;

    const animRef = useRef(0);
    const actionCursorRef = useRef({ list: [], idx: 0, phase: 'idle', remainingPx: 0, remainingAngle: 0, moveDirection: 1 });
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const rightEraseTimerRef = useRef(null);
    const rightPressActiveRef = useRef(false);

    const currentSection = useMemo(() => sections.find(s => s.id === selectedSectionId) || sections[0], [sections, selectedSectionId]);

    const unitToPx = useCallback((d) => d * grid.pixelsPerUnit, [grid.pixelsPerUnit]);
    const pxToUnit = useCallback((px) => px / grid.pixelsPerUnit, [grid.pixelsPerUnit]);
    const normalizeAngle = useCallback((angle) => {
        let a = angle;
        while (a <= -Math.PI) a += 2 * Math.PI;
        while (a > Math.PI) a -= 2 * Math.PI;
        return a;
    }, []);

    const halfRobotLengthPx = useMemo(() => unitToPx(robot.length) / 2, [unitToPx, robot.length]);

    const getReferencePoint = useCallback((pose, reference) => {
        if (!pose) return { x: 0, y: 0 };
        if (reference === 'tip') {
            return {
                x: pose.x + Math.cos(pose.theta) * halfRobotLengthPx,
                y: pose.y + Math.sin(pose.theta) * halfRobotLengthPx,
            };
        }
        return { x: pose.x, y: pose.y };
    }, [halfRobotLengthPx]);

    const toggleReverseDrawing = useCallback(() => {
        setReverseDrawing(prev => !prev);
    }, []);

    const handleReferenceModeChange = useCallback((mode) => {
        setReferenceMode(mode === 'tip' ? 'tip' : 'center');
    }, []);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => {
            const next = Math.min(ZOOM_LIMITS.max, +(prev + ZOOM_LIMITS.step).toFixed(2));
            return next;
        });
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => {
            const next = Math.max(ZOOM_LIMITS.min, +(prev - ZOOM_LIMITS.step).toFixed(2));
            return next;
        });
    }, []);

    const handleZoomReset = useCallback(() => {
        setZoom(1);
    }, []);

    useEffect(() => {
        return () => {
            if (rightEraseTimerRef.current) {
                clearInterval(rightEraseTimerRef.current);
                rightEraseTimerRef.current = null;
            }
            rightPressActiveRef.current = false;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.repeat) return;
            if (event.code === 'Space' || event.key === ' ') {
                const target = event.target;
                const tagName = target?.tagName?.toLowerCase?.() ?? '';
                const isEditable = target?.isContentEditable;
                if (isEditable) return;
                if (['input', 'textarea', 'select', 'button'].includes(tagName)) return;
                event.preventDefault();
                toggleReverseDrawing();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleReverseDrawing]);

    useEffect(() => {
        drawSessionRef.current = { active: false, lastPoint: null, addedDuringDrag: false };
    }, [selectedSectionId]);

    useEffect(() => {
        if (!drawMode) {
            drawSessionRef.current = { active: false, lastPoint: null, addedDuringDrag: false };
        }
    }, [drawMode]);

    useEffect(() => {
        const base = 420;
        const min = 320;
        const zoomRange = Math.max(ZOOM_LIMITS.max - 1, 1);
        const ratio = zoom <= 1 ? 0 : Math.min((zoom - 1) / zoomRange, 1);
        const computed = base - (base - min) * ratio;
        const rootStyle = document.documentElement?.style;
        if (rootStyle) {
            rootStyle.setProperty('--panel-w', `${computed}px`);
        }
        return () => {
            if (rootStyle && !document.documentElement.contains(document.getElementById('root'))) {
                rootStyle.setProperty('--panel-w', `${base}px`);
            }
        };
    }, [zoom]);

    const computePoseUpToSection = useCallback((sectionId) => {
        let pose = { ...initialPose };
        for (const s of sections) {
            if (sectionId && s.id === sectionId) break;
            for (const act of s.actions) {
                if (act.type === 'rotate') { pose.theta = normalizeAngle(pose.theta + act.angle * DEG2RAD); }
                else { pose.x += Math.cos(pose.theta) * unitToPx(act.distance); pose.y += Math.sin(pose.theta) * unitToPx(act.distance); }
            }
        }
        return pose;
    }, [sections, initialPose, unitToPx, normalizeAngle]);

    const getPoseAfterActions = useCallback((startPose, actions) => {
        let pose = { ...startPose };
        for (const act of actions) {
            if (act.type === 'rotate') {
                pose.theta = normalizeAngle(pose.theta + act.angle * DEG2RAD);
            } else {
                const delta = unitToPx(act.distance);
                pose = {
                    x: pose.x + Math.cos(pose.theta) * delta,
                    y: pose.y + Math.sin(pose.theta) * delta,
                    theta: pose.theta,
                };
            }
        }
        return pose;
    }, [unitToPx, normalizeAngle]);

    const getLastPoseOfSection = useCallback((section) => {
        if (!section) return { ...initialPose };
        let pose = computePoseUpToSection(section.id);
        for (const pt of section.points || []) {
            const dx = pt.x - pose.x;
            const dy = pt.y - pose.y;
            const dist = Math.hypot(dx, dy);
            let nextTheta = typeof pt.heading === 'number' ? pt.heading : pose.theta;
            if (dist >= 1e-3) {
                const headingToPoint = Math.atan2(dy, dx);
                nextTheta = typeof pt.heading === 'number'
                    ? pt.heading
                    : normalizeAngle((pt.reverse ? headingToPoint + Math.PI : headingToPoint));
            }
            pose = { x: pt.x, y: pt.y, theta: nextTheta };
        }
        return pose;
    }, [computePoseUpToSection, normalizeAngle, initialPose]);

    const buildReversePlayback = useCallback((actions) => {
        const reversed = [];
        for (let i = actions.length - 1; i >= 0; i -= 1) {
            const act = actions[i];
            if (act.type === 'rotate') {
                const angle = Number((-act.angle).toFixed(2));
                if (Math.abs(angle) > 1e-3) {
                    reversed.push({ type: 'rotate', angle });
                }
            } else {
                const distance = Number((-act.distance).toFixed(2));
                if (Math.abs(distance) > 1e-3) {
                    reversed.push({ type: 'move', distance, reference: act.reference || 'center' });
                }
            }
        }
        return reversed;
    }, []);

    const buildActionsFromPolyline = useCallback((points, startPose) => {
        const acts = [];
        let prev = { ...startPose };
        for (const pt of points) {
            const dx = pt.x - prev.x;
            const dy = pt.y - prev.y;
            const distPx = Math.hypot(dx, dy);
            if (distPx < 1e-3) {
                prev = { ...prev, x: pt.x, y: pt.y };
                continue;
            }
            const segmentReverse = Boolean(pt.reverse);
            const segmentReference = pt.reference || 'center';
            const headingToPoint = Math.atan2(dy, dx);
            const storedHeading = typeof pt.heading === 'number'
                ? normalizeAngle(pt.heading)
                : normalizeAngle(headingToPoint + (segmentReverse ? Math.PI : 0));
            const targetHeading = storedHeading;
            const ang = normalizeAngle(targetHeading - prev.theta);
            const deg = ang * RAD2DEG;
            if (Math.abs(deg) > 1e-3) {
                acts.push({ type: 'rotate', angle: Number(deg.toFixed(2)) });
            }
            const cm = pxToUnit(distPx);
            if (cm > 1e-3) {
                const signed = segmentReverse ? -cm : cm;
                acts.push({ type: 'move', distance: Number(signed.toFixed(2)), reference: segmentReference });
            }
            prev = { x: pt.x, y: pt.y, theta: targetHeading };
        }
        return acts;
    }, [pxToUnit, normalizeAngle]);

    const pointsFromActions = useCallback((actions, startPose) => {
        const pts = [];
        let pose = { ...startPose };
        for (const a of actions) {
            if (a.type === 'rotate') {
                pose.theta = normalizeAngle(pose.theta + a.angle * DEG2RAD);
            } else {
                const direction = Math.sign(a.distance) || 1;
                const travelPx = unitToPx(Math.abs(a.distance));
                const dx = Math.cos(pose.theta) * travelPx * direction;
                const dy = Math.sin(pose.theta) * travelPx * direction;
                pose = {
                    x: pose.x + dx,
                    y: pose.y + dy,
                    theta: pose.theta,
                };
                pts.push({
                    x: pose.x,
                    y: pose.y,
                    reverse: a.distance < 0,
                    reference: a.reference || 'center',
                    heading: pose.theta,
                });
            }
        }
        return pts;
    }, [unitToPx, normalizeAngle]);

    const recalcAllFollowingSections = useCallback((allSections, changedSectionId) => {
        const changedIndex = allSections.findIndex(s => s.id === changedSectionId);
        if (changedIndex === -1) return allSections;

        const sectionsCopy = allSections.map(section => ({ ...section }));
        const advancePose = (start, actions) => {
            let pose = { ...start };
            for (const act of actions) {
                if (act.type === 'rotate') {
                    pose.theta += act.angle * DEG2RAD;
                } else {
                    const dx = Math.cos(pose.theta) * unitToPx(act.distance);
                    const dy = Math.sin(pose.theta) * unitToPx(act.distance);
                    pose = { x: pose.x + dx, y: pose.y + dy, theta: pose.theta };
                }
            }
            return pose;
        };

        let runningPose = { ...initialPose };

        for (let i = 0; i < sectionsCopy.length; i++) {
            const startPose = { ...runningPose };
            if (i >= changedIndex) {
                const newPoints = pointsFromActions(sectionsCopy[i].actions, startPose);
                sectionsCopy[i] = { ...sectionsCopy[i], points: newPoints };
            }
            runningPose = advancePose(startPose, sectionsCopy[i].actions);
        }

        return sectionsCopy;
    }, [initialPose, pointsFromActions, unitToPx]);

    const updateSectionActions = useCallback((sectionId, newActions) => {
        setSections(prev => {
            let newSections = prev.map(s => { if (s.id !== sectionId) return s; const start = computePoseUpToSection(s.id); const pts = pointsFromActions(newActions, start); return { ...s, actions: newActions, points: pts }; });
            return recalcAllFollowingSections(newSections, sectionId);
        });
    }, [computePoseUpToSection, pointsFromActions, recalcAllFollowingSections]);

    const recalcSectionFromPoints = useCallback((section) => {
        const start = computePoseUpToSection(section.id); const acts = buildActionsFromPolyline(section.points, start); return { ...section, actions: acts };
    }, [computePoseUpToSection, buildActionsFromPolyline]);

    const removeLastPointFromCurrentSection = useCallback(() => {
        if (!currentSection) return;
        setSections(prev => {
            let changed = false;
            const updated = prev.map(s => {
                if (s.id !== currentSection.id) return s;
                if (!s.points.length) return s;
                changed = true;
                const newPts = s.points.slice(0, -1);
                return recalcSectionFromPoints({ ...s, points: newPts });
            });
            if (!changed) return prev;
            return recalcAllFollowingSections(updated, currentSection.id);
        });
    }, [currentSection, recalcAllFollowingSections, recalcSectionFromPoints, setSections]);

    const projectPointWithReference = useCallback((rawPoint, anchorPose, reference, reverse = false) => {
        const anchorRefPoint = reference === 'tip'
            ? getReferencePoint(anchorPose, 'tip')
            : { x: anchorPose.x, y: anchorPose.y };

        const dx = rawPoint.x - anchorRefPoint.x;
        const dy = rawPoint.y - anchorRefPoint.y;
        let distanceRef = Math.hypot(dx, dy);
        if (distanceRef < 1e-6) {
            const thetaIdle = reverse ? normalizeAngle(anchorPose.theta + Math.PI) : anchorPose.theta;
            return {
                center: { x: anchorPose.x, y: anchorPose.y },
                theta: thetaIdle,
                distanceCenter: 0,
                referenceDistance: 0,
            };
        }

        let travelTheta = Math.atan2(dy, dx);
        if (snap45) {
            let bestMatch = null;
            for (const baseAngle of SNAP_45_BASE_ANGLES) {
                const ux = Math.cos(baseAngle);
                const uy = Math.sin(baseAngle);
                const projection = dx * ux + dy * uy;
                const projX = anchorRefPoint.x + ux * projection;
                const projY = anchorRefPoint.y + uy * projection;
                const error = Math.hypot(projX - rawPoint.x, projY - rawPoint.y);
                const thetaCandidate = projection >= 0 ? baseAngle : normalizeAngle(baseAngle + Math.PI);
                const distanceCandidate = Math.abs(projection);
                if (!bestMatch || error < bestMatch.error) {
                    bestMatch = { theta: thetaCandidate, distance: distanceCandidate, error };
                }
            }
            if (bestMatch) {
                travelTheta = bestMatch.theta;
                distanceRef = bestMatch.distance;
            }
        }

        const facingTheta = reverse ? normalizeAngle(travelTheta + Math.PI) : normalizeAngle(travelTheta);
        let centerX;
        let centerY;
        if (reference === 'tip') {
            const finalTipX = anchorRefPoint.x + Math.cos(travelTheta) * distanceRef;
            const finalTipY = anchorRefPoint.y + Math.sin(travelTheta) * distanceRef;
            centerX = finalTipX - Math.cos(facingTheta) * halfRobotLengthPx;
            centerY = finalTipY - Math.sin(facingTheta) * halfRobotLengthPx;
        } else {
            centerX = anchorPose.x + Math.cos(travelTheta) * distanceRef;
            centerY = anchorPose.y + Math.sin(travelTheta) * distanceRef;
        }

        const distanceCenter = Math.hypot(centerX - anchorPose.x, centerY - anchorPose.y);

        return {
            center: { x: centerX, y: centerY },
            theta: facingTheta,
            distanceCenter,
            referenceDistance: distanceRef,
        };
    }, [getReferencePoint, halfRobotLengthPx, normalizeAngle, snap45]);

    const drawRobot = useCallback((ctx, pose, isGhost = false) => {
        ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(pose.theta);
        const w = unitToPx(robot.width), l = unitToPx(robot.length);
        ctx.globalAlpha = (isGhost ? 0.5 : 1) * (robot.opacity ?? 1);
        if (robotImgObj) {
            ctx.drawImage(robotImgObj, -l / 2, -w / 2, l, w);
        } else {
            const wheelThickness = Math.max(unitToPx(1), Math.min(unitToPx(2), w * 0.32));
            const wheelLength = Math.max(l - unitToPx(4), l * 0.78);
            const wheelOffsetX = -wheelLength / 2;
            const wheelOffsetY = w / 2 + wheelThickness * 0.15;
            ctx.fillStyle = '#1f293b';
            ctx.fillRect(wheelOffsetX, -wheelOffsetY - wheelThickness, wheelLength, wheelThickness);
            ctx.fillRect(wheelOffsetX, wheelOffsetY, wheelLength, wheelThickness);

            ctx.fillStyle = robot.color;
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(-l / 2, -w / 2, l, w);
            ctx.fill();
            ctx.stroke();

            const noseInset = unitToPx(3);
            const noseHalf = Math.min(unitToPx(2), w * 0.35);
            ctx.beginPath();
            ctx.moveTo(l / 2, 0);
            ctx.lineTo(l / 2 - noseInset, noseHalf);
            ctx.lineTo(l / 2 - noseInset, -noseHalf);
            ctx.closePath();
            ctx.fillStyle = '#0f172a';
            ctx.fill();
        }
        ctx.restore();
    }, [robot, robotImgObj, unitToPx]);

    const draw = useCallback(() => {
        const cvs = canvasRef.current; if (!cvs) return; const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        if (bgImage) { ctx.save(); ctx.globalAlpha = bgOpacity; ctx.drawImage(bgImage, 0, 0, cvs.width, cvs.height); ctx.restore(); }
        const step = unitToPx(grid.cellSize);
        if (step > 0) {
            ctx.save(); ctx.globalAlpha = grid.lineAlpha; ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
            for (let x = grid.offsetX; x < cvs.width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cvs.height); ctx.stroke(); }
            for (let x = grid.offsetX - step; x > 0; x -= step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cvs.height); ctx.stroke(); }
            for (let y = grid.offsetY; y < cvs.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cvs.width, y); ctx.stroke(); }
            for (let y = grid.offsetY - step; y > 0; y -= step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cvs.width, y); ctx.stroke(); }
            ctx.restore();
        }
        
        sections.forEach(s => {
            if (s.isVisible === false || !s.points.length) return;
            let pose = computePoseUpToSection(s.id);
            s.points.forEach((pt) => {
                const reference = pt.reference || 'center';
                const startDisplay = getReferencePoint(pose, reference);
                const dx = pt.x - pose.x;
                const dy = pt.y - pose.y;
                const dist = Math.hypot(dx, dy);
                let segmentTheta = typeof pt.heading === 'number' ? pt.heading : pose.theta;
                if (dist >= 1e-3) {
                    const headingToPoint = Math.atan2(dy, dx);
                    segmentTheta = typeof pt.heading === 'number'
                        ? pt.heading
                        : normalizeAngle(pt.reverse ? headingToPoint + Math.PI : headingToPoint);
                }
                const endPose = { x: pt.x, y: pt.y, theta: segmentTheta };
                const endDisplay = getReferencePoint(endPose, reference);
                ctx.save();
                ctx.lineWidth = reference === 'tip' ? 3.5 : 3;
                ctx.strokeStyle = s.color || '#000';
                ctx.setLineDash(reference === 'tip' ? [12, 8] : []);
                ctx.beginPath();
                ctx.moveTo(startDisplay.x, startDisplay.y);
                ctx.lineTo(endDisplay.x, endDisplay.y);
                ctx.stroke();
                ctx.restore();
                pose = endPose;
            });
            if (!drawMode) {
                s.points.forEach((pt, i) => {
                    ctx.beginPath();
                    const isActive = (dragging.active && dragging.sectionId === s.id && dragging.index === i) || (hoverNode.sectionId === s.id && hoverNode.index === i);
                    const radius = isActive ? 6 : 4;
                    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = s.color || '#111827';
                    ctx.fill();
                    if (pt.reference === 'tip') {
                        ctx.strokeStyle = '#f97316';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                });
            }
        });
        
        ctx.save(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(grid.offsetX - 10, grid.offsetY); ctx.lineTo(grid.offsetX + 10, grid.offsetY); ctx.moveTo(grid.offsetX, grid.offsetY - 10); ctx.lineTo(grid.offsetX, grid.offsetY + 10); ctx.stroke(); ctx.restore();

        if (!isRunning && currentSection) {
            let finalPose = computePoseUpToSection(currentSection.id);
            for (const act of currentSection.actions) {
                if (act.type === 'rotate') { finalPose.theta += act.angle * DEG2RAD; }
                else { finalPose.x += Math.cos(finalPose.theta) * unitToPx(act.distance); finalPose.y += Math.sin(finalPose.theta) * unitToPx(act.distance); }
            }
            drawRobot(ctx, finalPose, false);
            if (drawMode && ghost.active) {
                const anchorPose = currentSection.points.length > 0
                    ? getLastPoseOfSection(currentSection)
                    : computePoseUpToSection(currentSection.id);
                const reference = ghost.reference || referenceMode;
                const fallbackOrigin = getReferencePoint(anchorPose, reference);
                const originX = Number.isFinite(ghost.originX) ? ghost.originX : fallbackOrigin.x;
                const originY = Number.isFinite(ghost.originY) ? ghost.originY : fallbackOrigin.y;
                const previewPose = { x: ghost.x, y: ghost.y, theta: ghost.theta };
                const previewPoint = getReferencePoint(previewPose, reference);
                ctx.save();
                ctx.setLineDash(reference === 'tip' ? [10, 6] : [8, 6]);
                ctx.strokeStyle = reference === 'tip' ? '#fb923c' : (currentSection.color || '#64748b');
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(originX, originY);
                ctx.lineTo(previewPoint.x, previewPoint.y);
                ctx.stroke();
                ctx.restore();
                drawRobot(ctx, previewPose, true);
            }
        }

        if (rulerActive && rulerPoints.start && rulerPoints.end) {
            ctx.save();
            ctx.strokeStyle = '#f43f5e'; ctx.fillStyle = '#f43f5e'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(rulerPoints.start.x, rulerPoints.start.y); ctx.lineTo(rulerPoints.end.x, rulerPoints.end.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(rulerPoints.start.x, rulerPoints.start.y, 4, 0, 2 * Math.PI); ctx.fill();
            ctx.beginPath(); ctx.arc(rulerPoints.end.x, rulerPoints.end.y, 4, 0, 2 * Math.PI); ctx.fill();
            const dx = rulerPoints.end.x - rulerPoints.start.x; const dy = rulerPoints.end.y - rulerPoints.start.y;
            const distPx = Math.hypot(dx, dy); const distCm = pxToUnit(distPx);
            const distLabel = unit === 'mm' ? `${(distCm * 10).toFixed(1)} mm` : `${distCm.toFixed(2)} cm`;
            const label = `${distLabel} (${dx.toFixed(0)}px, ${dy.toFixed(0)}px)`;
            const angle = Math.atan2(dy, dx); const textAngle = (angle > -Math.PI / 2 && angle < Math.PI / 2) ? angle : angle + Math.PI;
            const midX = rulerPoints.start.x + dx / 2; const midY = rulerPoints.start.y + dy / 2;
            ctx.font = 'bold 13px sans-serif'; const textMetrics = ctx.measureText(label);
            ctx.translate(midX, midY); ctx.rotate(textAngle);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.fillRect(-textMetrics.width / 2 - 4, -18, textMetrics.width + 8, 18);
            ctx.fillStyle = '#f43f5e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, -9);
            ctx.restore();
        }

        if (isRunning) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(5, 5, 120, 20); ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; const { idx, list } = actionCursorRef.current; ctx.fillText(`Acción ${idx + 1}/${list.length}`, 10, 18); ctx.restore(); drawRobot(ctx, playPose, false); }

        if (cursorGuide.visible) {
            ctx.save();
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(cursorGuide.x, 0);
            ctx.lineTo(cursorGuide.x, cvs.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, cursorGuide.y);
            ctx.lineTo(cvs.width, cursorGuide.y);
            ctx.stroke();
            ctx.restore();
        }
        ctx.save(); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(initialPose.x, initialPose.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }, [bgImage, bgOpacity, grid, sections, initialPose, drawMode, ghost, isRunning, playPose, dragging, hoverNode, unitToPx, computePoseUpToSection, drawRobot, currentSection, rulerActive, rulerPoints, pxToUnit, unit, getReferencePoint, getLastPoseOfSection, referenceMode, normalizeAngle, cursorGuide]);

    useEffect(() => { const preset = FIELD_PRESETS.find(p => p.key === fieldKey); if (!preset || !preset.bg) { setBgImage(null); return; } const img = new Image(); img.onload = () => setBgImage(img); img.src = preset.bg; }, [fieldKey]);
    useEffect(() => { if (!robot.imageSrc) { setRobotImgObj(null); return; } const img = new Image(); img.onload = () => setRobotImgObj(img); img.src = robot.imageSrc; }, [robot.imageSrc]);
    useEffect(() => {
        const handleResize = () => {
            const el = containerRef.current;
            const cvs = canvasRef.current;
            if (!el || !cvs) return;
            const r = el.getBoundingClientRect();
            const targetAspect = MAT_CM.w / MAT_CM.h;
            const cssW = Math.max(200, Math.floor(r.width));
            const cssH = Math.floor(cssW / targetAspect);
            cvs.width = cssW;
            cvs.height = cssH;
            setCanvasBaseSize({ width: cssW, height: cssH });
            setGrid(g => ({ ...g, pixelsPerUnit: cssW / MAT_CM.w }));
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setGrid]);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const { width, height } = canvasBaseSize;
        if (!width || !height) return;
        cvs.style.width = `${width * zoom}px`;
        cvs.style.height = `${height * zoom}px`;
    }, [canvasBaseSize, zoom]);
    useEffect(() => { const handleKeyDown = (e) => { if (e.key === 'Escape') { setDrawMode(false); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, []);
    useEffect(() => { draw(); }, [draw]);

    const canvasPos = (e, applySnapping = true) => {
        const canvasEl = canvasRef.current;
        const rect = canvasEl.getBoundingClientRect();
        const scaleX = rect.width > 0 ? (canvasEl.width / rect.width) : 1;
        const scaleY = rect.height > 0 ? (canvasEl.height / rect.height) : 1;
        let x = (e.clientX - rect.left) * scaleX;
        let y = (e.clientY - rect.top) * scaleY;
        if (snapGrid && applySnapping) {
            const step = unitToPx(grid.cellSize);
            x = Math.round((x - grid.offsetX) / step) * step + grid.offsetX;
            y = Math.round((y - grid.offsetY) / step) * step + grid.offsetY;
        }
        return { x, y };
    };

    const hitTestNode = (points, p, r = 8) => { for (let i = 0; i < points.length; i++) { if (Math.hypot(points[i].x - p.x, points[i].y - p.y) <= r) return i; } return -1; };
    
    const onCanvasDown = (e) => {
        if (isSettingOrigin) return;
        if (e.button === 2) {
            e.preventDefault();
            if (!drawMode || !currentSection) return;
            rightPressActiveRef.current = true;
            removeLastPointFromCurrentSection();
            clearInterval(rightEraseTimerRef.current);
            rightEraseTimerRef.current = window.setInterval(() => {
                if (rightPressActiveRef.current) {
                    removeLastPointFromCurrentSection();
                }
            }, 120);
            return;
        }
        if (rulerActive) {
            const p = canvasPos(e, false);
            setRulerPoints({ start: p, end: p });
            setIsDraggingRuler(true);
            return;
        }
        if (e.button !== 0) return;
        if (drawMode && currentSection) {
            const basePose = currentSection.points.length
                ? getLastPoseOfSection(currentSection)
                : computePoseUpToSection(currentSection.id);
            drawSessionRef.current = {
                active: true,
                lastPoint: { x: basePose.x, y: basePose.y, heading: basePose.theta },
                addedDuringDrag: false,
            };
            drawThrottleRef.current.lastAutoAddTs = 0;
            return;
        }
        if (drawMode) return;
        const p = canvasPos(e);
        if (Math.hypot(initialPose.x - p.x, initialPose.y - p.y) <= 10) { setDraggingStart(true); return; }
        if (currentSection) { const idx = hitTestNode(currentSection.points, p, 8); if (idx > -1) setDragging({ active: true, sectionId: currentSection.id, index: idx }); }
    };

    const onCanvasMove = (e) => {
        const rawPoint = canvasPos(e, false);
        setCursorGuide({ x: rawPoint.x, y: rawPoint.y, visible: true });

        if (!drawMode || !currentSection) {
            setGhost(prev => (prev.active ? { ...prev, active: false } : prev));
        }

        if (rulerActive && isDraggingRuler) {
            setRulerPoints(prev => ({ ...prev, end: rawPoint }));
            return;
        }

        const p = snapGrid ? canvasPos(e, true) : rawPoint;

        if (draggingStart) {
            setInitialPose(prev => ({ ...prev, x: p.x, y: p.y }));
            setSections(prev => {
                const newSections = prev.map(sec => recalcSectionFromPoints(sec));
                return recalcAllFollowingSections(newSections, prev[0].id);
            });
            return;
        }

        if (dragging.active) {
            setSections(prev => {
                const newSections = prev.map(s => {
                    if (s.id !== dragging.sectionId) return s;
                    const pts = s.points.map((pt, i) => i === dragging.index ? { ...pt, x: p.x, y: p.y } : pt);
                    return recalcSectionFromPoints({ ...s, points: pts });
                });
                return recalcAllFollowingSections(newSections, dragging.sectionId);
            });
            return;
        }

        if (!drawMode && currentSection) {
            const idx = hitTestNode(currentSection.points, p, 8);
            setHoverNode(idx > -1 ? { sectionId: currentSection.id, index: idx } : { sectionId: null, index: -1 });
            return;
        }

        if (drawMode && currentSection) {
            const segmentReference = referenceMode;
            const basePose = currentSection.points.length
                ? getLastPoseOfSection(currentSection)
                : computePoseUpToSection(currentSection.id);
            const activeSession = drawSessionRef.current.active;
            let anchorPose = basePose;
            if (activeSession && drawSessionRef.current.lastPoint) {
                const last = drawSessionRef.current.lastPoint;
                anchorPose = {
                    x: last.x,
                    y: last.y,
                    theta: typeof last.heading === 'number' ? last.heading : basePose.theta,
                };
            }

            const projection = projectPointWithReference(p, anchorPose, segmentReference, reverseDrawing);
            const previewPose = { x: projection.center.x, y: projection.center.y, theta: projection.theta };
            const anchorDisplay = getReferencePoint(anchorPose, segmentReference);
            const previewDisplay = getReferencePoint(previewPose, segmentReference);
            setGhost({
                x: previewPose.x,
                y: previewPose.y,
                theta: previewPose.theta,
                reference: segmentReference,
                displayX: previewDisplay.x,
                displayY: previewDisplay.y,
                originX: anchorDisplay.x,
                originY: anchorDisplay.y,
                active: true,
            });

            if (activeSession) {
                const dist = segmentReference === 'tip' ? projection.referenceDistance : projection.distanceCenter;
                if (dist >= DRAW_STEP_MIN_PX) {
                    const now = Date.now();
                    const last = drawThrottleRef.current.lastAutoAddTs;
                    if (now - last < DRAW_AUTO_INTERVAL_MS) {
                        return;
                    }
                    const centerPoint = projection.center;
                    setSections(prev => {
                        const updated = prev.map(s => {
                            if (s.id !== currentSection.id) return s;
                            const newPts = [...s.points, { ...centerPoint, reverse: reverseDrawing, reference: segmentReference, heading: projection.theta }];
                            return recalcSectionFromPoints({ ...s, points: newPts });
                        });
                        return recalcAllFollowingSections(updated, currentSection.id);
                    });
                    drawSessionRef.current = {
                        active: true,
                        lastPoint: { x: centerPoint.x, y: centerPoint.y, heading: projection.theta },
                        addedDuringDrag: true,
                    };
                    drawThrottleRef.current.lastAutoAddTs = now;
                }
            }
        }
    };

    const onCanvasUp = () => {
        rightPressActiveRef.current = false;
        if (rightEraseTimerRef.current) {
            clearInterval(rightEraseTimerRef.current);
            rightEraseTimerRef.current = null;
        }
        if (rulerActive) {
            setIsDraggingRuler(false);
            return;
        }
        setDraggingStart(false);
        setDragging({ active: false, sectionId: null, index: -1 });
        if (drawSessionRef.current.active) {
            drawSessionRef.current = { active: false, lastPoint: null, addedDuringDrag: drawSessionRef.current.addedDuringDrag };
        }
        drawThrottleRef.current.lastAutoAddTs = 0;
        setGhost(prev => (prev.active ? { ...prev, active: false } : prev));
    };

    const onCanvasLeave = () => {
        setCursorGuide(prev => ({ ...prev, visible: false }));
        onCanvasUp();
    };

    const onCanvasClick = (e) => {
        if (isSettingOrigin) {
            const p = canvasPos(e, false);
            setGrid(g => ({ ...g, offsetX: p.x, offsetY: p.y }));
            setIsSettingOrigin(false);
            return;
        }
        if (rulerActive) return;
        if (!drawMode || !currentSection) return;
        if (drawSessionRef.current.addedDuringDrag) {
            drawSessionRef.current = { active: false, lastPoint: null, addedDuringDrag: false };
            return;
        }
        const rawPoint = canvasPos(e, false);
        const p = snapGrid ? canvasPos(e, true) : rawPoint;
        const basePose = currentSection.points.length
            ? getLastPoseOfSection(currentSection)
            : computePoseUpToSection(currentSection.id);
        const segmentReference = referenceMode;
        const projection = projectPointWithReference(p, basePose, segmentReference, reverseDrawing); // apunta la punta al mouse y convierte al centro
        const centerPoint = projection.center;
        setSections(prev => {
            const updated = prev.map(s => {
                if (s.id !== currentSection.id) return s;
                const newPts = [...s.points, { ...centerPoint, reverse: reverseDrawing, reference: segmentReference, heading: projection.theta }];
                return recalcSectionFromPoints({ ...s, points: newPts });
            });
            return recalcAllFollowingSections(updated, currentSection.id);
        });
        drawSessionRef.current = { active: false, lastPoint: null, addedDuringDrag: false };
        drawThrottleRef.current.lastAutoAddTs = Date.now();
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
    };

    const stopPlayback = useCallback(() => {
        cancelAnimationFrame(animRef.current);
        setIsRunning(false);
        setIsPaused(false);
        actionCursorRef.current = { list: [], idx: 0, phase: 'idle', remainingPx: 0, remainingAngle: 0, moveDirection: 1 };
        setPlayPose({ ...initialPose });
    }, [initialPose]);
    const tick = useCallback(() => {
        if (isPaused) { animRef.current = requestAnimationFrame(tick); return; }
        const ac = actionCursorRef.current;
        if (ac.idx >= ac.list.length) { stopPlayback(); return; }
        const a = ac.list[ac.idx];
        const rotStep = 5 * DEG2RAD;
        const speedPx = unitToPx(40) / 60;
        setPlayPose(prev => {
            let pose = { ...prev };
            if (a.type === 'rotate') {
                if (ac.phase !== 'rotate') {
                    ac.phase = 'rotate';
                    ac.remainingAngle = a.angle * DEG2RAD;
                }
                const remaining = ac.remainingAngle;
                if (Math.abs(remaining) < 1e-3) {
                    ac.phase = 'idle';
                    ac.idx++;
                    return pose;
                }
                const step = Math.sign(remaining) * Math.min(Math.abs(remaining), rotStep);
                pose.theta += step;
                ac.remainingAngle -= step;
                if (Math.abs(ac.remainingAngle) < 1e-3) {
                    ac.phase = 'idle';
                    ac.idx++;
                }
            } else {
                if (ac.phase !== 'move') {
                    ac.phase = 'move';
                    ac.remainingPx = unitToPx(Math.abs(a.distance));
                    ac.moveDirection = Math.sign(a.distance) || 1;
                }
                const remainingPx = ac.remainingPx ?? 0;
                if (remainingPx < 1e-3) {
                    ac.phase = 'idle';
                    ac.idx++;
                    return pose;
                }
                const step = Math.min(speedPx, remainingPx);
                const direction = ac.moveDirection ?? 1;
                pose.x += Math.cos(pose.theta) * step * direction;
                pose.y += Math.sin(pose.theta) * step * direction;
                ac.remainingPx = remainingPx - step;
                if ((ac.remainingPx ?? 0) < 1e-3) {
                    ac.phase = 'idle';
                    ac.idx++;
                }
            }
            return pose;
        });
        animRef.current = requestAnimationFrame(tick);
    }, [isPaused, stopPlayback, unitToPx]);
    const startPlayback = useCallback((list, startPose) => {
        if (!list.length) return;
        cancelAnimationFrame(animRef.current);
        setIsRunning(true);
        setIsPaused(false);
        actionCursorRef.current = { list: [...list], idx: 0, phase: 'idle', remainingPx: 0, remainingAngle: 0, moveDirection: 1 };
        setPlayPose({ ...startPose });
        animRef.current = requestAnimationFrame(tick);
    }, [tick]);

    const startMission = useCallback(() => {
        const list = sections.flatMap(s => s.actions);
        startPlayback(list, initialPose);
    }, [sections, initialPose, startPlayback]);

    const startMissionReverse = useCallback(() => {
        const list = sections.flatMap(s => s.actions);
        if (!list.length) return;
        const endPose = getPoseAfterActions(initialPose, list);
        const reverseList = buildReversePlayback(list);
        if (!reverseList.length) return;
        startPlayback(reverseList, endPose);
    }, [sections, initialPose, getPoseAfterActions, buildReversePlayback, startPlayback]);

    const startSection = useCallback(() => {
        if (!currentSection) return;
        const startPose = computePoseUpToSection(currentSection.id);
        startPlayback(currentSection.actions, startPose);
    }, [currentSection, computePoseUpToSection, startPlayback]);

    const startSectionReverse = useCallback(() => {
        if (!currentSection) return;
        const forwardList = currentSection.actions;
        if (!forwardList.length) return;
        const startPose = computePoseUpToSection(currentSection.id);
        const endPose = getPoseAfterActions(startPose, forwardList);
        const reverseList = buildReversePlayback(forwardList);
        if (!reverseList.length) return;
        startPlayback(reverseList, endPose);
    }, [currentSection, computePoseUpToSection, getPoseAfterActions, buildReversePlayback, startPlayback]);

    const pauseResume = () => { if (!isRunning) return; setIsPaused(p => !p); };

    const handleRulerToggle = () => {
        const isTurningOn = !rulerActive;
        setRulerActive(isTurningOn);
        if (isTurningOn) {
            setDrawMode(false);
        } else {
            setRulerPoints({ start: null, end: null });
        }
    };
    const addSection = () => { const id = uid('sec'); const lastSectionColor = sections.length > 0 ? sections[sections.length - 1].color : robot.color; const newSec = { id, name: `Sección ${sections.length + 1}`, points: [], actions: [], color: lastSectionColor, isVisible: true }; setSections(prev => [...prev, newSec]); setSelectedSectionId(id); setExpandedSections(prev => [...prev, id]); setDrawMode(true); };
    const toggleSectionExpansion = (id) => { setExpandedSections(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]); };
    const toggleSectionVisibility = (id) => { setSections(secs => secs.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s)); };
    const handleBgUpload = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => setBgImage(img); img.src = r.result; }; r.readAsDataURL(f); };
    const handleRobotImageUpload = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setRobot(rbt => ({ ...rbt, imageSrc: r.result })); r.readAsDataURL(f); };
    const exportMission = () => { const payload = { fieldKey, grid: { ...grid, cellSize: grid.cellSize }, robot: { ...robot, imageSrc: null }, initialPose, sections, bgOpacity }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `wro_mission_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`; a.click(); URL.revokeObjectURL(url); };
    const importMission = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const data = JSON.parse(r.result); if (Array.isArray(data.sections)) setSections(data.sections.map(s => ({...s, isVisible: s.isVisible !== false}))); if (data.initialPose) setInitialPose(data.initialPose); if (data.robot) setRobot(prev => ({ ...prev, ...data.robot })); if (data.grid) setGrid(prev => ({ ...prev, ...data.grid })); if (data.fieldKey) setFieldKey(data.fieldKey); if (typeof data.bgOpacity === 'number') setBgOpacity(data.bgOpacity); } catch (err) { console.error('Invalid mission file', err); alert('No se pudo importar: archivo inválido'); } }; r.readAsText(f); };
    
    return (
        <div className="w-full h-full min-h-screen">
            <main className="app-shell">
                <Toolbar
                    {...{
                        drawMode,
                        setDrawMode,
                        snap45,
                        setSnap45,
                        snapGrid,
                        setSnapGrid,
                        isRunning,
                        isPaused,
                        startMission,
                        startMissionReverse,
                        startSection,
                        startSectionReverse,
                        pauseResume,
                        stopPlayback,
                        setShowOptions,
                        rulerActive,
                        handleRulerToggle,
                        reverseDrawing,
                        onToggleReverse: toggleReverseDrawing,
                        referenceMode,
                        onReferenceModeChange: handleReferenceModeChange,
                        zoom,
                        onZoomIn: handleZoomIn,
                        onZoomOut: handleZoomOut,
                        onZoomReset: handleZoomReset,
                    }}
                />

                <div className="main-grid">
                    {/* PANEL IZQUIERDO (card) */}
                    <aside className="left-panel">
                        <div className="sections-list">
                            <SectionsPanel {...{ sections, setSections, selectedSectionId, setSelectedSectionId, addSection, exportMission, importMission, updateSectionActions, computePoseUpToSection, pxToUnit, isCollapsed: isSectionsPanelCollapsed, setIsCollapsed: setIsSectionsPanelCollapsed, expandedSections, toggleSectionExpansion, toggleSectionVisibility, unit }} />
                        </div>
                    </aside>

                    {/* AREA DEL CANVAS (card limpia) */}
                    <section className="canvas-card" aria-label="Canvas">
                        <div className="canvas-board" ref={containerRef}>
                            <canvas
                                ref={canvasRef}
                                onMouseMove={onCanvasMove}
                                onMouseDown={onCanvasDown}
                                onMouseUp={onCanvasUp}
                                onMouseLeave={onCanvasLeave}
                                onClick={onCanvasClick}
                                onContextMenu={handleContextMenu}
                                className={`canvas-surface ${isSettingOrigin ? 'cursor-copy' : 'cursor-crosshair'}`}
                            />
                        </div>
                        <div className="canvas-legend" aria-hidden="true">
                            <div className="canvas-legend__item">
                                <span className="canvas-legend__swatch canvas-legend__swatch--center" />
                                <span>Centro de ruedas</span>
                            </div>
                            <div className="canvas-legend__item">
                                <span className="canvas-legend__swatch canvas-legend__swatch--tip" />
                                <span>Punta del robot</span>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <OptionsPanel {...{ showOptions, setShowOptions, fieldKey, setFieldKey, bgOpacity, setBgOpacity, grid, setGrid, robot, setRobot, initialPose, setInitialPose, handleBgUpload, handleRobotImageUpload, setIsSettingOrigin, unit, setUnit }} />

            <footer className="footer-note">Dimensiones del tapete: 2362mm × 1143mm.</footer>
        </div>
    );
}
