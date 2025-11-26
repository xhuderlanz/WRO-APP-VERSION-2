import React, { useState, useRef, useCallback, useEffect } from "react";
import { IconRuler } from "./icons";

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

export default Toolbar;
