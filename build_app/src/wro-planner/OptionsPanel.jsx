import React, { useEffect } from "react";
import { IconTarget } from "./icons";
import { FIELD_PRESETS, DEG2RAD, RAD2DEG } from "./domain/constants";

const OptionsPanel = ({
    showOptions, setShowOptions,
    fieldKey, setFieldKey,
    bgOpacity, setBgOpacity,
    grid, setGrid,
    robot, setRobot,
    initialPose, setInitialPose,
    handleBgUpload, handleRobotImageUpload,
    setIsSettingOrigin,
    unit, onToggleUnit,
    cursorGuideColor, setCursorGuideColor,
    cursorGuideLineWidth, setCursorGuideLineWidth,
    ghostRobotOpacity, setGhostRobotOpacity,
    robotImageRotation, setRobotImageRotation,
    preventCollisions, setPreventCollisions,
    collisionPadding, setCollisionPadding,
}) => {
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
        setGrid(g => ({ ...g, cellSize: Math.max(sizeMin, Math.min(sizeMax, value)) }));
    };

    const numericCellSize = grid.cellSize;
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
                                            onClick={onToggleUnit}
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
                            <div className="option-field">
                                <span className="option-field__label">Seguridad</span>
                                <div className="option-field__controls option-field__controls--single">
                                    <button
                                        type="button"
                                        className="option-chip-button"
                                        onClick={() => setPreventCollisions(!preventCollisions)}
                                        style={{
                                            backgroundColor: preventCollisions ? '#06b6d4' : '#e2e8f0',
                                            color: preventCollisions ? '#fff' : '#64748b',
                                            fontWeight: 600
                                        }}
                                    >
                                        {preventCollisions ? 'Prevenir colisiones: ON' : 'Prevenir colisiones: OFF'}
                                    </button>
                                </div>
                                <span className="option-field__hint">Impide añadir puntos que atraviesen obstáculos.</span>

                                {preventCollisions && (
                                    <div className="option-field" style={{ marginTop: '1rem' }}>
                                        <span className="option-field__label">Margen de colisión ({unit})</span>
                                        <div className="option-field__controls">
                                            <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                step={isMM ? 1 : 0.5}
                                                value={collisionPadding}
                                                onChange={e => setCollisionPadding(Math.max(0, parseFloat(e.target.value) || 0))}
                                                className="option-field__control"
                                                style={{
                                                    padding: '0.4rem',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '0.25rem',
                                                    width: '100%'
                                                }}
                                            />
                                        </div>
                                        <span className="option-field__hint">
                                            Zona de seguridad roja extra alrededor de obstáculos.
                                        </span>
                                    </div>
                                )}
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
                            <div className="option-field">
                                <span className="option-field__label">Color de líneas</span>
                                <input
                                    type="color"
                                    className="option-field__control option-field__control--color"
                                    value={(grid.color || '#ffffff').slice(0, 7)}
                                    onChange={e => setGrid(g => ({ ...g, color: e.target.value + (grid.color?.slice(7) || 'ff') }))}
                                />
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
                            <div className="option-divider" />
                            <div className="option-card__grid option-card__grid--two">
                                <div className="option-field">
                                    <span className="option-field__label">Color de guía del cursor</span>
                                    <input
                                        type="color"
                                        className="option-field__control option-field__control--color"
                                        value={(cursorGuideColor || '#ff0000').slice(0, 7)}
                                        onChange={e => setCursorGuideColor(e.target.value + (cursorGuideColor?.slice(7) || 'ff'))}
                                    />
                                </div>
                                <div className="option-field option-field--range">
                                    <div className="option-field__label">Grosor de línea</div>
                                    <div className="option-field__controls">
                                        <input
                                            type="range"
                                            min={1}
                                            max={5}
                                            step={1}
                                            value={cursorGuideLineWidth}
                                            onChange={e => setCursorGuideLineWidth(Number(e.target.value))}
                                        />
                                        <span className="option-field__value">{cursorGuideLineWidth}px</span>
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
                                    <span className="option-field__label">Distancia frontal a ruedas ({unit})</span>
                                    <input
                                        type="number"
                                        className="option-field__control"
                                        value={robot.wheelOffset ?? 0}
                                        onChange={e => setRobot(r => ({ ...r, wheelOffset: Number(e.target.value) || 0 }))}
                                    />
                                </label>
                                <label className="option-field">
                                    <span className="option-field__label">Color</span>
                                    <input
                                        type="color"
                                        className="option-field__control option-field__control--color"
                                        value={(robot.color || '#000000').slice(0, 7)}
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
                                <div className="option-field option-field--range">
                                    <div className="option-field__label">Rotación de imagen del robot</div>
                                    <span className="option-field__hint">Ajusta la orientación de la imagen del robot personalizada.</span>
                                    <div className="option-field__controls">
                                        <input
                                            type="range"
                                            min={0}
                                            max={360}
                                            step={1}
                                            value={robotImageRotation || 0}
                                            onChange={e => setRobotImageRotation(Number(e.target.value))}
                                        />
                                        <input
                                            type="number"
                                            min={0}
                                            max={360}
                                            step={1}
                                            className="option-number"
                                            value={robotImageRotation || 0}
                                            onChange={e => setRobotImageRotation(Number(e.target.value))}
                                        />
                                        <span className="option-field__value">°</span>
                                    </div>
                                </div>
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
                            <div className="option-field option-field--range">
                                <div className="option-field__label">Opacidad robot cursor (fantasma)</div>
                                <span className="option-field__hint">Ajusta la visibilidad del robot fantasma que sigue al cursor. Presiona "O" para alternar temporalmente a 100%.</span>
                                <div className="option-field__controls">
                                    <input
                                        type="range"
                                        min={0.1}
                                        max={1}
                                        step={0.05}
                                        value={ghostRobotOpacity}
                                        onChange={e => setGhostRobotOpacity(Number(e.target.value))}
                                    />
                                    <span className="option-field__value">{Math.round(ghostRobotOpacity * 100)}%</span>
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
                                    <span className="option-field__label">Posición X (mm)</span>
                                    <input
                                        type="number"
                                        className="option-field__control"
                                        value={Math.round(initialPose.x)}
                                        onChange={e => setInitialPose(p => ({ ...p, x: Number(e.target.value) }))}
                                    />
                                </label>
                                <label className="option-field">
                                    <span className="option-field__label">Posición Y (mm)</span>
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

export default OptionsPanel;
