import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Toolbar from "./Toolbar";
import SectionsPanel from "./SectionsPanel";
import OptionsPanel from "./OptionsPanel";
import CanvasBoard from "./CanvasBoard";
import { usePlayback } from "./domain/playback";
import {
    FIELD_PRESETS,
    DEFAULT_GRID,
    DEFAULT_ROBOT,
    ZOOM_LIMITS,
    SNAP_45_BASE_ANGLES,
    uid,
    MAT_MM,
    DEG2RAD,
    RAD2DEG
} from "./domain/constants";
import {
    normalizeAngle,
    getReferencePoint,
    computePoseUpToSection,
    getLastPoseOfSection,
    buildReversePlayback,
    buildActionsFromPolyline,
    pointsFromActions,
    projectPointWithReference
} from "./domain/geometry";
import {
    recalcAfterEditStable as recalcAllFollowingSections,
    recalcSectionFromPointsStable as recalcSectionFromPoints,
    recalcSectionsFromPointsStable
} from "./domain/sections_stable";

export default function WROPlaybackPlanner() {
    const [fieldKey, setFieldKey] = useState(FIELD_PRESETS[0].key);
    const [bgImage, setBgImage] = useState(null);
    const [bgOpacity, setBgOpacity] = useState(1);
    const [grid, setGrid] = useState({ ...DEFAULT_GRID });
    const [robot, setRobot] = useState({ ...DEFAULT_ROBOT });
    const [robotImgObj, setRobotImgObj] = useState(null);
    const [sections, setSections] = useState([{ id: uid('sec'), name: 'Sección 1', points: [], actions: [], color: DEFAULT_ROBOT.color, isVisible: true }]);
    const [selectedSectionId, setSelectedSectionId] = useState(sections[0].id);
    const [expandedSections, setExpandedSections] = useState([sections[0].id]);
    const [initialPose, setInitialPose] = useState({ x: 120, y: 120, theta: 0 });
    const [drawMode, setDrawMode] = useState(true);
    const [snapGrid, setSnapGrid] = useState(true);
    const [snap45, setSnap45] = useState(false);
    const [ghost, setGhost] = useState({
        x: 0,
        y: 0,
        theta: 0,
        reference: 'center',
        displayX: 0,
        displayY: 0,
        originX: 0,
        originY: 0,
        active: false,
    });
    const [dragging, setDragging] = useState({ active: false, sectionId: null, index: -1 });
    const [hoverNode, setHoverNode] = useState({ sectionId: null, index: -1 });
    const [draggingStart, setDraggingStart] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [isSectionsPanelCollapsed, setIsSectionsPanelCollapsed] = useState(false);
    const [rulerActive, setRulerActive] = useState(false);
    const [rulerPoints, setRulerPoints] = useState({ start: null, end: null });
    const [isSettingOrigin, setIsSettingOrigin] = useState(false);
    const [unit, setUnit] = useState('cm');
    const [reverseDrawing, setReverseDrawing] = useState(false);
    const [referenceMode, setReferenceMode] = useState('center');
    const [zoom, setZoom] = useState(1);
    const [canvasBaseSize, setCanvasBaseSize] = useState({ width: 0, height: 0 });
    const [cursorGuide, setCursorGuide] = useState({ x: 0, y: 0, visible: false });
    const [cursorGuideColor, setCursorGuideColor] = useState('#ff0000ff');
    const [cursorGuideLineWidth, setCursorGuideLineWidth] = useState(4);
    const [playbackSpeed, setPlaybackSpeed] = useState(3);

    const drawSessionRef = useRef({ active: false, lastPoint: null, addedDuringDrag: false });
    const drawThrottleRef = useRef({ lastAutoAddTs: 0 });
    const rightEraseTimerRef = useRef(null);
    const rightPressActiveRef = useRef(false);

    const currentSection = useMemo(() => sections.find(s => s.id === selectedSectionId), [sections, selectedSectionId]);

    const unitToPx = useCallback((val) => {
        const ppm = (canvasBaseSize.width) / (MAT_MM.w);
        const ppu = unit === 'mm' ? ppm : ppm * 10;
        return val * ppu * zoom;
    }, [canvasBaseSize, unit, zoom]);

    const pxToUnit = useCallback((px) => {
        const ppm = (canvasBaseSize.width) / (MAT_MM.w);
        const ppu = unit === 'mm' ? ppm : ppm * 10;
        if (!ppu) return 0;
        return px / (ppu * zoom);
    }, [canvasBaseSize, unit, zoom]);

    const {
        isRunning,
        isPaused,
        playPose,
        startMission,
        startMissionReverse,
        startSection,
        startSectionReverse,
        pauseResume,
        stopPlayback,
        actionCursorRef
    } = usePlayback({ initialPose, sections, unitToPx, currentSection, playbackSpeed });

    useEffect(() => {
        const preset = FIELD_PRESETS.find(p => p.key === fieldKey);
        if (preset && preset.bg) {
            const img = new Image();
            img.src = preset.bg;
            img.onload = () => setBgImage(img);
        } else {
            setBgImage(null);
        }
    }, [fieldKey]);

    useEffect(() => {
        if (robot.imageSrc) {
            const img = new Image();
            img.src = robot.imageSrc;
            img.onload = () => setRobotImgObj(img);
        } else {
            setRobotImgObj(null);
        }
    }, [robot.imageSrc]);

    useEffect(() => {
        const updateSize = () => {
            const container = document.querySelector('.canvas-card');
            if (container) {
                const rect = container.getBoundingClientRect();
                const aspect = MAT_MM.w / MAT_MM.h;
                const w = Math.max(200, Math.floor(rect.width));
                const h = Math.floor(w / aspect);
                setCanvasBaseSize({ width: w, height: h });
            }
        };
        window.addEventListener('resize', updateSize);
        // Delay slightly to ensure DOM is ready
        setTimeout(updateSize, 0);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const handleBgUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                setBgImage(img);
                setFieldKey('custom');
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleRobotImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            setRobot(r => ({ ...r, imageSrc: evt.target.result }));
        };
        reader.readAsDataURL(file);
    };

    const updateSectionActions = useCallback((sectionId, newActions) => {
        setSections(prev => {
            // 1. Regenerate points ONLY for this section from the new actions
            const modified = prev.map(s => {
                if (s.id !== sectionId) return s;
                const startPose = computePoseUpToSection(prev, initialPose, s.id, unitToPx);
                const newPoints = pointsFromActions(newActions, startPose, unitToPx);
                return { ...s, points: newPoints, actions: newActions };
            });
            // 2. Recalculate ALL sections to maintain consistency
            return recalcSectionsFromPointsStable({ sections: modified, initialPose, unitToPx, pxToUnit });
        });
    }, [initialPose, unitToPx, pxToUnit]);

    const removeLastPointFromCurrentSection = useCallback(() => {
        if (!currentSection || currentSection.points.length === 0) return;
        setSections(prev => {
            const modified = prev.map(s => {
                if (s.id !== currentSection.id) return s;
                const newPts = s.points.slice(0, -1);
                return { ...s, points: newPts };
            });
            return recalcSectionsFromPointsStable({ sections: modified, initialPose, unitToPx, pxToUnit });
        });
    }, [currentSection, initialPose, pxToUnit, unitToPx]);

    const addSection = () => {
        const newId = uid('sec');
        // Simple random color generator ensuring good visibility
        const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        setSections(prev => [...prev, { id: newId, name: `Sección ${prev.length + 1}`, points: [], actions: [], color: randomColor, isVisible: true }]);
        setSelectedSectionId(newId);
        setExpandedSections(prev => [...prev, newId]);
    };

    const toggleSectionExpansion = (id) => {
        setExpandedSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSectionVisibility = (id) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s));
    };

    const handleRulerToggle = () => {
        setRulerActive(prev => !prev);
        setRulerPoints({ start: null, end: null });
    };

    const handleZoomIn = () => setZoom(z => Math.min(z + ZOOM_LIMITS.step, ZOOM_LIMITS.max));
    const handleZoomOut = () => setZoom(z => Math.max(z - ZOOM_LIMITS.step, ZOOM_LIMITS.min));
    const handleZoomReset = () => setZoom(1);

    const exportMission = () => {
        const data = {
            version: 2,
            timestamp: Date.now(),
            fieldKey,
            grid,
            robot,
            initialPose,
            sections,
            unit
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wro_mission_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importMission = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                if (data.fieldKey) setFieldKey(data.fieldKey);
                if (data.grid) setGrid(data.grid);
                if (data.robot) setRobot(data.robot);
                if (data.initialPose) setInitialPose(data.initialPose);
                if (data.sections) setSections(data.sections);
                if (data.unit) setUnit(data.unit);
            } catch (err) {
                console.error("Error importando misión", err);
                alert("Archivo inválido");
            }
        };
        reader.readAsText(file);
    };

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
    }, []);

    return (
        <div className="w-full h-full min-h-screen">
            <main className="app-shell">
                <Toolbar
                    drawMode={drawMode}
                    setDrawMode={setDrawMode}
                    snap45={snap45}
                    setSnap45={setSnap45}
                    snapGrid={snapGrid}
                    setSnapGrid={setSnapGrid}
                    isRunning={isRunning}
                    isPaused={isPaused}
                    startMission={startMission}
                    startMissionReverse={startMissionReverse}
                    startSection={startSection}
                    startSectionReverse={startSectionReverse}
                    pauseResume={pauseResume}
                    stopPlayback={stopPlayback}
                    setShowOptions={setShowOptions}
                    rulerActive={rulerActive}
                    handleRulerToggle={handleRulerToggle}
                    reverseDrawing={reverseDrawing}
                    onToggleReverse={() => setReverseDrawing(p => !p)}
                    referenceMode={referenceMode}
                    onReferenceModeChange={setReferenceMode}
                    zoom={zoom}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onZoomReset={handleZoomReset}
                    playbackSpeed={playbackSpeed}
                    setPlaybackSpeed={setPlaybackSpeed}
                />

                <div className="main-grid">
                    {/* PANEL IZQUIERDO (card) */}
                    <aside className="left-panel">
                        <div className="sections-list">
                            <SectionsPanel
                                sections={sections}
                                setSections={setSections}
                                selectedSectionId={selectedSectionId}
                                setSelectedSectionId={setSelectedSectionId}
                                addSection={addSection}
                                exportMission={exportMission}
                                importMission={importMission}
                                updateSectionActions={updateSectionActions}
                                computePoseUpToSection={(sectionId) => computePoseUpToSection(sections, initialPose, sectionId, unitToPx)}
                                pxToUnit={pxToUnit}
                                isCollapsed={isSectionsPanelCollapsed}
                                setIsCollapsed={setIsSectionsPanelCollapsed}
                                expandedSections={expandedSections}
                                toggleSectionExpansion={toggleSectionExpansion}
                                toggleSectionVisibility={toggleSectionVisibility}
                                unit={unit}
                            />
                        </div>
                    </aside>

                    {/* AREA DEL CANVAS (card limpia) */}
                    <section className="canvas-card" aria-label="Canvas">
                        <CanvasBoard
                            fieldKey={fieldKey}
                            bgImage={bgImage}
                            bgOpacity={bgOpacity}
                            grid={grid}
                            unit={unit}
                            robot={robot}
                            robotImgObj={robotImgObj}
                            sections={sections}
                            setSections={setSections}
                            selectedSectionId={selectedSectionId}
                            initialPose={initialPose}
                            setInitialPose={setInitialPose}
                            playPose={playPose}
                            isRunning={isRunning}
                            drawMode={drawMode}
                            rulerActive={rulerActive}
                            rulerPoints={rulerPoints}
                            setRulerPoints={setRulerPoints}
                            snapGrid={snapGrid}
                            snap45={snap45}
                            referenceMode={referenceMode}
                            reverseDrawing={reverseDrawing}
                            setReverseDrawing={setReverseDrawing}
                            zoom={zoom}
                            canvasBaseSize={canvasBaseSize}
                            setCanvasBaseSize={setCanvasBaseSize}
                            ghost={ghost}
                            setGhost={setGhost}
                            dragging={dragging}
                            setDragging={setDragging}
                            hoverNode={hoverNode}
                            setHoverNode={setHoverNode}
                            draggingStart={draggingStart}
                            setDraggingStart={setDraggingStart}
                            cursorGuide={cursorGuide}
                            setCursorGuide={setCursorGuide}
                            cursorGuideColor={cursorGuideColor}
                            cursorGuideLineWidth={cursorGuideLineWidth}
                            drawSessionRef={drawSessionRef}
                            drawThrottleRef={drawThrottleRef}
                            rightEraseTimerRef={rightEraseTimerRef}
                            rightPressActiveRef={rightPressActiveRef}
                            actionCursorRef={actionCursorRef}
                            unitToPx={unitToPx}
                            pxToUnit={pxToUnit}
                            computePoseUpToSection={(sections, initialPose, sectionId, unitToPx) => computePoseUpToSection(sections, initialPose, sectionId, unitToPx)}
                            handleContextMenu={handleContextMenu}
                            removeLastPointFromCurrentSection={removeLastPointFromCurrentSection}
                            setGrid={setGrid}
                            isSettingOrigin={isSettingOrigin}
                            setIsSettingOrigin={setIsSettingOrigin}
                        />
                        <div className="canvas-legend" aria-hidden="true">
                            <div className="canvas-legend__item">
                                <span className="canvas-legend__swatch canvas-legend__swatch--center" />
                                <span className="text-xs text-slate-600">Centro de ruedas</span>
                            </div>
                            <div className="canvas-legend__item">
                                <span className="canvas-legend__swatch canvas-legend__swatch--tip" />
                                <span className="text-xs text-slate-600">Punta del robot</span>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <OptionsPanel
                showOptions={showOptions}
                setShowOptions={setShowOptions}
                fieldKey={fieldKey}
                setFieldKey={setFieldKey}
                bgOpacity={bgOpacity}
                setBgOpacity={setBgOpacity}
                grid={grid}
                setGrid={setGrid}
                robot={robot}
                setRobot={setRobot}
                initialPose={initialPose}
                setInitialPose={setInitialPose}
                handleBgUpload={handleBgUpload}
                handleRobotImageUpload={handleRobotImageUpload}
                setIsSettingOrigin={setIsSettingOrigin}
                unit={unit}
                setUnit={setUnit}
                cursorGuideColor={cursorGuideColor}
                setCursorGuideColor={setCursorGuideColor}
                cursorGuideLineWidth={cursorGuideLineWidth}
                setCursorGuideLineWidth={setCursorGuideLineWidth}
            />

            <footer className="footer-note">Dimensiones del tapete: 2362mm × 1143mm.</footer>
        </div>
    );
}
