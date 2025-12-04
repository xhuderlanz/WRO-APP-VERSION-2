import React, { useState } from "react";
import { IconChevronRight, IconChevronLeft, IconChevronDown, IconEye, IconEyeOff, IconGripVertical } from "./icons";
import { RAD2DEG } from "./domain/constants";

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
                                                    <span className="text-xs font-medium text-slate-600">#{i + 1} {a.type === 'move' ? 'Avanzar' : 'Girar'}</span>
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

export default SectionsPanel;
