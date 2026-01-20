import React, { useState, useRef, useCallback, useEffect } from "react";
import { IconRuler, IconTarget } from "./icons";
import useBreakpoint from "./hooks/useBreakpoint";
import "./TopBar.css";

const TopBar = ({
    drawMode, setDrawMode, snap45, setSnap45,
    isRunning, isPaused, startMission, startMissionReverse, startSection, startSectionReverse,
    pauseResume, stopPlayback, setShowOptions, rulerActive, handleRulerToggle,
    reverseDrawing, onToggleReverse, referenceMode, onReferenceModeChange,
    zoom, onZoomIn, onZoomOut, onZoomReset, playbackSpeed, setPlaybackSpeed,
    onOpenShortcuts,
    onAddObstacle,
}) => {
    const [quickMenu, setQuickMenu] = useState({ open: false, target: null, anchor: { x: 0, y: 0 } });
    const [hamburgerOpen, setHamburgerOpen] = useState(false);
    const longPressTimerRef = useRef(null);
    const pointerStateRef = useRef({ pointerId: null, target: null, triggered: false });
    const ignoreClickRef = useRef(false);

    const breakpoint = useBreakpoint();

    const closeQuickMenu = useCallback(() => setQuickMenu({ open: false, target: null, anchor: { x: 0, y: 0 } }), []);
    const closeHamburger = useCallback(() => setHamburgerOpen(false), []);

    // Close hamburger menu on breakpoint change to desktop
    useEffect(() => {
        if (breakpoint !== 'collapsed') {
            setHamburgerOpen(false);
        }
    }, [breakpoint]);

    // Close hamburger menu on ESC key
    useEffect(() => {
        if (!hamburgerOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') closeHamburger();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hamburgerOpen, closeHamburger]);

    useEffect(() => {
        if (!quickMenu.open) return;
        const handleKeyDown = (e) => e.key === 'Escape' && closeQuickMenu();
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [quickMenu.open, closeQuickMenu]);

    const clearLongPressTimer = () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };

    const triggerQuickMenu = useCallback((target, el) => {
        const rect = el.getBoundingClientRect();
        setQuickMenu({ open: true, target, anchor: { x: rect.left + rect.width / 2 - 100, y: rect.bottom + 12 } });
    }, []);

    const handlePointerDown = useCallback((e, target) => {
        if (e.button !== 0) return;
        ignoreClickRef.current = false;
        pointerStateRef.current = { pointerId: e.pointerId, target, triggered: false };
        e.currentTarget.setPointerCapture(e.pointerId);
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
            ignoreClickRef.current = true;
            pointerStateRef.current = { ...pointerStateRef.current, triggered: true };
            triggerQuickMenu(target, e.currentTarget);
            longPressTimerRef.current = null;
        }, 350);
    }, [triggerQuickMenu]);

    const handlePointerUp = useCallback((e, target) => {
        if (pointerStateRef.current.pointerId !== e.pointerId || pointerStateRef.current.target !== target) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        pointerStateRef.current = { pointerId: null, target: null, triggered: false };
        clearLongPressTimer();
    }, []);

    const handlePointerCancel = useCallback((e) => {
        if (pointerStateRef.current.pointerId !== e.pointerId) return;
        clearLongPressTimer();
        if (e.currentTarget?.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        pointerStateRef.current = { pointerId: null, target: null, triggered: false };
        ignoreClickRef.current = false;
    }, []);

    const handleClick = useCallback((e, fn) => { if (ignoreClickRef.current) { ignoreClickRef.current = false; e.preventDefault(); return; } fn(); }, []);
    const runForward = useCallback((t) => t === 'mission' ? startMission() : startSection(), [startMission, startSection]);
    const runReverse = useCallback((t) => { closeQuickMenu(); t === 'mission' ? startMissionReverse() : startSectionReverse(); }, [startMissionReverse, startSectionReverse, closeQuickMenu]);
    const handleQuickForward = useCallback((t) => { closeQuickMenu(); runForward(t); }, [runForward, closeQuickMenu]);

    // Wrapper to close hamburger after action
    const withCloseMenu = useCallback((fn) => () => { fn(); closeHamburger(); }, [closeHamburger]);

    const zoomLabel = Math.round(zoom * 100);
    const isCollapsed = breakpoint === 'collapsed';

    // Secondary controls for mobile menu
    const renderMobileMenuContent = () => (
        <>
            {/* Direction */}
            <div className="topbar__group">
                <span className="topbar__label">Dirección</span>
                <button
                    onClick={withCloseMenu(onToggleReverse)}
                    className={`topbar__chip ${reverseDrawing ? 'topbar__chip--warning' : 'topbar__chip--inactive'}`}
                >
                    {reverseDrawing ? '◀ Reversa' : 'Adelante ▶'}
                </button>
            </div>

            {/* Reference */}
            <div className="topbar__group">
                <span className="topbar__label">Referencia</span>
                <div className="topbar__btn-group">
                    <button
                        onClick={withCloseMenu(() => onReferenceModeChange('center'))}
                        className={`topbar__chip ${referenceMode === 'center' ? '' : 'topbar__chip--inactive'}`}
                    >
                        Centro
                    </button>
                    <button
                        onClick={withCloseMenu(() => onReferenceModeChange('tip'))}
                        className={`topbar__chip ${referenceMode === 'tip' ? 'topbar__chip--warning' : 'topbar__chip--inactive'}`}
                    >
                        Punta
                    </button>
                </div>
            </div>

            {/* Playback */}
            <div className="topbar__group">
                <span className="topbar__label">Reproducir</span>
                <div className="topbar__btn-group">
                    <button onClick={withCloseMenu(startMission)} className="topbar__action-btn">
                        MISIÓN ▶
                    </button>
                    <button onClick={withCloseMenu(startSection)} className="topbar__secondary-btn">
                        Sección ▶
                    </button>
                </div>
            </div>

            {/* Control */}
            <div className="topbar__group">
                <span className="topbar__label">Control</span>
                <div className="topbar__btn-group">
                    <button
                        onClick={withCloseMenu(pauseResume)}
                        disabled={!isRunning}
                        className={`topbar__control-btn ${!isRunning ? 'topbar__control-btn--disabled' : 'topbar__control-btn--pause'}`}
                    >
                        {isPaused ? '▶' : 'II'}
                    </button>
                    <button
                        onClick={withCloseMenu(stopPlayback)}
                        disabled={!isRunning}
                        className={`topbar__control-btn ${!isRunning ? 'topbar__control-btn--disabled' : 'topbar__control-btn--stop'}`}
                    >
                        ■
                    </button>
                </div>
            </div>

            {/* Speed */}
            <div className="topbar__group">
                <span className="topbar__label">Velocidad</span>
                <div className="topbar__speed-control">
                    <input type="range" min="1" max="5" step="0.5" value={playbackSpeed} onChange={e => setPlaybackSpeed(parseFloat(e.target.value))} />
                    <span className="topbar__speed-value">{playbackSpeed}x</span>
                </div>
            </div>
        </>
    );

    return (
        <div className="topbar">
            {/* LEFT: Mode & Config */}
            <div className="topbar__card">
                <div className="topbar__group">
                    <span className="topbar__label">Modo</span>
                    <div className="topbar__btn-group">
                        <button onClick={() => setDrawMode(false)} className={`topbar__chip ${!drawMode ? '' : 'topbar__chip--inactive'}`}>
                            Editar
                        </button>
                        <button onClick={() => setDrawMode(true)} className={`topbar__chip ${drawMode ? '' : 'topbar__chip--inactive'}`}>
                            Dibujar
                        </button>
                    </div>
                </div>

                {!isCollapsed && (
                    <>
                        <div className="topbar__divider"></div>

                        <div className="topbar__group">
                            <span className="topbar__label">Dirección</span>
                            <button onClick={onToggleReverse} className={`topbar__chip ${reverseDrawing ? 'topbar__chip--warning' : 'topbar__chip--inactive'}`}>
                                {reverseDrawing ? '◀ Reversa' : 'Adelante ▶'}
                            </button>
                        </div>

                        <div className="topbar__divider"></div>

                        <div className="topbar__group">
                            <span className="topbar__label">Referencia</span>
                            <div className="topbar__btn-group">
                                <button onClick={() => onReferenceModeChange('center')} className={`topbar__chip ${referenceMode === 'center' ? '' : 'topbar__chip--inactive'}`}>
                                    Centro
                                </button>
                                <button onClick={() => onReferenceModeChange('tip')} className={`topbar__chip ${referenceMode === 'tip' ? 'topbar__chip--warning' : 'topbar__chip--inactive'}`}>
                                    Punta
                                </button>
                            </div>
                        </div>

                        {/* Add Obstacle Button */}
                        {onAddObstacle && (
                            <>
                                <div className="topbar__divider"></div>
                                <button
                                    onClick={onAddObstacle}
                                    className="topbar__chip topbar__chip--inactive"
                                    title="Agregar Obstáculo"
                                    aria-label="Agregar Obstáculo"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    </svg>
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* CENTER: Playback (hidden in collapsed) */}
            {!isCollapsed && (
                <div className="topbar__card topbar__card--secondary">
                    <div className="topbar__group">
                        <span className="topbar__label">Reproducir</span>
                        <div className="topbar__btn-group">
                            <button
                                onPointerDown={(e) => handlePointerDown(e, 'mission')}
                                onPointerUp={(e) => handlePointerUp(e, 'mission')}
                                onPointerLeave={handlePointerCancel}
                                onClick={(e) => handleClick(e, startMission)}
                                className="topbar__action-btn"
                            >
                                MISIÓN ▶
                            </button>
                            <button
                                onPointerDown={(e) => handlePointerDown(e, 'section')}
                                onPointerUp={(e) => handlePointerUp(e, 'section')}
                                onPointerLeave={handlePointerCancel}
                                onClick={(e) => handleClick(e, startSection)}
                                className="topbar__secondary-btn"
                            >
                                Sección ▶
                            </button>
                        </div>
                    </div>

                    <div className="topbar__divider"></div>

                    <div className="topbar__group">
                        <span className="topbar__label">Control</span>
                        <div className="topbar__btn-group">
                            <button
                                onClick={pauseResume}
                                disabled={!isRunning}
                                className={`topbar__control-btn ${!isRunning ? 'topbar__control-btn--disabled' : 'topbar__control-btn--pause'}`}
                            >
                                {isPaused ? '▶' : 'II'}
                            </button>
                            <button
                                onClick={stopPlayback}
                                disabled={!isRunning}
                                className={`topbar__control-btn ${!isRunning ? 'topbar__control-btn--disabled' : 'topbar__control-btn--stop'}`}
                            >
                                ■
                            </button>
                        </div>
                    </div>

                    <div className="topbar__divider"></div>

                    <div className="topbar__group">
                        <span className="topbar__label">Velocidad</span>
                        <div className="topbar__speed-control">
                            <input type="range" min="1" max="5" step="0.5" value={playbackSpeed} onChange={e => setPlaybackSpeed(parseFloat(e.target.value))} />
                            <span className="topbar__speed-value">{playbackSpeed}x</span>
                        </div>
                    </div>
                </div>
            )}

            {/* RIGHT: Zoom + Options (always visible) */}
            <div className="topbar__card">
                <div className="topbar__group">
                    <span className="topbar__label">Zoom</span>
                    <div className="topbar__zoom-control">
                        <button onClick={onZoomOut} className="topbar__zoom-btn">−</button>
                        <span className="topbar__zoom-value">{zoomLabel}%</span>
                        <button onClick={onZoomIn} className="topbar__zoom-btn">+</button>
                        <button onClick={onZoomReset} className="topbar__zoom-btn" title="Resetear vista" style={{ borderLeft: '1px solid rgba(0,0,0,0.1)', paddingLeft: 8, marginLeft: 2 }}>
                            <IconTarget style={{ width: 14, height: 14 }} />
                        </button>
                    </div>
                </div>

                <button onClick={handleRulerToggle} className={`topbar__chip ${rulerActive ? '' : 'topbar__chip--inactive'}`}>
                    <IconRuler style={{ width: 18, height: 18 }} />
                </button>

                {/* Keyboard Shortcuts Button */}
                {onOpenShortcuts && (
                    <button
                        onClick={onOpenShortcuts}
                        className="topbar__chip topbar__chip--inactive"
                        title="Atajos de teclado"
                        aria-label="Atajos de teclado"
                    >
                        ⌨️
                    </button>
                )}

                <button onClick={() => setShowOptions(true)} className="topbar__options-btn">
                    Opciones
                </button>

                {/* Hamburger button (only in collapsed) */}
                {isCollapsed && (
                    <button
                        className="topbar__hamburger"
                        onClick={() => setHamburgerOpen(!hamburgerOpen)}
                        aria-label="Menú"
                    >
                        {hamburgerOpen ? '✕' : '☰'}
                    </button>
                )}
            </div>

            {/* Mobile Menu (only in collapsed when open) */}
            {isCollapsed && hamburgerOpen && (
                <>
                    <div className="topbar__mobile-backdrop" onClick={closeHamburger} />
                    <div className="topbar__mobile-menu">
                        {renderMobileMenuContent()}
                    </div>
                </>
            )}

            {/* Quick Menu Overlay (long press) */}
            {quickMenu.open && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={closeQuickMenu} />
                    <div className="option-card" style={{ position: 'fixed', zIndex: 55, top: quickMenu.anchor.y, left: quickMenu.anchor.x, minWidth: 200, padding: '0.75rem' }}>
                        <div className="option-field__label" style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(148,163,184,0.3)' }}>
                            {quickMenu.target === 'mission' ? 'Reproducir Misión' : 'Reproducir Sección'}
                        </div>
                        <button onClick={() => handleQuickForward(quickMenu.target)} className="option-action-button" style={{ width: '100%', marginBottom: '0.5rem' }}>
                            ▶ Adelante
                        </button>
                        <button onClick={() => runReverse(quickMenu.target)} className="option-chip-button" style={{ width: '100%' }}>
                            ◀ Reversa
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default TopBar;
