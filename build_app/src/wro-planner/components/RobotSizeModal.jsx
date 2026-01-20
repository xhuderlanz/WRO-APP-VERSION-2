import React, { useState, useEffect } from "react";
import RobotSizePreview from "./RobotSizePreview";

/**
 * Modal for configuring robot dimensions.
 * Uses internal draft state - only applies changes on save.
 */
const RobotSizeModal = ({ isOpen, robotConfig, onSave, unit = 'cm' }) => {
    // Internal draft state - changes here don't affect the app until save
    const [draft, setDraft] = useState({
        length: robotConfig?.length ?? 20,
        width: robotConfig?.width ?? 18,
        wheelOffset: robotConfig?.wheelOffset ?? 10
    });

    // Sync draft with robotConfig when modal opens
    useEffect(() => {
        if (isOpen && robotConfig) {
            setDraft({
                length: robotConfig.length ?? 20,
                width: robotConfig.width ?? 18,
                wheelOffset: robotConfig.wheelOffset ?? 10
            });
        }
    }, [isOpen, robotConfig]);

    // Handle escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                handleSave();
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, draft]);

    const handleChange = (field, value) => {
        const numValue = parseFloat(value) || 0;
        setDraft(prev => ({ ...prev, [field]: Math.max(0.1, numValue) }));
    };

    const handleSave = () => {
        if (onSave) {
            onSave({
                length: draft.length,
                width: draft.width,
                wheelOffset: draft.wheelOffset
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="robot-modal-backdrop" role="dialog" aria-modal="true">
            <div className="robot-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="robot-modal-header">
                    <h2 className="robot-modal-title">Configuración del Robot</h2>
                    <p className="robot-modal-subtitle">
                        Define las dimensiones de tu robot para planificar correctamente las trayectorias.
                    </p>
                </div>

                {/* Preview */}
                <div className="robot-modal-preview">
                    <RobotSizePreview
                        width={draft.width}
                        length={draft.length}
                        wheelOffset={draft.wheelOffset}
                        unit={unit}
                    />
                </div>

                {/* Inputs */}
                <div className="robot-modal-form">
                    <label className="robot-modal-field">
                        <span className="robot-modal-label">Largo ({unit})</span>
                        <input
                            type="number"
                            className="robot-modal-input"
                            value={draft.length}
                            min={0.1}
                            step={0.1}
                            onChange={(e) => handleChange('length', e.target.value)}
                        />
                        <span className="robot-modal-hint">Distancia de frente a parte trasera</span>
                    </label>

                    <label className="robot-modal-field">
                        <span className="robot-modal-label">Anchura ({unit})</span>
                        <input
                            type="number"
                            className="robot-modal-input"
                            value={draft.width}
                            min={0.1}
                            step={0.1}
                            onChange={(e) => handleChange('width', e.target.value)}
                        />
                        <span className="robot-modal-hint">Distancia de lado a lado</span>
                    </label>

                    <label className="robot-modal-field">
                        <span className="robot-modal-label">Distancia frontal a ruedas ({unit})</span>
                        <input
                            type="number"
                            className="robot-modal-input"
                            value={draft.wheelOffset}
                            min={0}
                            step={0.1}
                            onChange={(e) => handleChange('wheelOffset', e.target.value)}
                        />
                        <span className="robot-modal-hint">Desde el frente del robot hasta el eje de las ruedas</span>
                    </label>
                </div>

                {/* Actions */}
                <div className="robot-modal-actions">
                    <button
                        className="robot-modal-btn robot-modal-btn--primary"
                        onClick={handleSave}
                    >
                        Guardar y continuar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RobotSizeModal;
