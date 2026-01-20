/**
 * @fileoverview WROPlaybackPlanner - Main Application Component
 * 
 * ARCHITECTURE: Stateless / Rubber-Band
 * 
 * This component uses a single source of truth (sections) and derives
 * all route data using useMemo. When any section is added, deleted, or
 * modified, the entire route is recalculated from scratch, ensuring:
 * 
 * 1. No stale data in playback (via ref-based access)
 * 2. Deleting middle sections naturally "reconnects" the path
 * 3. Predictable, testable behavior
 * 
 * STALE CLOSURE FIX:
 * - routeDataRef always holds the latest routeData
 * - handleStartMission* functions read from this ref
 * - useEffect auto-stops playback when route changes
 * 
 * @module WROPlaybackPlanner
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import TopBar from "./TopBar";
import SectionsPanel from "./SectionsPanel";
import OptionsPanel from "./OptionsPanel";
import CanvasBoard from "./CanvasBoard";
import WaypointsPanel from "./WaypointsPanel";
import RobotSizeModal from "./components/RobotSizeModal";
import ShortcutsModal from "./ShortcutsModal";
import { usePlayback } from "./domain/playback";
import {
    FIELD_PRESETS,
    DEFAULT_GRID,
    DEFAULT_ROBOT,
    ZOOM_LIMITS,
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
    projectPointWithReference,
    getPoseAfterActions
} from "./domain/geometry";
import {
    recalcAfterEditStable as recalcAllFollowingSections,
    recalcSectionFromPointsStable as recalcSectionFromPoints,
    recalcSectionsFromPointsStable
} from "./domain/sections_stable";
import {
    loadRobotConfig,
    saveRobotConfig,
    getDefaultRobotConfig
} from "./domain/robotConfigStorage";
import {
    calculateRouteInstructions,
    generatePlaybackActions as generatePlaybackActionsFromCalc,
    flattenSectionsToWaypoints
} from "./domain/pathCalculator";

export default function WROPlaybackPlanner() {
    // =========================================================================
    // STATE - Field & Display Settings
    // =========================================================================
    const [fieldKey, setFieldKey] = useState(FIELD_PRESETS[0].key);
    const [bgImage, setBgImage] = useState(null);
    const [bgOpacity, setBgOpacity] = useState(1);
    const [grid, setGrid] = useState({ ...DEFAULT_GRID });

    // Initialize robot state with saved config if available
    const [robot, setRobot] = useState(() => {
        const savedConfig = loadRobotConfig();
        if (savedConfig) {
            return {
                ...DEFAULT_ROBOT,
                length: savedConfig.length,
                width: savedConfig.width,
                wheelOffset: savedConfig.wheelOffset ?? DEFAULT_ROBOT.wheelOffset
            };
        }
        return { ...DEFAULT_ROBOT };
    });

    const [showRobotModal, setShowRobotModal] = useState(true);
    const [robotImgObj, setRobotImgObj] = useState(null);

    // =========================================================================
    // STATE - Sections (PRIMARY DATA SOURCE)
    // The sections array contains all waypoints grouped by section.
    // This is the SINGLE SOURCE OF TRUTH for the path.
    // =========================================================================
    const [sections, setSections] = useState([{
        id: uid('sec'),
        name: 'Sección 1',
        points: [],
        actions: [],
        color: DEFAULT_ROBOT.color,
        isVisible: true
    }]);

    const [selectedSectionId, setSelectedSectionId] = useState(sections[0].id);
    const [expandedSections, setExpandedSections] = useState([sections[0].id]);
    const [initialPose, setInitialPose] = useState({ x: 120, y: 120, theta: 0 });

    // =========================================================================
    // STATE - Drawing & Interaction
    // =========================================================================
    const [drawMode, setDrawMode] = useState(true);
    const snapGrid = true;
    const [snap45, setSnap45] = useState(false);
    const [ghost, setGhost] = useState({
        x: 0, y: 0, theta: 0,
        reference: 'center',
        displayX: 0, displayY: 0,
        originX: 0, originY: 0,
        active: false,
    });
    const [dragging, setDragging] = useState({ active: false, sectionId: null, index: -1 });
    const [hoverNode, setHoverNode] = useState({ sectionId: null, index: -1 });
    const [draggingStart, setDraggingStart] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [isSectionsPanelCollapsed, setIsSectionsPanelCollapsed] = useState(false);
    const [isWaypointsPanelCollapsed, setIsWaypointsPanelCollapsed] = useState(false);
    const [rulerActive, setRulerActive] = useState(false);
    const [rulerPoints, setRulerPoints] = useState({ start: null, end: null });
    const [isSettingOrigin, setIsSettingOrigin] = useState(false);
    const [unit, setUnit] = useState('cm');
    const [reverseDrawing, setReverseDrawing] = useState(false);
    const [referenceMode, setReferenceMode] = useState('center');
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [canvasBaseSize, setCanvasBaseSize] = useState({ width: 0, height: 0 });
    const [cursorGuide, setCursorGuide] = useState({ x: 0, y: 0, visible: false });
    const [cursorGuideColor, setCursorGuideColor] = useState('#ff0000ff');
    const [cursorGuideLineWidth, setCursorGuideLineWidth] = useState(4);
    const [playbackSpeed, setPlaybackSpeed] = useState(3);
    const [ghostRobotOpacity, setGhostRobotOpacity] = useState(0.4);
    const [ghostOpacityOverride, setGhostOpacityOverride] = useState(false);
    const [robotImageRotation, setRobotImageRotation] = useState(0);

    // Selected node for editing (clicked waypoint in canvas)
    // Format: { sectionId: string, index: number } or null
    const [selectedNode, setSelectedNode] = useState(null);

    // Keyboard shortcuts help modal
    const [showShortcuts, setShowShortcuts] = useState(false);

    // =========================================================================
    // OBSTACLE STATE
    // =========================================================================
    const [obstacles, setObstacles] = useState([]);
    const [selectedObstacleId, setSelectedObstacleId] = useState(null);
    const [collisionPadding, setCollisionPadding] = useState(5); // Default 5cm padding

    // =========================================================================
    // REFS
    // =========================================================================
    const drawSessionRef = useRef({ active: false, lastPoint: null, addedDuringDrag: false });
    const drawThrottleRef = useRef({ lastAutoAddTs: 0 });
    const rightEraseTimerRef = useRef(null);
    const rightPressActiveRef = useRef(false);
    const containerRef = useRef(null);

    // REF-BASED ACCESS FOR STALE CLOSURE FIX
    // This ref ALWAYS holds the latest routeData, preventing stale closures
    const routeDataRef = useRef({
        waypoints: [],
        instructions: [],
        pathSegments: [],
        playbackActions: []
    });

    // =========================================================================
    // DERIVED STATE - Current Section
    // =========================================================================
    const currentSection = useMemo(
        () => sections.find(s => s.id === selectedSectionId),
        [sections, selectedSectionId]
    );

    // =========================================================================
    // UNIT CONVERSION HELPERS
    // =========================================================================
    const unitToPx = useCallback((val) => {
        const ppm = (canvasBaseSize.width) / (MAT_MM.w);
        const ppu = unit === 'mm' ? ppm : ppm * 10;
        return val * ppu;
    }, [canvasBaseSize, unit]);

    const pxToUnit = useCallback((px) => {
        const ppm = (canvasBaseSize.width) / (MAT_MM.w);
        const ppu = unit === 'mm' ? ppm : ppm * 10;
        if (!ppu) return 0;
        return px / ppu;
    }, [canvasBaseSize, unit]);

    // Calculate pixelsPerUnit for pathCalculator
    const pixelsPerUnit = useMemo(() => {
        const ppm = (canvasBaseSize.width) / (MAT_MM.w);
        return unit === 'mm' ? ppm : ppm * 10;
    }, [canvasBaseSize, unit]);

    // =========================================================================
    // STATELESS ROUTE CALCULATION
    // 
    // This useMemo block is the core of the "rubber-band" architecture.
    // It recalculates EVERYTHING whenever sections change.
    // =========================================================================
    const routeData = useMemo(() => {
        // Flatten sections to waypoints array
        const waypoints = flattenSectionsToWaypoints(
            sections.filter(s => s.isVisible)
        );

        // Skip if no waypoints or invalid pixelsPerUnit
        if (waypoints.length === 0 || !pixelsPerUnit || pixelsPerUnit <= 0) {
            return {
                waypoints: [],
                instructions: [],
                pathSegments: [],
                playbackActions: []
            };
        }

        // Calculate route using stateless pathCalculator
        const { instructions, pathSegments, poses } = calculateRouteInstructions(
            initialPose,
            waypoints,
            pixelsPerUnit
        );

        // Generate playback actions
        const playbackActions = generatePlaybackActionsFromCalc(
            initialPose,
            waypoints,
            pixelsPerUnit
        );

        return {
            waypoints,
            instructions,
            pathSegments,
            playbackActions,
            poses
        };
    }, [sections, initialPose, pixelsPerUnit]);

    // =========================================================================
    // SYNC REF WITH LATEST ROUTE DATA (STALE CLOSURE FIX)
    // This ensures routeDataRef always has the latest data
    // =========================================================================
    useEffect(() => {
        routeDataRef.current = routeData;
    }, [routeData]);

    // =========================================================================
    // PLAYBACK HOOK (for animation primitives)
    // We use startPlayback directly with fresh actions from routeDataRef
    // =========================================================================
    const {
        isRunning,
        isPaused,
        playPose,
        startPlayback,  // ← Direct access to start animation with any action list
        pauseResume,
        stopPlayback,
        actionCursorRef
    } = usePlayback({
        initialPose,
        sections,
        unitToPx,
        currentSection,
        playbackSpeed,
        unit
    });

    // =========================================================================
    // AUTO-STOP PLAYBACK WHEN ROUTE CHANGES (STALE DATA PREVENTION)
    // 
    // When the path is modified (add/delete/edit), immediately stop any
    // running playback to prevent the robot from following a "ghost path".
    // =========================================================================
    const previousRouteVersionRef = useRef(0);
    const routeVersion = useMemo(() => {
        // Generate a simple version hash based on waypoints count and last waypoint
        const wps = routeData.waypoints;
        if (wps.length === 0) return 0;
        const last = wps[wps.length - 1];
        return wps.length * 10000 + Math.floor((last?.x || 0) + (last?.y || 0));
    }, [routeData.waypoints]);

    useEffect(() => {
        // Skip on initial mount
        if (previousRouteVersionRef.current === 0) {
            previousRouteVersionRef.current = routeVersion;
            return;
        }

        // If route changed and playback is running, stop it
        if (previousRouteVersionRef.current !== routeVersion && isRunning) {
            console.log('[WROPlaybackPlanner] Route changed during playback - auto-stopping');
            stopPlayback();
        }

        previousRouteVersionRef.current = routeVersion;
    }, [routeVersion, isRunning, stopPlayback]);

    // =========================================================================
    // CUSTOM MISSION HANDLERS (USE REF-BASED ACCESS - NO STALE CLOSURES)
    // 
    // These use startPlayback directly with fresh actions from routeDataRef.
    // This guarantees we ALWAYS use the latest calculated playback data.
    // =========================================================================

    /**
     * Start full mission playback using the LATEST playback actions.
     * Reads from routeDataRef to avoid stale closure issues.
     */
    const handleStartMission = useCallback(() => {
        // Always stop any running playback first
        stopPlayback();

        // Read fresh data from ref (NOT from closure)
        const latestRouteData = routeDataRef.current;
        const actions = latestRouteData.playbackActions;

        if (!actions || actions.length === 0) {
            console.warn('[WROPlaybackPlanner] Cannot start mission: no playback actions');
            return;
        }

        console.log('[WROPlaybackPlanner] Starting mission with', actions.length, 'actions');

        // Use startPlayback directly with fresh actions
        startPlayback(actions, initialPose);
    }, [stopPlayback, startPlayback, initialPose]);

    /**
     * Start reverse mission playback.
     * Reverses the fresh playbackActions from routeDataRef.
     */
    const handleStartMissionReverse = useCallback(() => {
        stopPlayback();

        const latestRouteData = routeDataRef.current;
        const actions = latestRouteData.playbackActions;

        if (!actions || actions.length === 0) {
            console.warn('[WROPlaybackPlanner] Cannot start reverse mission: no playback actions');
            return;
        }

        // Reverse the actions: negate angles and distances, reverse order
        const reversedActions = [];
        for (let i = actions.length - 1; i >= 0; i--) {
            const action = actions[i];
            if (action.type === 'rotate') {
                reversedActions.push({ ...action, angle: -action.angle });
            } else if (action.type === 'move') {
                reversedActions.push({ ...action, distance: -action.distance });
            }
        }

        // Calculate end pose to start reverse from there
        const waypoints = latestRouteData.waypoints;
        const lastPose = waypoints.length > 0
            ? latestRouteData.poses?.[latestRouteData.poses.length - 1] || initialPose
            : initialPose;

        console.log('[WROPlaybackPlanner] Starting reverse mission with', reversedActions.length, 'actions');
        startPlayback(reversedActions, lastPose);
    }, [stopPlayback, startPlayback, initialPose]);

    /**
     * Start current section playback.
     * Uses fresh data to find the section's actions.
     */
    const handleStartSection = useCallback(() => {
        stopPlayback();

        if (!currentSection) {
            console.warn('[WROPlaybackPlanner] No section selected');
            return;
        }

        const latestRouteData = routeDataRef.current;

        // Filter actions that belong to current section
        const sectionActions = latestRouteData.playbackActions.filter(
            a => a.sectionId === currentSection.id
        );

        if (sectionActions.length === 0) {
            console.warn('[WROPlaybackPlanner] No actions in current section');
            return;
        }

        // Calculate start pose for this section
        const startPose = computePoseUpToSection(sections, initialPose, currentSection.id, unitToPx);

        console.log('[WROPlaybackPlanner] Starting section with', sectionActions.length, 'actions');
        startPlayback(sectionActions, startPose);
    }, [stopPlayback, startPlayback, currentSection, sections, initialPose, unitToPx]);

    /**
     * Start current section reverse playback.
     */
    const handleStartSectionReverse = useCallback(() => {
        stopPlayback();

        if (!currentSection) {
            console.warn('[WROPlaybackPlanner] No section selected');
            return;
        }

        const latestRouteData = routeDataRef.current;

        // Filter actions that belong to current section
        const sectionActions = latestRouteData.playbackActions.filter(
            a => a.sectionId === currentSection.id
        );

        if (sectionActions.length === 0) {
            console.warn('[WROPlaybackPlanner] No actions in current section');
            return;
        }

        // Reverse the actions
        const reversedActions = [];
        for (let i = sectionActions.length - 1; i >= 0; i--) {
            const action = sectionActions[i];
            if (action.type === 'rotate') {
                reversedActions.push({ ...action, angle: -action.angle });
            } else if (action.type === 'move') {
                reversedActions.push({ ...action, distance: -action.distance });
            }
        }

        // Calculate end pose of section to start reverse from there
        const startPose = computePoseUpToSection(sections, initialPose, currentSection.id, unitToPx);
        const endPose = getPoseAfterActions(startPose, currentSection.actions, unitToPx);

        console.log('[WROPlaybackPlanner] Starting section reverse with', reversedActions.length, 'actions');
        startPlayback(reversedActions, endPose);
    }, [stopPlayback, startPlayback, currentSection, sections, initialPose, unitToPx]);

    // =========================================================================
    // EFFECTS
    // =========================================================================

    // Load field background
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

    // Load robot image
    useEffect(() => {
        if (robot.imageSrc) {
            const img = new Image();
            img.src = robot.imageSrc;
            img.onload = () => setRobotImgObj(img);
        } else {
            setRobotImgObj(null);
        }
    }, [robot.imageSrc]);

    // Auto-expand selected section
    useEffect(() => {
        setExpandedSections([selectedSectionId]);
    }, [selectedSectionId]);

    // Container resize handling
    useEffect(() => {
        const updateSize = () => {
            const container = containerRef.current;
            if (container) {
                const rect = container.getBoundingClientRect();
                const aspect = MAT_MM.w / MAT_MM.h;
                const w = Math.max(200, Math.floor(rect.width));
                const h = Math.floor(w / aspect);
                setCanvasBaseSize({ width: w, height: h });
            }
        };

        const resizeObserver = new ResizeObserver(() => updateSize());
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        updateSize();

        return () => resizeObserver.disconnect();
    }, []);

    // =========================================================================
    // HANDLERS - Section Management
    // =========================================================================

    /**
     * Delete a section and all its waypoints.
     * This is the "rubber-band" delete - it simply removes the section,
     * and the useMemo recalculates the route automatically.
     */
    const handleDeleteSection = useCallback((sectionId) => {
        // ✅ IMPORTANT: Stop playback BEFORE modifying sections
        // This prevents race conditions where playback reads stale data
        if (isRunning) {
            stopPlayback();
        }

        setSections(prevSections => {
            // Don't delete if it's the last section
            if (prevSections.length <= 1) {
                return prevSections;
            }

            const filtered = prevSections.filter(s => s.id !== sectionId);

            // Update selected section if needed
            if (selectedSectionId === sectionId && filtered.length > 0) {
                setSelectedSectionId(filtered[0].id);
            }

            return filtered;
        });
    }, [selectedSectionId, isRunning, stopPlayback]);

    /**
     * Delete all waypoints from a section (without deleting the section itself).
     */
    const handleClearSection = useCallback((sectionId) => {
        if (isRunning) {
            stopPlayback();
        }

        setSections(prevSections =>
            prevSections.map(s =>
                s.id === sectionId
                    ? { ...s, points: [], actions: [] }
                    : s
            )
        );
    }, [isRunning, stopPlayback]);

    const updateSectionActions = useCallback((sectionId, newActions) => {
        // Stop playback when actions are modified
        if (isRunning) {
            stopPlayback();
        }

        setSections(prev => {
            const modified = prev.map(s => {
                if (s.id !== sectionId) return s;
                const startPose = computePoseUpToSection(prev, initialPose, s.id, unitToPx);
                const newPoints = pointsFromActions(newActions, startPose, unitToPx);
                const endPose = getPoseAfterActions(startPose, newActions, unitToPx);
                return {
                    ...s,
                    points: newPoints,
                    actions: newActions,
                    startAngle: startPose.theta * RAD2DEG,
                    endAngle: endPose.theta * RAD2DEG
                };
            });

            const changedIndex = modified.findIndex(s => s.id === sectionId);
            if (changedIndex === -1 || changedIndex === modified.length - 1) {
                return modified;
            }

            let runningPose = getPoseAfterActions(
                computePoseUpToSection(modified, initialPose, sectionId, unitToPx),
                newActions,
                unitToPx
            );

            const result = [...modified];
            for (let i = changedIndex + 1; i < result.length; i++) {
                const section = result[i];
                const endPose = getPoseAfterActions(runningPose, section.actions, unitToPx);
                const updatedPoints = pointsFromActions(section.actions, runningPose, unitToPx);
                result[i] = {
                    ...section,
                    points: updatedPoints,
                    startAngle: runningPose.theta * RAD2DEG,
                    endAngle: endPose.theta * RAD2DEG
                };
                runningPose = endPose;
            }

            return result;
        });
    }, [initialPose, unitToPx, isRunning, stopPlayback]);

    const removeLastPointFromCurrentSection = useCallback(() => {
        if (!currentSection || currentSection.points.length === 0) return;

        if (isRunning) {
            stopPlayback();
        }

        setSections(prev => {
            const modified = prev.map(s => {
                if (s.id !== currentSection.id) return s;
                const newPts = s.points.slice(0, -1);
                return { ...s, points: newPts };
            });
            return recalcSectionsFromPointsStable({ sections: modified, initialPose, unitToPx, pxToUnit });
        });
    }, [currentSection, initialPose, pxToUnit, unitToPx, isRunning, stopPlayback]);

    const addSection = () => {
        const newId = uid('sec');
        const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        setSections(prev => [...prev, {
            id: newId,
            name: `Sección ${prev.length + 1}`,
            points: [],
            actions: [],
            color: randomColor,
            isVisible: true
        }]);
        setSelectedSectionId(newId);
        setExpandedSections(prev => [...prev, newId]);
    };

    const toggleSectionExpansion = (id) => {
        setExpandedSections(prev => prev.includes(id) ? [] : [id]);
    };

    const toggleSectionVisibility = (id) => {
        if (isRunning) {
            stopPlayback();
        }
        setSections(prev => prev.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s));
    };

    // =========================================================================
    // HANDLERS - Tools & Navigation
    // =========================================================================

    const handleRulerToggle = () => {
        setRulerActive(prev => !prev);
        setRulerPoints({ start: null, end: null });
    };

    const handleZoomIn = () => setZoom(z => Math.min(z + ZOOM_LIMITS.step, ZOOM_LIMITS.max));
    const handleZoomOut = () => setZoom(z => Math.max(z - ZOOM_LIMITS.step, ZOOM_LIMITS.min));
    const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    /**
     * Toggle reverse direction for either:
     * 1. The selected waypoint (if one is selected)
     * 2. The global reverseDrawing state (for new points)
     */
    const handleToggleReverse = useCallback(() => {
        if (selectedNode && selectedNode.sectionId && selectedNode.index >= 0) {
            // Toggle the reverse property of the selected waypoint
            if (isRunning) {
                stopPlayback();
            }

            setSections(prevSections => {
                const modified = prevSections.map(s => {
                    if (s.id !== selectedNode.sectionId) return s;

                    const newPoints = s.points.map((p, i) => {
                        if (i !== selectedNode.index) return p;
                        return { ...p, reverse: !p.reverse };
                    });

                    return { ...s, points: newPoints };
                });

                // Recalculate actions after toggling reverse
                return recalcSectionsFromPointsStable({
                    sections: modified,
                    initialPose,
                    unitToPx,
                    pxToUnit
                });
            });

            console.log('[WROPlaybackPlanner] Toggled reverse for waypoint:', selectedNode);
        } else {
            // No waypoint selected - toggle global reverseDrawing for new points
            setReverseDrawing(prev => !prev);
        }
    }, [selectedNode, isRunning, stopPlayback, initialPose, unitToPx, pxToUnit]);

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

    // =========================================================================
    // HANDLERS - Import/Export
    // =========================================================================

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

        // Stop playback before import
        if (isRunning) {
            stopPlayback();
        }

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

    const toggleUnit = () => {
        const nextUnit = unit === 'cm' ? 'mm' : 'cm';
        const factor = nextUnit === 'mm' ? 10 : 0.1;

        setRobot(r => ({
            ...r,
            width: r.width * factor,
            length: r.length * factor,
            wheelOffset: r.wheelOffset ? r.wheelOffset * factor : r.wheelOffset
        }));
        setGrid(g => ({ ...g, cellSize: g.cellSize * factor }));
        setSections(secs => secs.map(s => ({
            ...s,
            actions: s.actions.map(a => a.type === 'move' ? { ...a, distance: a.distance * factor } : a)
        })));
        setUnit(nextUnit);
    };

    // =========================================================================
    // HANDLERS - Obstacles
    // =========================================================================

    // Add a default 20x20cm obstacle at canvas center
    const handleAddObstacle = useCallback(() => {
        const sizePx = unitToPx(20) || 100; // 20cm default size or 100px fallback
        const newObstacle = {
            id: uid('obs'),
            x: canvasBaseSize.width / 2,
            y: canvasBaseSize.height / 2,
            w: sizePx,
            h: sizePx,
            color: '#f97316', // orange-500
            rotation: 0
        };
        setObstacles(prev => [...prev, newObstacle]);
        setSelectedObstacleId(newObstacle.id);
    }, [canvasBaseSize, unitToPx]);

    // Update obstacle properties
    const handleUpdateObstacle = useCallback((id, newProps) => {
        setObstacles(prev => prev.map(obs =>
            obs.id === id ? { ...obs, ...newProps } : obs
        ));
    }, []);

    // Delete selected obstacle
    const handleDeleteObstacle = useCallback(() => {
        if (!selectedObstacleId) return;
        setObstacles(prev => prev.filter(obs => obs.id !== selectedObstacleId));
        setSelectedObstacleId(null);
    }, [selectedObstacleId]);

    // Select obstacle
    const handleSelectObstacle = useCallback((id) => {
        setSelectedObstacleId(id);
        if (id) {
            setSelectedNode(null); // Deselect waypoint if obstacle selected
            setSelectedSectionId(null);
        }
    }, [setSelectedNode, setSelectedSectionId]);


    // =========================================================================
    // RENDER
    // =========================================================================

    return (
        <div className="h-screen w-full bg-slate-100 flex flex-col overflow-hidden text-slate-800 font-sans selection:bg-indigo-100">
            {/* Header Area */}
            <header className="shrink-0 px-6 pt-4 pb-2">
                <div className="max-w-[1920px] mx-auto">
                    <TopBar
                        drawMode={drawMode}
                        setDrawMode={setDrawMode}
                        snap45={snap45}
                        setSnap45={setSnap45}
                        isRunning={isRunning}
                        isPaused={isPaused}
                        startMission={handleStartMission}
                        startMissionReverse={handleStartMissionReverse}
                        startSection={handleStartSection}
                        startSectionReverse={handleStartSectionReverse}
                        pauseResume={pauseResume}
                        stopPlayback={stopPlayback}
                        setShowOptions={setShowOptions}
                        rulerActive={rulerActive}
                        handleRulerToggle={handleRulerToggle}
                        reverseDrawing={reverseDrawing}
                        onToggleReverse={handleToggleReverse}
                        selectedNode={selectedNode}
                        referenceMode={referenceMode}
                        onReferenceModeChange={setReferenceMode}
                        zoom={zoom}
                        onZoomIn={handleZoomIn}
                        onZoomOut={handleZoomOut}
                        onZoomReset={handleZoomReset}
                        playbackSpeed={playbackSpeed}
                        setPlaybackSpeed={setPlaybackSpeed}
                        onOpenShortcuts={() => setShowShortcuts(true)}
                        onAddObstacle={handleAddObstacle}
                    />
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-6 max-w-[1920px] mx-auto w-full">

                {/* Left Panel - SECTIONS */}
                <aside style={{ width: 400, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
                </aside>

                {/* Center Panel - CANVAS */}
                <main ref={containerRef} className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center bg-slate-50/50">
                    <div className="absolute inset-0 z-0 flex items-center justify-center">
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
                            setSelectedSectionId={setSelectedSectionId}
                            initialPose={initialPose}
                            setInitialPose={setInitialPose}
                            playPose={playPose}
                            isRunning={isRunning}
                            drawMode={drawMode}
                            setDrawMode={setDrawMode}
                            rulerActive={rulerActive}
                            rulerPoints={rulerPoints}
                            setRulerPoints={setRulerPoints}
                            snapGrid={snapGrid}
                            snap45={snap45}
                            setSnap45={setSnap45}
                            referenceMode={referenceMode}
                            setReferenceMode={setReferenceMode}
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
                            // Obstacles
                            obstacles={obstacles}
                            onUpdateObstacle={handleUpdateObstacle}
                            selectedObstacleId={selectedObstacleId}
                            onSelectObstacle={handleSelectObstacle}
                            onDeleteObstacle={handleDeleteObstacle}
                            collisionPadding={collisionPadding}

                            // Other props
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
                            computePoseUpToSection={(sections, initialPose, sectionId, unitToPx) =>
                                computePoseUpToSection(sections, initialPose, sectionId, unitToPx)
                            }
                            handleContextMenu={handleContextMenu}
                            removeLastPointFromCurrentSection={removeLastPointFromCurrentSection}
                            setGrid={setGrid}
                            isSettingOrigin={isSettingOrigin}
                            setIsSettingOrigin={setIsSettingOrigin}
                            addSection={addSection}
                            ghostRobotOpacity={ghostRobotOpacity}
                            ghostOpacityOverride={ghostOpacityOverride}
                            setGhostOpacityOverride={setGhostOpacityOverride}
                            robotImageRotation={robotImageRotation}
                            setZoom={setZoom}
                            pan={pan}
                            setPan={setPan}
                            // Pass calculated path segments for optional overlay rendering
                            calculatedPathSegments={routeData.pathSegments}
                            // Selected node for editing
                            selectedNode={selectedNode}
                            setSelectedNode={setSelectedNode}
                            // Toggle reverse handler (respects selectedNode)
                            onToggleReverse={handleToggleReverse}
                        />
                    </div>

                    {/* Floating Legend */}
                    <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, pointerEvents: 'none' }}>
                        <div className="option-card" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }}></span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Centro</span>
                            </div>
                            <div style={{ width: 1, height: 12, background: 'rgba(148,163,184,0.35)' }}></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316' }}></span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Punta</span>
                            </div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.9)', padding: '0.35rem 0.75rem', borderRadius: 999, border: '1px solid rgba(148,163,184,0.3)', fontSize: '0.65rem', color: '#94a3b8' }}>
                            Tapete: 2362mm × 1143mm
                        </div>
                    </div>
                </main>

                {/* Right Panel - WAYPOINTS INSTRUCTIONS */}
                <aside style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <WaypointsPanel
                        waypoints={routeData.waypoints}
                        instructions={routeData.instructions}
                        onDeleteSection={handleDeleteSection}
                        unit={unit}
                        isCollapsed={isWaypointsPanelCollapsed}
                        setIsCollapsed={setIsWaypointsPanelCollapsed}
                    />
                </aside>
            </div>

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
                onToggleUnit={toggleUnit}
                cursorGuideColor={cursorGuideColor}
                setCursorGuideColor={setCursorGuideColor}
                cursorGuideLineWidth={cursorGuideLineWidth}
                setCursorGuideLineWidth={setCursorGuideLineWidth}
                ghostRobotOpacity={ghostRobotOpacity}
                setGhostRobotOpacity={setGhostRobotOpacity}
                robotImageRotation={robotImageRotation}
                setRobotImageRotation={setRobotImageRotation}
            />

            {/* Robot Size Configuration Modal */}
            <RobotSizeModal
                isOpen={showRobotModal}
                robotConfig={{
                    length: robot.length,
                    width: robot.width,
                    wheelOffset: robot.wheelOffset
                }}
                onSave={(config) => {
                    setRobot(r => ({
                        ...r,
                        length: config.length,
                        width: config.width,
                        wheelOffset: config.wheelOffset
                    }));
                    saveRobotConfig(config);
                    setShowRobotModal(false);
                }}
                unit={unit}
            />

            {/* Keyboard Shortcuts Modal */}
            <ShortcutsModal
                isOpen={showShortcuts}
                onClose={() => setShowShortcuts(false)}
            />
        </div>
    );
}
