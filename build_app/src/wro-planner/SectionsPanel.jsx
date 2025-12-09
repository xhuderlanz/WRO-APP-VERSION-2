import React, { useState } from "react";
import { IconChevronRight, IconChevronLeft, IconChevronDown, IconEye, IconEyeOff, IconGripVertical } from "./icons";
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

    const btnGradient = "bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500";

    if (isCollapsed) {
        return (
            <div className="h-full flex items-center justify-center p-2">
                <button onClick={() => setIsCollapsed(false)} className="p-3 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all">
                    <IconChevronRight className="w-5 h-5 text-gray-600" />
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">

            {/* Header */}
            <div className="shrink-0 p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Secciones</h2>
                        <p className="text-sm text-gray-400">Planificador WRO</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={addSection} className={`${btnGradient} text-white px-5 py-2.5 rounded-2xl font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all`}>
                            + Nueva
                        </button>
                        <button onClick={() => setIsCollapsed(true)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                            <IconChevronLeft className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sections List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {sections.map(s => {
                    const isExpanded = expandedSections.includes(s.id);
                    const isActive = selectedSectionId === s.id;

                    return (
                        <div
                            key={s.id}
                            onClick={() => setSelectedSectionId(s.id)}
                            className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden cursor-pointer ${isActive
                                    ? 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-100'
                                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                                }`}
                        >
                            {/* Section Header */}
                            <div className="flex items-center gap-3 p-4">
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSectionExpansion(s.id); }}
                                    className={`p-2 rounded-xl transition-all ${isActive ? 'bg-white shadow text-blue-500' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                >
                                    {isExpanded ? <IconChevronDown className="w-4 h-4" /> : <IconChevronRight className="w-4 h-4" />}
                                </button>

                                <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: s.color || '#3b82f6' }}></div>

                                <input
                                    className="flex-1 bg-transparent text-base font-semibold text-gray-800 focus:outline-none"
                                    value={s.name}
                                    onChange={e => setSections(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                                    onClick={e => e.stopPropagation()}
                                />

                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(s.id); }}
                                    className={`p-2 rounded-xl transition-all ${s.isVisible ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-300 hover:text-gray-500'}`}
                                >
                                    {s.isVisible ? <IconEye className="w-4 h-4" /> : <IconEyeOff className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Expanded Actions */}
                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-2 bg-gray-50/50">
                                    {/* Start info */}
                                    <div className="flex items-center gap-2 py-2">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Inicio:</span>
                                        <span className="text-xs font-mono bg-white px-2 py-1 rounded-lg border border-gray-100 text-gray-600">
                                            {(() => { const st = computePoseUpToSection(s.id); return `X:${pxToUnit(st.x).toFixed(1)} Y:${pxToUnit(st.y).toFixed(1)} θ:${Math.round(st.theta * RAD2DEG)}°`; })()}
                                        </span>
                                    </div>

                                    {s.actions.length === 0 ? (
                                        <div className="text-sm text-gray-400 italic py-4 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-white">
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
                                                    className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
                                                >
                                                    <IconGripVertical className="w-4 h-4 text-gray-300 cursor-grab" />

                                                    <div className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white ${isMove ? 'bg-blue-500' : btnGradient}`}>
                                                        {isMove ? 'MOV' : 'GIRO'}
                                                    </div>

                                                    <input
                                                        type="number"
                                                        className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                                        value={isMove ? (unit === 'mm' ? (a.distance * 10).toFixed(1) : a.distance.toFixed(2)) : a.angle}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const newActions = [...s.actions];
                                                            if (isMove) {
                                                                newActions[i] = { ...a, distance: unit === 'mm' ? val / 10 : val };
                                                            } else {
                                                                newActions[i] = { ...a, angle: val };
                                                            }
                                                            updateSectionActions(s.id, newActions);
                                                        }}
                                                    />

                                                    <span className="text-xs font-bold text-gray-400">{isMove ? unit : '°'}</span>

                                                    <button
                                                        onClick={() => { const arr = [...s.actions]; arr.splice(i, 1); updateSectionActions(s.id, arr); }}
                                                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
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
            </div>

            {/* Footer */}
            <div className="shrink-0 p-4 border-t border-gray-100 flex gap-3">
                <button onClick={exportMission} className="flex-1 py-3 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 rounded-2xl font-semibold transition-all">
                    Guardar
                </button>
                <label className={`flex-1 py-3 ${btnGradient} text-white rounded-2xl font-semibold text-center cursor-pointer shadow-lg hover:shadow-xl transition-all`}>
                    Cargar
                    <input type="file" accept="application/json" className="hidden" onChange={importMission} />
                </label>
            </div>
        </div>
    );
};

export default SectionsPanel;
