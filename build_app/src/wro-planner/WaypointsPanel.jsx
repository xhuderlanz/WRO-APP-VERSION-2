/**
 * @fileoverview WaypointsPanel - Displays calculated instructions grouped by section
 * 
 * This component receives the flat waypoints array and calculated instructions,
 * then groups them visually by sectionId using an accordion-style UI.
 * 
 * Features:
 * - Accordion grouping by section
 * - Section color indicators
 * - Delete section functionality
 * - Instruction formatting (TURN/MOVE)
 * 
 * @module WaypointsPanel
 */

import React, { useState, useMemo } from "react";
import { IconChevronRight, IconChevronDown, IconTrash } from "./icons";
import "./WaypointsPanel.css";

/**
 * Groups instructions by their sectionId.
 * @param {Array} instructions - Flat list of instructions from pathCalculator
 * @param {Array} waypoints - Flat list of waypoints with section info
 * @returns {Array} Array of section groups with their instructions
 */
function groupInstructionsBySection(instructions, waypoints) {
    // Build a map of sectionId -> section metadata from waypoints
    const sectionMeta = {};
    for (const wp of waypoints) {
        if (wp.sectionId && !sectionMeta[wp.sectionId]) {
            sectionMeta[wp.sectionId] = {
                id: wp.sectionId,
                color: wp.sectionColor || '#888888',
                name: wp.sectionName || wp.sectionId
            };
        }
    }

    // Group instructions by sectionId
    const groups = {};
    const order = [];

    for (const instr of instructions) {
        const sectionId = instr.sectionId || 'default';

        if (!groups[sectionId]) {
            groups[sectionId] = {
                id: sectionId,
                color: sectionMeta[sectionId]?.color || '#888888',
                name: sectionMeta[sectionId]?.name || sectionId,
                instructions: []
            };
            order.push(sectionId);
        }

        groups[sectionId].instructions.push(instr);
    }

    // Return in order of appearance
    return order.map(id => groups[id]);
}

/**
 * Formats an instruction for display.
 * @param {Object} instr - Instruction object
 * @param {string} unit - Unit for distance ('cm' or 'mm')
 * @returns {Object} Formatted instruction data
 */
function formatInstruction(instr, unit = 'cm') {
    if (instr.type === 'TURN') {
        const direction = instr.value >= 0 ? 'Derecha' : 'Izquierda';
        const directionShort = instr.value >= 0 ? 'DER' : 'IZQ';
        return {
            typeLabel: 'GIRO',
            typeClass: 'turn',
            directionLabel: directionShort,
            value: Math.abs(instr.value).toFixed(1),
            unit: '°',
            description: `Girar ${direction} ${Math.abs(instr.value).toFixed(1)}°`
        };
    } else if (instr.type === 'MOVE') {
        const direction = instr.direction === 'reverse' ? 'Reversa' : 'Adelante';
        const directionShort = instr.direction === 'reverse' ? 'REV' : 'ADL';
        return {
            typeLabel: 'MOV',
            typeClass: instr.direction === 'reverse' ? 'reverse' : 'move',
            directionLabel: directionShort,
            value: instr.value.toFixed(1),
            unit: unit,
            description: `${direction} ${instr.value.toFixed(1)} ${unit}`
        };
    }
    return {
        typeLabel: '???',
        typeClass: 'unknown',
        value: '?',
        unit: '',
        description: 'Desconocido'
    };
}

/**
 * WaypointsPanel Component
 * 
 * Displays the calculated path instructions grouped by section in an accordion layout.
 * 
 * @param {Object} props
 * @param {Array} props.waypoints - Flat array of waypoints with section info
 * @param {Array} props.instructions - Array of TURN/MOVE instructions from pathCalculator
 * @param {Function} props.onDeleteSection - Callback when section delete is requested (sectionId) => void
 * @param {string} [props.unit='cm'] - Unit for distance display
 * @param {boolean} [props.isCollapsed=false] - Whether panel is collapsed
 * @param {Function} [props.setIsCollapsed] - Callback to toggle collapse state
 */
