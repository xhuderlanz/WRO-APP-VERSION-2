import React, { useState } from "react";
import { IconChevronRight, IconChevronLeft, IconChevronDown, IconEye, IconEyeOff, IconGripVertical, IconTrash } from "./icons";
import { RAD2DEG } from "./domain/constants";

const SectionsPanel = ({ sections, setSections, selectedSectionId, setSelectedSectionId, addSection, exportMission, importMission, updateSectionActions, computePoseUpToSection, pxToUnit, isCollapsed, setIsCollapsed, expandedSections, toggleSectionExpansion, toggleSectionVisibility, unit }) => {
    const [draggedAction, setDraggedAction] = useState(null);

    const handleActionDragStart = (e, sectionId, actionIndex) => {
        setDraggedAction({ sectionId, actionIndex });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleActionDrop = (e, targetSectionId, targetActionIndex) => {
        e.preventDefault();
        if (!draggedAction || draggedAction.sectionId !== targetSectionId) return;
        const section = sections.find(s => s.id === targetSectionId);
        if (!section) return;
        const reordered = [...section.actions];
        const [item] = reordered.splice(draggedAction.actionIndex, 1);
        reordered.splice(targetActionIndex, 0, item);
        updateSectionActions(targetSectionId, reordered);
    };

    const deleteSection = (sectionId) => {
        if (sections.length <= 1) return; // Don't delete the last section
        setSections(prev => prev.filter(s => s.id !== sectionId));
        if (selectedSectionId === sectionId) {
            const remaining = sections.filter(s => s.id !== sectionId);
            if (remaining.length > 0) setSelectedSectionId(remaining[0].id);
        }
    };

    // Collapsed state - show expand button
    if (isCollapsed) {
        return (
            <div className="sections-panel" style={{ width: 'auto', minWidth: 60 }}>
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="option-action-button"
                        style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <IconChevronRight style={{ width: 20, height: 20 }} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="sections-panel">
            {/* Header */}
            <div className="sections-panel__header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h3 className="sections-panel__title">Secciones</h3>
                        <p className="sections-panel__subtitle">Configura las rutas del robot para tu misión.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={addSection} className="option-action-button">+ Nueva</button>
                        <button
                            onClick={() => setIsCollapsed(true)}
                            className="options-close-btn"
                            style={{ padding: '0.5rem' }}
                        >
                            <IconChevronLeft style={{ width: 16, height: 16 }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Info */}
            {sections.length > 0 && (
                <div className="sections-panel__info">
                    <b>{sections.length}</b> {sections.length === 1 ? 'sección creada' : 'secciones creadas'}. Selecciona una para editarla.
                </div>
            )}

            {/* Content */}
            <div className="sections-panel__content">
                {sections.map(s => {
                    const isExpanded = expandedSections.includes(s.id);
                    const isActive = selectedSectionId === s.id;

                    return (
                        <div
                            key={s.id}
                            onClick={() => setSelectedSectionId(s.id)}
                            className={`section-card ${isActive ? 'section-card--active' : ''}`}
                        >
                            {/* Header */}
                            <div className="section-card__header">
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSectionExpansion(s.id); }}
                                    className="section-card__expand-btn"
                                >
                                    {isExpanded ? <IconChevronDown style={{ width: 16, height: 16 }} /> : <IconChevronRight style={{ width: 16, height: 16 }} />}
                                </button>

                                <div className="section-card__color" style={{ backgroundColor: s.color || '#6366f1' }}></div>

                                <input
                                    className="section-card__name"
                                    value={s.name}
                                    onChange={e => setSections(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                                    onClick={e => e.stopPropagation()}
                                    style={{ minWidth: 0 }}
                                />

                                <input
                                    type="color"
                                    className="option-field__control option-field__control--color"
                                    value={s.color || '#6366f1'}
                                    onChange={e => setSections(prev => prev.map(x => x.id === s.id ? { ...x, color: e.target.value } : x))}
                                    onClick={e => e.stopPropagation()}
                                    style={{ width: 28, height: 28 }}
                                />

                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(s.id); }}
                                    className="section-card__visibility-btn"
                                    style={{ flexShrink: 0 }}
                                >
                                    {s.isVisible ? <IconEye style={{ width: 16, height: 16 }} /> : <IconEyeOff style={{ width: 16, height: 16 }} />}
                                </button>

                                {/* DELETE SECTION BUTTON - always visible, rigid size */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (sections.length <= 1) {
                                            alert('No puedes eliminar la única sección');
                                            return;
                                        }
                                        if (window.confirm(`¿Eliminar "${s.name}"?`)) deleteSection(s.id);
                                    }}
                                    className="section-card__visibility-btn"
                                    style={{
                                        color: sections.length > 1 ? '#ef4444' : '#cbd5e1',
                                        flexShrink: 0,
                                        width: '2rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    title={sections.length > 1 ? 'Eliminar sección' : 'No se puede eliminar la única sección'}
                                >
                                    <IconTrash style={{ width: 16, height: 16 }} />
                                </button>
                            </div>

                            {/* Content */}
                            {isExpanded && (
                                <div className="section-card__content">
                                    <div className="section-card__start-info">
                                        <span className="section-card__start-label">Inicio</span>
                                        <span className="section-card__start-value">
                                            {(() => { const st = computePoseUpToSection(s.id); return `X: ${pxToUnit(st.x).toFixed(1)} | Y: ${pxToUnit(st.y).toFixed(1)} | θ: ${Math.round(st.theta * RAD2DEG)}°`; })()}
                                        </span>
                                    </div>

                                    {/* Removed redundant 'Acciones' label */}

                                    {s.actions.length === 0 ? (
                                        <div className="section-card__empty">
                                            Dibuja en el mapa para añadir acciones
                                        </div>
                                    ) : (
                                        s.actions.map((a, i) => {
                                            const isMove = a.type === 'move';
                                            return (
                                                <div
                                                    key={i}
                                                    draggable
                                                    onDragStart={(e) => handleActionDragStart(e, s.id, i)}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => handleActionDrop(e, s.id, i)}
                                                    className="action-item"
                                                >
                                                    <div className="action-item__drag">
                                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginRight: 6, minWidth: 14, textAlign: 'center' }}>{i + 1}</span>
                                                        <IconGripVertical style={{ width: 14, height: 14 }} />
                                                    </div>

                                                    <span className={`action-item__type ${isMove ? 'action-item__type--move' : 'action-item__type--turn'}`}>
                                                        {isMove ? 'MOV' : 'GIRO'}
                                                    </span>

                                                    <input
                                                        type="number"
                                                        className="action-item__input"
                                                        value={isMove ? (unit === 'mm' ? a.distance.toFixed(1) : a.distance.toFixed(2)) : a.angle}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const newActions = [...s.actions];
                                                            if (isMove) {
                                                                newActions[i] = { ...a, distance: val };
                                                            } else {
                                                                newActions[i] = { ...a, angle: val };
                                                            }
                                                            updateSectionActions(s.id, newActions);
                                                        }}
                                                    />

                                                    <span className="action-item__unit">{isMove ? unit : '°'}</span>

                                                    <button
                                                        onClick={() => { const arr = [...s.actions]; arr.splice(i, 1); updateSectionActions(s.id, arr); }}
                                                        className="action-item__delete"
                                                    >
                                                        ×
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

                {sections.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗺️</div>
                        <p style={{ fontWeight: 600, color: '#475569', margin: 0 }}>No hay secciones</p>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>Crea una para empezar a planificar</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="sections-panel__footer">
                <button onClick={exportMission} className="options-close-btn" style={{ flex: 1, justifyContent: 'center' }}>
                    Guardar
                </button>
                <label className="option-action-button" style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}>
                    Cargar
                    <input type="file" accept="application/json" style={{ display: 'none' }} onChange={importMission} />
                </label>
            </div>
        </div>
    );
};

export default SectionsPanel;
