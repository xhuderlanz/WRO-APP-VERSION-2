import React, { useState } from "react";
import { IconChevronRight, IconChevronLeft, IconChevronDown, IconEye, IconEyeOff, IconGripVertical, IconTrash } from "./icons";
import { RAD2DEG } from "./domain/constants";
import "./SectionsPanel.css";

const SectionsPanel = ({ sections, setSections, selectedSectionId, setSelectedSectionId, addSection, exportMission, importMission, updateSectionActions, computePoseUpToSection, pxToUnit, isCollapsed, setIsCollapsed, expandedSections, toggleSectionExpansion, toggleSectionVisibility, unit }) => {
    const [draggedAction, setDraggedAction] = useState(null);

    const handleActionDragStart = (e, sectionId, actionIndex) => {
        setDraggedAction({ sectionId, actionIndex });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleActionDragEnd = () => {
        setDraggedAction(null);
    };

    const handleActionDrop = (e, targetSectionId, targetActionIndex) => {
        e.preventDefault();
        e.stopPropagation();

        if (!draggedAction || draggedAction.sectionId !== targetSectionId) {
            setDraggedAction(null);
            return;
        }

        const fromIndex = draggedAction.actionIndex;
        const toIndex = targetActionIndex;

        // Same position - no change needed
        if (fromIndex === toIndex) {
            setDraggedAction(null);
            return;
        }

        const section = sections.find(s => s.id === targetSectionId);
        if (!section || !section.actions || section.actions.length === 0) {
            setDraggedAction(null);
            return;
        }

        // Create reordered array using standard array move algorithm
        const reordered = Array.from(section.actions);
        const [movedItem] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, movedItem);

        updateSectionActions(targetSectionId, reordered);
        setDraggedAction(null);
    };

    const deleteSection = (sectionId) => {
        if (sections.length <= 1) return;
        setSections(prev => prev.filter(s => s.id !== sectionId));
        if (selectedSectionId === sectionId) {
            const remaining = sections.filter(s => s.id !== sectionId);
            if (remaining.length > 0) setSelectedSectionId(remaining[0].id);
        }
    };

    // Collapsed state
    if (isCollapsed) {
        return (
            <div className="sections-panel" style={{ width: 'auto', minWidth: 48 }}>
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="option-action-button"
                        style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <IconChevronRight style={{ width: 18, height: 18 }} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="sections-panel">
            {/* Compact Header */}
            <div className="sections-panel__header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 className="sections-panel__title">Secciones</h3>
                        {sections.length > 0 && (
                            <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                color: '#6366f1',
                                background: 'rgba(99, 102, 241, 0.1)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '999px'
                            }}>
                                {sections.length}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button onClick={addSection} className="option-action-button" style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}>+ Nueva</button>
                        <button
                            onClick={() => setIsCollapsed(true)}
                            className="options-close-btn"
                            style={{ padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <IconChevronLeft style={{ width: 14, height: 14 }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content - Maximized */}
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
                                    {isExpanded ? <IconChevronDown style={{ width: 14, height: 14 }} /> : <IconChevronRight style={{ width: 14, height: 14 }} />}
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
                                />

                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(s.id); }}
                                    className="section-card__visibility-btn"
                                >
                                    {s.isVisible ? <IconEye style={{ width: 14, height: 14 }} /> : <IconEyeOff style={{ width: 14, height: 14 }} />}
                                </button>

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
                                    style={{ color: sections.length > 1 ? '#ef4444' : '#cbd5e1' }}
                                    title={sections.length > 1 ? 'Eliminar sección' : 'No se puede eliminar la única sección'}
                                >
                                    <IconTrash style={{ width: 14, height: 14 }} />
                                </button>
                            </div>

                            {/* Content */}
                            {isExpanded && (
                                <div className="section-card__content">
                                    <div className="section-card__start-info">
                                        <span className="section-card__start-label">INICIO</span>
                                        <span className="section-card__start-value">
                                            {(() => { const st = computePoseUpToSection(s.id); return `X: ${pxToUnit(st.x).toFixed(1)} | Y: ${pxToUnit(st.y).toFixed(1)} | θ: ${Math.round(st.theta * RAD2DEG)}°`; })()}
                                        </span>
                                    </div>

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
                                                    onDragEnd={handleActionDragEnd}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => handleActionDrop(e, s.id, i)}
                                                    className="action-item"
                                                >
                                                    <div className="action-item__drag">
                                                        <span>{i + 1}</span>
                                                        <IconGripVertical style={{ width: 12, height: 12 }} />
                                                    </div>

                                                    <span className={`action-item__type ${isMove ? 'action-item__type--move' : 'action-item__type--turn'}`}>
                                                        {isMove ? 'MOV' : 'GIRO'}
                                                    </span>

                                                    <input
                                                        key={`${s.id}-${i}-${a.type}-${isMove ? a.distance : a.angle}`}
                                                        type="number"
                                                        className="action-item__input"
                                                        defaultValue={isMove ? a.distance : a.angle}
                                                        onBlur={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            const finalVal = isNaN(val) ? 0 : val;
                                                            e.target.value = finalVal;
                                                            const newActions = [...s.actions];
                                                            if (isMove) {
                                                                newActions[i] = { ...a, distance: finalVal };
                                                            } else {
                                                                newActions[i] = { ...a, angle: finalVal };
                                                            }
                                                            updateSectionActions(s.id, newActions);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') e.target.blur();
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
                        <p style={{ fontWeight: 600, color: '#475569', margin: 0, fontSize: '0.85rem' }}>No hay secciones</p>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Crea una para empezar</p>
                    </div>
                )}
            </div>

            {/* Compact Footer */}
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