const WaypointsPanel = ({
    waypoints = [],
    instructions = [],
    onDeleteSection,
    unit = 'cm',
    isCollapsed = false,
    setIsCollapsed
}) => {
    // Track which sections are expanded
    const [expandedSections, setExpandedSections] = useState([]);

    // Group instructions by section
    const sectionGroups = useMemo(() => {
        return groupInstructionsBySection(instructions, waypoints);
    }, [instructions, waypoints]);

    // Toggle section expansion
    const toggleSection = (sectionId) => {
        setExpandedSections(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    // Handle section deletion with confirmation
    const handleDeleteSection = (sectionId, sectionName) => {
        if (!onDeleteSection) return;

        const confirmMessage = `¿Eliminar la sección "${sectionName}" y todos sus waypoints?`;
        if (window.confirm(confirmMessage)) {
            onDeleteSection(sectionId);
        }
    };

    // Calculate totals
    const totals = useMemo(() => {
        let totalDistance = 0;
        let totalRotation = 0;

        for (const instr of instructions) {
            if (instr.type === 'MOVE') {
                totalDistance += instr.value;
            } else if (instr.type === 'TURN') {
                totalRotation += Math.abs(instr.value);
            }
        }

        return { totalDistance, totalRotation };
    }, [instructions]);

    // Collapsed state - show expand button
    if (isCollapsed) {
        return (
            <div className="waypoints-panel waypoints-panel--collapsed">
                <button
                    onClick={() => setIsCollapsed && setIsCollapsed(false)}
                    className="waypoints-panel__expand-btn"
                    title="Expandir panel"
                >
                    <IconChevronRight style={{ width: 18, height: 18 }} />
                </button>
            </div>
        );
    }

    return (
        <div className="waypoints-panel">
            {/* Header */}
            <div className="waypoints-panel__header">
                <div className="waypoints-panel__header-left">
                    <h3 className="waypoints-panel__title">Instrucciones</h3>
                    {sectionGroups.length > 0 && (
                        <span className="waypoints-panel__badge">
                            {instructions.length}
                        </span>
                    )}
                </div>
                <div className="waypoints-panel__header-right">
                    {setIsCollapsed && (
                        <button
                            onClick={() => setIsCollapsed(true)}
                            className="waypoints-panel__collapse-btn"
                            title="Colapsar panel"
                        >
                            <IconChevronRight style={{ width: 14, height: 14, transform: 'rotate(180deg)' }} />
                        </button>
                    )}
                </div>
            </div>

            {/* Totals Summary */}
            {instructions.length > 0 && (
                <div className="waypoints-panel__summary">
                    <div className="waypoints-panel__summary-item">
                        <span className="waypoints-panel__summary-label">Distancia:</span>
                        <span className="waypoints-panel__summary-value">
                            {totals.totalDistance.toFixed(1)} {unit}
                        </span>
                    </div>
                    <div className="waypoints-panel__summary-item">
                        <span className="waypoints-panel__summary-label">Rotación:</span>
                        <span className="waypoints-panel__summary-value">
                            {totals.totalRotation.toFixed(1)}°
                        </span>
                    </div>
                </div>
            )}

            {/* Content - Section Groups */}
            <div className="waypoints-panel__content">
                {sectionGroups.length === 0 ? (
                    <div className="waypoints-panel__empty">
                        <div className="waypoints-panel__empty-icon">📍</div>
                        <p className="waypoints-panel__empty-title">Sin instrucciones</p>
                        <p className="waypoints-panel__empty-subtitle">
                            Añade waypoints al mapa para generar instrucciones
                        </p>
                    </div>
                ) : (
                    sectionGroups.map((section, sectionIndex) => {
                        const isExpanded = expandedSections.includes(section.id);
                        const canDelete = sectionGroups.length > 1 || section.instructions.length > 0;

                        return (
                            <div key={section.id} className="waypoints-section">
                                {/* Section Header */}
                                <div
                                    className="waypoints-section__header"
                                    onClick={() => toggleSection(section.id)}
                                >
                                    <button className="waypoints-section__expand-btn">
                                        {isExpanded
                                            ? <IconChevronDown style={{ width: 14, height: 14 }} />
                                            : <IconChevronRight style={{ width: 14, height: 14 }} />
                                        }
                                    </button>

                                    {/* Color indicator */}
                                    <div
                                        className="waypoints-section__color"
                                        style={{ backgroundColor: section.color }}
                                    />

                                    {/* Section name */}
                                    <span className="waypoints-section__name">
                                        {section.name}
                                    </span>

                                    {/* Instruction count */}
                                    <span className="waypoints-section__count">
                                        {section.instructions.length} cmd
                                    </span>

                                    {/* Delete button */}
                                    {onDeleteSection && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSection(section.id, section.name);
                                            }}
                                            className="waypoints-section__delete-btn"
                                            title="Eliminar sección"
                                        >
                                            <IconTrash style={{ width: 14, height: 14 }} />
                                        </button>
                                    )}
                                </div>

                                {/* Section Content - Instructions */}
                                {isExpanded && (
                                    <div className="waypoints-section__content">
                                        {section.instructions.map((instr, instrIndex) => {
                                            const formatted = formatInstruction(instr, unit);

                                            return (
                                                <div
                                                    key={`${section.id}-${instrIndex}`}
                                                    className="waypoints-instruction"
                                                >
                                                    <span className="waypoints-instruction__index">
                                                        {instrIndex + 1}
                                                    </span>

                                                    <span className={`waypoints-instruction__type waypoints-instruction__type--${formatted.typeClass}`}>
                                                        {formatted.typeLabel}
                                                    </span>

                                                    <span className="waypoints-instruction__direction">
                                                        {formatted.directionLabel}
                                                    </span>

                                                    <span className="waypoints-instruction__value">
                                                        {formatted.value}
                                                    </span>

                                                    <span className="waypoints-instruction__unit">
                                                        {formatted.unit}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default WaypointsPanel;

/* =====================================================================
 * HELPER FUNCTION FOR PARENT COMPONENT
 * =====================================================================
 * 
 * Put this in your main component (e.g., WROPlaybackPlanner.jsx):
 * 
 * ```javascript
 * // Helper function to delete a section by removing all its waypoints
 * const handleDeleteSection = useCallback((sectionId) => {
 *     setWaypoints(prevWaypoints => 
 *         prevWaypoints.filter(wp => wp.sectionId !== sectionId)
 *     );
 *     // The stateless recalculation will happen automatically
 *     // because the waypoints array changed, triggering useEffect/useMemo
 * }, []);
 * ```
 * 
 * Usage in JSX:
 * ```jsx
 * <WaypointsPanel
 *     waypoints={waypoints}
 *     instructions={calculatedInstructions}
 *     onDeleteSection={handleDeleteSection}
 *     unit={unit}
 * />
 * ```
 * ===================================================================== */

/**
 * Creates the handleDeleteSection helper for use in parent components.
 * This is a factory function that returns the handler.
 * 
 * @param {Function} setWaypoints - The setState function for waypoints
 * @returns {Function} The handleDeleteSection callback
 * 
 * @example
 * // In your parent component:
 * import { createDeleteSectionHandler } from './WaypointsPanel';
 * 
 * const [waypoints, setWaypoints] = useState([]);
 * const handleDeleteSection = createDeleteSectionHandler(setWaypoints);
 */
export function createDeleteSectionHandler(setWaypoints) {
    return function handleDeleteSection(sectionId) {
        setWaypoints(prevWaypoints =>
            prevWaypoints.filter(wp => wp.sectionId !== sectionId)
        );
    };
}
