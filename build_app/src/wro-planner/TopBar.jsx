import React, { useState, useRef, useCallback, useEffect } from "react";
import { IconRuler } from "./icons";

const TopBar = ({
    drawMode, setDrawMode, snap45, setSnap45,
    isRunning, isPaused, startMission, startMissionReverse, startSection, startSectionReverse,
    pauseResume, stopPlayback, setShowOptions, rulerActive, handleRulerToggle,
    reverseDrawing, onToggleReverse, referenceMode, onReferenceModeChange,
    zoom, onZoomIn, onZoomOut, onZoomReset, playbackSpeed, setPlaybackSpeed,
}) => {
    const [quickMenu, setQuickMenu] = useState({ open: false, target: null, anchor: { x: 0, y: 0 } });
    const longPressTimerRef = useRef(null);
    const pointerStateRef = useRef({ pointerId: null, target: null, triggered: false });
    const ignoreClickRef = useRef(false);

    const closeQuickMenu = useCallback(() => setQuickMenu({ open: false, target: null, anchor: { x: 0, y: 0 } }), []);

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

    const zoomLabel = Math.round(zoom * 100);

    // Card base style - THE KEY ELEMENT
    const cardStyle = "bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] px-4 py-3";
    const btnBase = "rounded-2xl font-semibold text-sm transition-all duration-200";
    const btnActive = "bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white shadow-lg";
    const btnInactive = "bg-gray-100 text-gray-600 hover:bg-gray-200";

    return (
        <div className="w-full px-4 py-4 flex items-center justify-between gap-6">

            {/* LEFT CARD: Mode & Direction */}
            <div className={cardStyle + " flex items-center gap-3"}>
                {/* Mode Toggle */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl">
                    <button onClick={() => setDrawMode(false)} className={`px-4 py-2 ${btnBase} ${!drawMode ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                        Editar
                    </button>
                    <button onClick={() => setDrawMode(true)} className={`px-4 py-2 ${btnBase} ${drawMode ? btnActive : 'text-gray-500 hover:text-gray-700'}`}>
                        Dibujar
                    </button>
                </div>

                <div className="w-px h-8 bg-gray-200"></div>

                {/* Direction */}
                <button onClick={onToggleReverse} className={`px-4 py-2.5 ${btnBase} ${reverseDrawing ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {reverseDrawing ? '◀ Reversa' : 'Adelante ▶'}
                </button>

                {/* Reference */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl">
                    <button onClick={() => onReferenceModeChange('center')} className={`px-3 py-1.5 text-xs font-bold uppercase ${btnBase} ${referenceMode === 'center' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500'}`}>
                        Centro
                    </button>
                    <button onClick={() => onReferenceModeChange('tip')} className={`px-3 py-1.5 text-xs font-bold uppercase ${btnBase} ${referenceMode === 'tip' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500'}`}>
                        Punta
                    </button>
                </div>
            </div>

            {/* CENTER CARD: Playback */}
            <div className={cardStyle + " flex items-center gap-3"}>
                <button
                    onPointerDown={(e) => handlePointerDown(e, 'mission')}
                    onPointerUp={(e) => handlePointerUp(e, 'mission')}
                    onPointerLeave={handlePointerCancel}
                    onClick={(e) => handleClick(e, startMission)}
                    className={`px-6 py-3 ${btnBase} ${btnActive} flex items-center gap-2 hover:scale-105 active:scale-95`}
                >
                    MISIÓN ▶
                </button>

                <button
                    onPointerDown={(e) => handlePointerDown(e, 'section')}
                    onPointerUp={(e) => handlePointerUp(e, 'section')}
                    onPointerLeave={handlePointerCancel}
                    onClick={(e) => handleClick(e, startSection)}
                    className={`px-5 py-2.5 ${btnBase} bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-400 flex items-center gap-2`}
                >
                    Sección ▶
                </button>

                <div className="w-px h-10 bg-gray-200"></div>

                <button onClick={pauseResume} disabled={!isRunning} className={`w-12 h-12 ${btnBase} flex items-center justify-center text-xl ${!isRunning ? 'bg-gray-100 text-gray-300' : isPaused ? 'bg-yellow-100 text-yellow-600' : 'bg-yellow-400 text-white shadow-lg'}`}>
                    {isPaused ? '▶' : 'II'}
                </button>
                <button onClick={stopPlayback} disabled={!isRunning} className={`w-12 h-12 ${btnBase} flex items-center justify-center ${!isRunning ? 'bg-gray-100 text-gray-300' : 'bg-red-100 text-red-500 hover:bg-red-200'}`}>
                    ■
                </button>

                <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-2xl">
                    <span className="text-xs font-bold text-gray-400">VEL</span>
                    <input type="range" min="1" max="5" step="0.5" value={playbackSpeed} onChange={e => setPlaybackSpeed(parseFloat(e.target.value))} className="w-20 accent-pink-500" />
                    <span className="text-sm font-bold text-pink-500">{playbackSpeed}x</span>
                </div>
            </div>

            {/* RIGHT CARD: Tools */}
            <div className={cardStyle + " flex items-center gap-3"}>
                <div className="flex items-center bg-gray-100 rounded-2xl overflow-hidden">
                    <button onClick={onZoomOut} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-200 text-lg font-bold">−</button>
                    <span className="px-3 text-sm font-bold text-gray-700">{zoomLabel}%</span>
                    <button onClick={onZoomIn} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-200 text-lg font-bold">+</button>
                </div>

                <button onClick={handleRulerToggle} className={`w-11 h-11 ${btnBase} flex items-center justify-center ${rulerActive ? btnActive : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    <IconRuler className="w-5 h-5" />
                </button>

                <button onClick={() => setShowOptions(true)} className={`px-5 py-2.5 ${btnBase} bg-gray-900 text-white hover:bg-gray-800 shadow-lg`}>
                    Opciones
                </button>
            </div>

            {/* Quick Menu */}
            {quickMenu.open && (
                <>
                    <div className="fixed inset-0 z-50" onClick={closeQuickMenu} />
                    <div className="fixed z-50 bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-3 min-w-[220px]" style={{ top: quickMenu.anchor.y, left: quickMenu.anchor.x }}>
                        <div className="text-xs font-bold text-gray-400 uppercase px-3 py-2 border-b border-gray-100">
                            {quickMenu.target === 'mission' ? 'Misión' : 'Sección'}
                        </div>
                        <button onClick={() => handleQuickForward(quickMenu.target)} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-2xl mt-1">
                            <div className={`w-10 h-10 rounded-2xl ${btnActive} flex items-center justify-center`}>▶</div>
                            <span className="font-semibold text-gray-800">Adelante</span>
                        </button>
                        <button onClick={() => runReverse(quickMenu.target)} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-2xl">
                            <div className="w-10 h-10 rounded-2xl bg-orange-400 text-white flex items-center justify-center">◀</div>
                            <span className="font-semibold text-gray-800">Reversa</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default TopBar;
