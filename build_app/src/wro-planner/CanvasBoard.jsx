import React, { useRef, useEffect, useCallback, useState } from "react";
import { DEG2RAD, RAD2DEG, SNAP_45_BASE_ANGLES } from "./domain/constants";
import { normalizeAngle, getReferencePoint, getLastPoseOfSection, projectPointWithReference, computePoseUpToSection } from "./domain/geometry";
import { checkIntersection, isPointInside, checkPathCollision, checkRotationCollision } from "./domain/collision";

const CanvasBoard = ({
    fieldKey,
    bgImage,
    bgOpacity,
    grid,
    unit,
    robot,
    robotImgObj,
    sections,
    setSections,
    pxToMmPointForCanvas,
    recalcSectionsAndConvertToMm,
    selectedSectionId,
    setSelectedSectionId,
    initialPose,
    playPose,
    isRunning,
    drawMode,
    setDrawMode,
    rulerActive,
    rulerPoints,
    setRulerPoints,
    snapGrid,
    snap45,
    setSnap45,
    referenceMode,
    setReferenceMode,
    reverseDrawing,
    setReverseDrawing,
    zoom,
    canvasBaseSize,
    setCanvasBaseSize,
    ghost,
    setGhost,
    dragging,
    setDragging,
    hoverNode,
    setHoverNode,
    draggingStart,
    setDraggingStart,
    cursorGuide,
    setCursorGuide,
    cursorGuideColor,
    cursorGuideLineWidth,
    drawSessionRef,
    drawThrottleRef,
    rightEraseTimerRef,
    rightPressActiveRef,
    actionCursorRef,
    unitToPx,
    pxToUnit,
    handleContextMenu,
    removeLastPointFromCurrentSection,
    setGrid,
    isSettingOrigin,
    setIsSettingOrigin,
    setInitialPose,
    addSection,
    ghostRobotOpacity,
    ghostOpacityOverride,
    setGhostOpacityOverride,
    robotImageRotation,
    setZoom,
    pan,
    setPan,
    // NEW: Pre-calculated path segments from parent (stateless architecture)
    calculatedPathSegments = [],
    // NEW: Selected node for editing waypoint properties
    selectedNode = null,
    setSelectedNode,
    // NEW: Toggle reverse handler from parent (respects selectedNode)
    onToggleReverse,
    // Obstacle props
    obstacles = [],
    selectedObstacleId,
    onSelectObstacle,
    onUpdateObstacle,
    onDeleteObstacle,
    collisionPadding = 5,
    preventCollisions,
    // Mission props
    missions = [],
    selectedMissionId,
    onSelectMission,
    onUpdateMission,
    onDeleteMission,
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDraggingRuler, setIsDraggingRuler] = useState(false);
    const isPanningRef = useRef(false);
    const lastPanPointRef = useRef({ x: 0, y: 0 });

    // Obstacle interaction state
    // Mode: 'none' | 'drag' | 'resize_nw' | 'resize_ne' | 'resize_sw' | 'resize_se'
    const [obstacleMode, setObstacleMode] = useState('none');
    const [activeObstacleId, setActiveObstacleId] = useState(null);
    const obstacleStartRef = useRef({ x: 0, y: 0, obsX: 0, obsY: 0, obsW: 0, obsH: 0 });

    // Mission interaction state
    const [missionMode, setMissionMode] = useState('none');
    const [activeMissionId, setActiveMissionId] = useState(null);
    const missionStartRef = useRef({ x: 0, y: 0, mX: 0, mY: 0, mSize: 0 });

    const DRAW_STEP_MIN_PX = 6;
    const DRAW_AUTO_INTERVAL_MS = 340;

    const currentSection = sections.find(s => s.id === selectedSectionId);

    // Keyboard handler
    const handleKeyDown = useCallback((e) => {
        // Safety: Ignore if typing in an input field
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
            return;
        }

        // Tab: Toggle draw/edit mode
        if (e.key === 'Tab' && !e.repeat) {
            e.preventDefault();
            setDrawMode(prev => !prev);
            return;
        }

        // Q: Toggle snap 45°
        if (e.key === 'q' || e.key === 'Q') {
            e.preventDefault();
            setSnap45(prev => !prev);
            return;
        }

        // A: Add new section
        if (e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            addSection();
            return;
        }

        // Arrow Up: Select previous section
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentIndex = sections.findIndex(s => s.id === selectedSectionId);
            if (currentIndex > 0) {
                setSelectedSectionId(sections[currentIndex - 1].id);
            }
            return;
        }

        // Arrow Down: Select next section
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const currentIndex = sections.findIndex(s => s.id === selectedSectionId);
            if (currentIndex < sections.length - 1) {
                setSelectedSectionId(sections[currentIndex + 1].id);
            }
            return;
        }

        // R: Toggle reference mode (center/tip)
        if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            setReferenceMode(prev => prev === 'center' ? 'tip' : 'center');
            return;
        }

        // O: Toggle ghost robot opacity (configured vs 100%)
        if (e.key === 'o' || e.key === 'O') {
            e.preventDefault();
            setGhostOpacityOverride(prev => !prev);
            return;
        }

        // Escape: Deselect selected node and obstacle
        if (e.key === 'Escape') {
            e.preventDefault();
            if (onSelectObstacle) {
                onSelectObstacle(null);
            }
            if (setSelectedNode) {
                setSelectedNode(null);
            }
            setDragging({ active: false, sectionId: null, index: -1 });
            setObstacleMode('none');
            setActiveObstacleId(null);
            return;
        }

        // Space: Toggle reverse direction (uses parent handler that respects selectedNode)
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            if (onToggleReverse) {
                onToggleReverse();
            } else {
                // Fallback if handler not provided
                setReverseDrawing(prev => !prev);
            }
            return;
        }

        // Delete: Priority 1 - Delete selected obstacle
        if ((e.key === 'Delete' || e.key === 'Backspace') && !isRunning) {
            // Check if an obstacle is selected
            if (selectedObstacleId && onDeleteObstacle) {
                e.preventDefault();
                onDeleteObstacle();
                return;
            }
            // Check if a mission is selected
            if (selectedMissionId && onDeleteMission) {
                e.preventDefault();
                onDeleteMission();
                return;
            }
            // Check if a node is selected via selectedNode state
            if (selectedNode && selectedNode.sectionId && selectedNode.index >= 0) {
                e.preventDefault();
                setSections(prev => {
                    const modified = prev.map(s => {
                        if (s.id !== selectedNode.sectionId) return s;
                        const newPts = s.points.filter((_, i) => i !== selectedNode.index);
                        return { ...s, points: newPts };
                    });
                    return recalcSectionsAndConvertToMm(modified);
                });
                if (setSelectedNode) {
                    setSelectedNode(null);
                }
                setDragging({ active: false, sectionId: null, index: -1 });
                return;
            }
            // Fallback: check if a point is selected via dragging state
            if (dragging.sectionId && dragging.index > -1) {
                e.preventDefault();
                setSections(prev => {
                    const modified = prev.map(s => {
                        if (s.id !== dragging.sectionId) return s;
                        const newPts = s.points.filter((_, i) => i !== dragging.index);
                        return { ...s, points: newPts };
                    });
                    return recalcSectionsAndConvertToMm(modified);
                });
                setDragging({ active: false, sectionId: null, index: -1 });
            }
        }
    }, [dragging, isRunning, sections, selectedSectionId, initialPose, setDrawMode, setSnap45, addSection, setSelectedSectionId, setReferenceMode, setReverseDrawing, setGhostOpacityOverride, setSections, setDragging, pxToUnit, unitToPx, selectedNode, setSelectedNode, onToggleReverse, selectedObstacleId, onDeleteObstacle, onSelectObstacle, selectedMissionId, onDeleteMission, onSelectMission, recalcSectionsAndConvertToMm]);

    const handleKeyUp = useCallback((e) => {
        if (e.code === 'Space') {
            e.preventDefault();
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    // Helper to get canvas position
    const canvasPos = useCallback((e, applySnapping = true) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const rawX = (e.clientX - rect.left) / zoom;
        const rawY = (e.clientY - rect.top) / zoom;

        if (!applySnapping) return { x: rawX, y: rawY };

        let x = rawX;
        let y = rawY;

        if (snapGrid) {
            const sizePx = unitToPx(grid.cellSize);
            const offX = grid.offsetX;
            const offY = grid.offsetY;
            x = Math.round((x - offX) / sizePx) * sizePx + offX;
            y = Math.round((y - offY) / sizePx) * sizePx + offY;
        }
        return { x, y };
    }, [zoom, snapGrid, grid, unitToPx]);

    const hitTestNode = useCallback((points, p, r = 8) => {
        const rSq = r * r;
        for (let i = 0; i < points.length; i++) {
            const dx = points[i].x - p.x;
            const dy = points[i].y - p.y;
            if (dx * dx + dy * dy <= rSq) return i;
        }
        return -1;
    }, []);

    // Obstacle hit test: check if point hits a resize handle
    const hitTestObstacleHandle = useCallback((obs, px, py, handleSize = 10) => {
        const corners = ['nw', 'ne', 'sw', 'se'];
        const offsets = [
            { x: obs.x - obs.w / 2, y: obs.y - obs.h / 2 },
            { x: obs.x + obs.w / 2, y: obs.y - obs.h / 2 },
            { x: obs.x - obs.w / 2, y: obs.y + obs.h / 2 },
            { x: obs.x + obs.w / 2, y: obs.y + obs.h / 2 },
        ];
        for (let i = 0; i < 4; i++) {
            const { x, y } = offsets[i];
            if (Math.abs(px - x) <= handleSize && Math.abs(py - y) <= handleSize) {
                return corners[i];
            }
        }
        return null;
    }, []);

    // Obstacle hit test: check if point is inside obstacle body
    const hitTestObstacle = useCallback((obs, px, py) => {
        const halfW = obs.w / 2;
        const halfH = obs.h / 2;
        return px >= obs.x - halfW && px <= obs.x + halfW &&
            py >= obs.y - halfH && py <= obs.y + halfH;
    }, []);

    // Mission hit test: check if point hits a resize handle
    const hitTestMissionHandle = useCallback((mission, px, py, handleSize = 10) => {
        const halfSize = mission.size / 2;
        const corners = ['nw', 'ne', 'sw', 'se'];
        const offsets = [
            { x: mission.x - halfSize, y: mission.y - halfSize },
            { x: mission.x + halfSize, y: mission.y - halfSize },
            { x: mission.x - halfSize, y: mission.y + halfSize },
            { x: mission.x + halfSize, y: mission.y + halfSize },
        ];
        for (let i = 0; i < 4; i++) {
            const { x, y } = offsets[i];
            if (Math.abs(px - x) <= handleSize && Math.abs(py - y) <= handleSize) {
                return corners[i];
            }
        }
        return null;
    }, []);

    // Mission hit test: check if point is inside mission body (circular)
    const hitTestMission = useCallback((mission, px, py) => {
        const dx = px - mission.x;
        const dy = py - mission.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= mission.size / 2 + 5; // 5px tolerance
    }, []);

    const drawRobot = useCallback((ctx, pose, isGhost = false, showModeIndicator = false) => {
        ctx.save();
        ctx.translate(pose.x, pose.y);
        ctx.rotate(pose.theta);
        const wPx = unitToPx(robot.width);
        const lPx = unitToPx(robot.length);

        // Calculate dynamic opacity for ghost
        const ghostOpacity = ghostOpacityOverride ? 1.0 : ghostRobotOpacity;

        if (robotImgObj) {
            ctx.globalAlpha = isGhost ? ghostOpacity : (robot.opacity ?? 1);
            // TODO: Handle image offset if needed, for now assume image center is robot center
            // If we want image to respect offset, we need to know where the "wheels" are in the image.
            // For now, let's keep image centered on the pose.

            // Apply robot image rotation
            const rotationRad = (robotImageRotation || 0) * DEG2RAD;
            ctx.rotate(rotationRad);
            ctx.drawImage(robotImgObj, -lPx / 2, -wPx / 2, lPx, wPx);
            ctx.rotate(-rotationRad); // Reset rotation

            ctx.globalAlpha = 1; // Reset alpha
        } else {
            ctx.globalAlpha = isGhost ? ghostOpacity : (robot.opacity ?? 1);
            if (pose.isInvalid) {
                ctx.fillStyle = isGhost ? '#ef444466' : '#ef4444'; // Red for invalid
            } else {
                ctx.fillStyle = isGhost ? `${robot.color}66` : robot.color;
            }

            const wheelOffsetVal = robot.wheelOffset !== undefined ? robot.wheelOffset : (robot.length / 2);
            const wheelOffsetPx = unitToPx(wheelOffsetVal);

            // Coordinate system: X+ is forward (direction of arrow)
            // Wheel Axis is at (0,0)
            // Front of robot is at +wheelOffsetPx
            // Back of robot is at +wheelOffsetPx - lPx
            const frontX = wheelOffsetPx;
            const backX = wheelOffsetPx - lPx;

            ctx.fillRect(backX, -wPx / 2, lPx, wPx);
            ctx.strokeStyle = isGhost ? '#666' : '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(backX, -wPx / 2, lPx, wPx);

            // Wheels (Centered at 0,0)
            ctx.fillStyle = '#111';
            const wheelWidth = lPx / 2;
            const wheelX = -wheelWidth / 2;

            // Draw Axis Line (at 0,0)
            ctx.beginPath();
            ctx.moveTo(0, -wPx / 2);
            ctx.lineTo(0, wPx / 2);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw Wheels
            ctx.fillRect(wheelX, -wPx / 2 - 4, wheelWidth, 4);
            ctx.fillRect(wheelX, wPx / 2, wheelWidth, 4);

            // Direction arrow
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(lPx / 2, 0);
            ctx.strokeStyle = isGhost ? '#fff' : '#000';
            ctx.lineWidth = 2; // Restore line width for arrow
            ctx.stroke();
            ctx.globalAlpha = 1; // Reset alpha
        }

        // Directional arrow indicator (only for ghost robot)
        if (isGhost) {
            const arrowLength = 30; // Length of the arrow from center
            const arrowHeadSize = 8;

            ctx.globalAlpha = ghostOpacity; // Match ghost opacity
            ctx.strokeStyle = reverseDrawing ? '#ef4444' : '#22c55e'; // red-500 : green-500
            ctx.fillStyle = reverseDrawing ? '#ef4444' : '#22c55e';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';

            // Arrow direction: forward (positive X) or backward (negative X)
            const direction = reverseDrawing ? -1 : 1;
            const endX = arrowLength * direction;

            // Draw arrow line from center
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(endX, 0);
            ctx.stroke();

            // Draw arrowhead
            ctx.beginPath();
            ctx.moveTo(endX, 0);
            ctx.lineTo(endX - arrowHeadSize * direction, -arrowHeadSize / 2);
            ctx.lineTo(endX - arrowHeadSize * direction, arrowHeadSize / 2);
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = 1; // Reset alpha
        }

        // Mode indicator overlay (only for main robot, not ghost)
        if (showModeIndicator && !isGhost) {
            const overlaySize = 20; // Diameter of the circle
            const overlayRadius = overlaySize / 2;

            // Position at center of robot (wheel axis at 0,0)
            const overlayX = 0;
            const overlayY = 0;

            // Draw circle background
            ctx.beginPath();
            ctx.arc(overlayX, overlayY, overlayRadius, 0, Math.PI * 2);
            ctx.fillStyle = drawMode ? 'rgba(34, 197, 94, 0.9)' : 'rgba(59, 130, 246, 0.9)'; // green-500 : blue-500
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw icon
            ctx.strokeStyle = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (drawMode) {
                // Pencil icon
                const iconSize = 8;
                ctx.save();
                ctx.translate(overlayX, overlayY);
                ctx.rotate(Math.PI / 4); // 45 degrees

                // Pencil body
                ctx.beginPath();
                ctx.moveTo(-iconSize / 2, iconSize / 2);
                ctx.lineTo(iconSize / 2, -iconSize / 2);
                ctx.stroke();

                // Pencil tip
                ctx.beginPath();
                ctx.moveTo(iconSize / 2, -iconSize / 2);
                ctx.lineTo(iconSize / 2 + 2, -iconSize / 2 - 2);
                ctx.stroke();

                ctx.restore();
            } else {
                // Move arrows icon (4-way arrows)
                const arrowSize = 6;

                // Up arrow
                ctx.beginPath();
                ctx.moveTo(overlayX, overlayY - arrowSize);
                ctx.lineTo(overlayX - 2, overlayY - arrowSize + 3);
                ctx.moveTo(overlayX, overlayY - arrowSize);
                ctx.lineTo(overlayX + 2, overlayY - arrowSize + 3);
                ctx.stroke();

                // Down arrow
                ctx.beginPath();
                ctx.moveTo(overlayX, overlayY + arrowSize);
                ctx.lineTo(overlayX - 2, overlayY + arrowSize - 3);
                ctx.moveTo(overlayX, overlayY + arrowSize);
                ctx.lineTo(overlayX + 2, overlayY + arrowSize - 3);
                ctx.stroke();

                // Left arrow
                ctx.beginPath();
                ctx.moveTo(overlayX - arrowSize, overlayY);
                ctx.lineTo(overlayX - arrowSize + 3, overlayY - 2);
                ctx.moveTo(overlayX - arrowSize, overlayY);
                ctx.lineTo(overlayX - arrowSize + 3, overlayY + 2);
                ctx.stroke();

                // Right arrow
                ctx.beginPath();
                ctx.moveTo(overlayX + arrowSize, overlayY);
                ctx.lineTo(overlayX + arrowSize - 3, overlayY - 2);
                ctx.moveTo(overlayX + arrowSize, overlayY);
                ctx.lineTo(overlayX + arrowSize - 3, overlayY + 2);
                ctx.stroke();
            }
        }

        ctx.restore();
    }, [robot, robotImgObj, unitToPx, drawMode, reverseDrawing, ghostRobotOpacity, ghostOpacityOverride, robotImageRotation]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Background
        if (bgImage) {
            ctx.globalAlpha = bgOpacity;
            ctx.drawImage(bgImage, 0, 0, w, h);
            ctx.globalAlpha = 1;
        }

        // Grid
        const sizePx = unitToPx(grid.cellSize);
        if (sizePx > 3) {
            ctx.beginPath();
            // Parse hex color to rgb to apply alpha
            const hex = grid.color || '#ffffffff';
            const r = parseInt(hex.slice(1, 40), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            ctx.strokeStyle = `rgba(${r},${g},${b},${grid.lineAlpha})`;
            ctx.lineWidth = 1;
            const offX = grid.offsetX % sizePx;
            const offY = grid.offsetY % sizePx;
            for (let x = offX; x <= w; x += sizePx) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
            for (let y = offY; y <= h; y += sizePx) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
            ctx.stroke();
        }

        // =====================================================================
        // PATH SEGMENTS - Use pre-calculated data from parent (STATELESS)
        // This ensures the canvas renders immediately when sections change
        // =====================================================================
        if (calculatedPathSegments && calculatedPathSegments.length > 0) {
            // Group segments by section for drawing
            const segmentsBySectionId = {};
            calculatedPathSegments.forEach(seg => {
                const sectionId = seg.sectionId || 'default';
                if (!segmentsBySectionId[sectionId]) {
                    segmentsBySectionId[sectionId] = [];
                }
                segmentsBySectionId[sectionId].push(seg);
            });

            // Draw each section's segments
            Object.entries(segmentsBySectionId).forEach(([sectionId, segments]) => {
                const section = sections.find(s => s.id === sectionId);
                if (section && !section.isVisible) return;

                segments.forEach(seg => {
                    ctx.beginPath();
                    ctx.strokeStyle = seg.color || '#888888';
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';

                    // Draw dashed for reverse segments
                    if (seg.isReverse) {
                        ctx.setLineDash([6, 4]);
                    } else {
                        ctx.setLineDash([]);
                    }

                    ctx.moveTo(seg.x1, seg.y1);
                    ctx.lineTo(seg.x2, seg.y2);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw direction arrow in middle of segment
                    const midX = (seg.x1 + seg.x2) / 2;
                    const midY = (seg.y1 + seg.y2) / 2;
                    const segmentAngle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);

                    ctx.save();
                    ctx.translate(midX, midY);
                    ctx.rotate(segmentAngle);
                    ctx.fillStyle = seg.color || '#888888';
                    ctx.beginPath();
                    ctx.moveTo(8, 0);
                    ctx.lineTo(0, -4);
                    ctx.lineTo(0, 4);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                });
            });
        }
        // NOTE: Legacy fallback drawing removed - component now ONLY uses calculatedPathSegments

        // =====================================================================
        // OBSTACLES - Draw interactive obstacles
        // =====================================================================
        obstacles.forEach(obs => {
            ctx.save();
            ctx.translate(obs.x, obs.y);
            ctx.rotate((obs.rotation || 0) * DEG2RAD);

            // Draw Padded Boundary (Safety Margin)
            if (preventCollisions && collisionPadding > 0) {
                try {
                    const paddingPx = unitToPx(collisionPadding);
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);
                    // Rect is centered, so from -w/2-p to w/2+p
                    // w starts at -w/2. width is w. 
                    // strokeRect(x,y,w,h)
                    ctx.strokeRect(
                        (-obs.w / 2) - paddingPx,
                        (-obs.h / 2) - paddingPx,
                        obs.w + paddingPx * 2,
                        obs.h + paddingPx * 2
                    );
                    ctx.setLineDash([]);
                } catch (err) {
                    console.error("Error drawing collision boundary:", err);
                }
            }

            // Obstacle body
            ctx.fillStyle = obs.color || '#f97316';
            ctx.globalAlpha = 0.7;
            ctx.fillRect(-obs.w / 2, -obs.h / 2, obs.w, obs.h);
            ctx.globalAlpha = 1;

            // Border
            ctx.strokeStyle = selectedObstacleId === obs.id ? '#06b6d4' : '#c2410c';
            ctx.lineWidth = selectedObstacleId === obs.id ? 3 : 2;
            ctx.strokeRect(-obs.w / 2, -obs.h / 2, obs.w, obs.h);

            // Resize handles (only if selected)
            if (selectedObstacleId === obs.id) {
                const handleSize = 8;
                const corners = [
                    { x: -obs.w / 2, y: -obs.h / 2 },
                    { x: obs.w / 2, y: -obs.h / 2 },
                    { x: -obs.w / 2, y: obs.h / 2 },
                    { x: obs.w / 2, y: obs.h / 2 },
                ];
                corners.forEach(({ x, y }) => {
                    ctx.fillStyle = '#06b6d4';
                    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
                });
            }

            ctx.restore();
        });

        // =====================================================================
        // MISSIONS - Draw mission markers (no collision detection)
        // =====================================================================
        missions.forEach(mission => {
            const { x, y, size, color, shape, label, rotation, opacity } = mission;
            const halfSize = size / 2;
            const isSelected = selectedMissionId === mission.id;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((rotation || 0) * Math.PI / 180);
            ctx.globalAlpha = opacity || 0.7;

            // Draw shape based on type
            switch (shape) {
                case 'square':
                    ctx.fillStyle = color;
                    ctx.fillRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
                    ctx.strokeStyle = isSelected ? '#06b6d4' : '#1e3a1e';
                    ctx.lineWidth = isSelected ? 3 : 2;
                    ctx.strokeRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
                    break;
                case 'triangle':
                    ctx.beginPath();
                    ctx.moveTo(0, -halfSize);
                    ctx.lineTo(halfSize, halfSize);
                    ctx.lineTo(-halfSize, halfSize);
                    ctx.closePath();
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = isSelected ? '#06b6d4' : '#1e3a1e';
                    ctx.lineWidth = isSelected ? 3 : 2;
                    ctx.stroke();
                    break;
                case 'star':
                    const spikes = 5;
                    const outerRadius = halfSize;
                    const innerRadius = halfSize * 0.5;
                    ctx.beginPath();
                    for (let i = 0; i < spikes * 2; i++) {
                        const radius = i % 2 === 0 ? outerRadius : innerRadius;
                        const angle = (Math.PI / spikes) * i - Math.PI / 2;
                        const sx = Math.cos(angle) * radius;
                        const sy = Math.sin(angle) * radius;
                        if (i === 0) ctx.moveTo(sx, sy);
                        else ctx.lineTo(sx, sy);
                    }
                    ctx.closePath();
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = isSelected ? '#06b6d4' : '#1e3a1e';
                    ctx.lineWidth = isSelected ? 3 : 2;
                    ctx.stroke();
                    break;
                case 'circle':
                default:
                    ctx.beginPath();
                    ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = isSelected ? '#06b6d4' : '#1e3a1e';
                    ctx.lineWidth = isSelected ? 3 : 2;
                    ctx.stroke();
                    break;
            }

            // Draw crosshair in center
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-halfSize * 0.4, 0);
            ctx.lineTo(halfSize * 0.4, 0);
            ctx.moveTo(0, -halfSize * 0.4);
            ctx.lineTo(0, halfSize * 0.4);
            ctx.stroke();

            // Draw label if exists
            if (label) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Draw label background
                const textWidth = ctx.measureText(label).width;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(-textWidth / 2 - 4, halfSize + 6, textWidth + 8, 16);
                
                ctx.fillStyle = '#fff';
                ctx.fillText(label, 0, halfSize + 14);
            }

            // Draw selection ring and handles
            if (isSelected) {
                ctx.globalAlpha = 1;
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(0, 0, halfSize + 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw resize handles
                const handleSize = 8;
                const handlePositions = [
                    { x: -halfSize, y: -halfSize },
                    { x: halfSize, y: -halfSize },
                    { x: -halfSize, y: halfSize },
                    { x: halfSize, y: halfSize },
                ];
                handlePositions.forEach(({ x: hx, y: hy }) => {
                    ctx.fillStyle = '#06b6d4';
                    ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
                });
            }

            ctx.restore();
        });

        // NODES - Still drawn from sections for edit mode interaction
        sections.forEach(s => {
            if (!s.isVisible || s.points.length === 0) return;

            // Nodes
            if ((selectedSectionId === s.id && drawMode) || !drawMode) {
                s.points.forEach((p, i) => {
                    const isSelected = dragging.sectionId === s.id && dragging.index === i;
                    const isHovered = hoverNode.sectionId === s.id && hoverNode.index === i;
                    const isNodeSelected = selectedNode && selectedNode.sectionId === s.id && selectedNode.index === i;
                    const isActive = isSelected || isHovered;
                    const isLastActive = drawMode && selectedSectionId === s.id && i === s.points.length - 1;

                    // Draw glow effect for selected node
                    if (isNodeSelected) {
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(6, 182, 212, 0.3)'; // cyan glow
                        ctx.fill();
                        ctx.strokeStyle = '#06b6d4'; // cyan-500
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }

                    // Draw main node
                    ctx.beginPath();
                    const radius = (isActive || isLastActive || isNodeSelected) ? 6 : 4;
                    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

                    // Color based on reverse property and selection
                    if (isNodeSelected) {
                        ctx.fillStyle = p.reverse ? '#ef4444' : '#22c55e'; // red for reverse, green for forward
                    } else if (isActive || isLastActive) {
                        ctx.fillStyle = '#fff';
                    } else {
                        ctx.fillStyle = s.color;
                    }
                    ctx.fill();

                    ctx.strokeStyle = isNodeSelected ? '#06b6d4' : ((isActive || isLastActive) ? s.color : '#000');
                    ctx.lineWidth = (isActive || isLastActive || isNodeSelected) ? 2 : 1;
                    ctx.stroke();

                    // Draw direction indicator for selected node
                    if (isNodeSelected) {
                        ctx.save();
                        ctx.font = 'bold 8px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = p.reverse ? '#ef4444' : '#22c55e';
                        ctx.fillText(p.reverse ? 'R' : 'F', p.x, p.y + 18);
                        ctx.restore();
                    }

                    // Draw point order number
                    ctx.save();
                    ctx.fillStyle = '#1e293b';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const bgPadding = 3;
                    const textMetrics = ctx.measureText((i + 1).toString());
                    const textWidth = textMetrics.width;
                    const textX = p.x + 12;
                    const textY = p.y - 12;

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.fillRect(textX - textWidth / 2 - bgPadding, textY - 6, textWidth + bgPadding * 2, 12);

                    ctx.fillStyle = '#1e293b';
                    ctx.fillText((i + 1).toString(), textX, textY);
                    ctx.restore();
                });
            }
        });

        // Ghost robot when hovering over a point in edit mode
        if (!drawMode && !isRunning && hoverNode.sectionId && hoverNode.index >= 0) {
            const hoveredSection = sections.find(s => s.id === hoverNode.sectionId);
            if (hoveredSection && hoveredSection.points.length > 0) {
                // Calculate pose at the hovered point
                let poseAtPoint = computePoseUpToSection(sections, initialPose, hoveredSection.id, unitToPx);

                // Each point generates a rotate + move action pair
                // To show robot AT point index N, we need to apply all actions that lead TO that point
                // Point 0 is after action 0 (rotate) + action 1 (move)
                // Point 1 is after actions 0,1,2,3
                // So for point index N, apply actions 0 through (2*N + 1)
                const actionsToApply = (hoverNode.index + 1) * 2;
                for (let i = 0; i < actionsToApply && i < hoveredSection.actions.length; i++) {
                    const action = hoveredSection.actions[i];
                    if (action.type === 'rotate') {
                        poseAtPoint = {
                            ...poseAtPoint,
                            theta: poseAtPoint.theta + action.angle * DEG2RAD
                        };
                    } else if (action.type === 'move') {
                        const dist = unitToPx(action.distance);
                        poseAtPoint = {
                            x: poseAtPoint.x + Math.cos(poseAtPoint.theta) * dist,
                            y: poseAtPoint.y + Math.sin(poseAtPoint.theta) * dist,
                            theta: poseAtPoint.theta
                        };
                    }
                }

                drawRobot(ctx, poseAtPoint, true);
            }
        }

        // Ghost
        if (ghost && ghost.active) {
            // Draw preview line
            if (currentSection) {
                ctx.beginPath();
                ctx.strokeStyle = currentSection.color || '#000';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.moveTo(ghost.originX, ghost.originY);
                ctx.lineTo(ghost.displayX, ghost.displayY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            drawRobot(ctx, ghost, true);

            // Draw Rotation Collision Circle
            if (ghost.isInvalid && ghost.collisionType === 'rotation') {
                const rWidth = unitToPx(robot.width) / 2;
                const rLength = unitToPx(robot.length) / 2;
                const radius = Math.hypot(rWidth, rLength);

                ctx.save();
                ctx.beginPath();
                ctx.arc(ghost.x, ghost.y, radius, 0, Math.PI * 2);
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
                ctx.fill();
                ctx.setLineDash([]);
                ctx.restore();
            }
        }

        // Robot
        if (isRunning) {
            drawRobot(ctx, playPose, false, true);
            // Action overlay
            if (actionCursorRef.current && actionCursorRef.current.list.length > 0) {
                const ac = actionCursorRef.current;
                const total = ac.list.length;
                const current = Math.min(ac.idx + 1, total);
                ctx.save();
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(5, 5, 120, 20);
                ctx.fillStyle = '#fff';
                ctx.font = '12px sans-serif';
                ctx.fillText(`Acción ${current}/${total}`, 10, 18);
                ctx.restore();
            }
        } else {
            // Draw robot at initial pose when not running
            drawRobot(ctx, initialPose, false, true);
        }

        // Ruler
        if (rulerActive && rulerPoints.start && rulerPoints.end) {
            ctx.save();
            ctx.strokeStyle = '#f43f5e'; ctx.fillStyle = '#f43f5e'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(rulerPoints.start.x, rulerPoints.start.y); ctx.lineTo(rulerPoints.end.x, rulerPoints.end.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(rulerPoints.start.x, rulerPoints.start.y, 4, 0, 2 * Math.PI); ctx.fill();
            ctx.beginPath(); ctx.arc(rulerPoints.end.x, rulerPoints.end.y, 4, 0, 2 * Math.PI); ctx.fill();
            const dx = rulerPoints.end.x - rulerPoints.start.x; const dy = rulerPoints.end.y - rulerPoints.start.y;
            const distPx = Math.hypot(dx, dy); const distCm = pxToUnit(distPx);
            const distLabel = unit === 'mm' ? `${(distCm * 10).toFixed(1)} mm` : `${distCm.toFixed(2)} cm`;
            const label = `${distLabel} (${dx.toFixed(0)}px, ${dy.toFixed(0)}px)`;
            const angle = Math.atan2(dy, dx); const textAngle = (angle > -Math.PI / 2 && angle < Math.PI / 2) ? angle : angle + Math.PI;
            const midX = rulerPoints.start.x + dx / 2; const midY = rulerPoints.start.y + dy / 2;
            ctx.font = 'bold 13px sans-serif'; const textMetrics = ctx.measureText(label);
            ctx.translate(midX, midY); ctx.rotate(textAngle);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; ctx.fillRect(-textMetrics.width / 2 - 4, -18, textMetrics.width + 8, 18);
            ctx.fillStyle = '#f43f5e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, -9);
            ctx.restore();
        }

        // Cursor Guide
        if (cursorGuide.visible) {
            ctx.save();
            // Convert hex to rgba with alpha
            const hex = cursorGuideColor || '#64748b';
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.45)`;
            ctx.lineWidth = cursorGuideLineWidth || 1;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(cursorGuide.x, 0);
            ctx.lineTo(cursorGuide.x, h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, cursorGuide.y);
            ctx.lineTo(w, cursorGuide.y);
            ctx.stroke();
            ctx.restore();
        }

    }, [bgImage, bgOpacity, grid, unitToPx, sections, selectedSectionId, drawMode, hoverNode, ghost, isRunning, playPose, robot, robotImgObj, actionCursorRef, initialPose, drawRobot, rulerActive, rulerPoints, pxToUnit, unit, cursorGuide, calculatedPathSegments, dragging, cursorGuideColor, cursorGuideLineWidth, selectedNode, obstacles, selectedObstacleId, missions, selectedMissionId]);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const { width, height } = canvasBaseSize;
        if (!width || !height) return;
        cvs.style.width = `${width * zoom}px`;
        cvs.style.height = `${height * zoom}px`;
        cvs.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
    }, [canvasBaseSize, zoom, pan]);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        // Zoom functionality
        const delta = -Math.sign(e.deltaY) * 0.1;
        setZoom(prev => Math.min(Math.max(0.1, prev + delta), 5));
    }, [setZoom]);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (cvs) {
            cvs.addEventListener('wheel', handleWheel, { passive: false });
            return () => cvs.removeEventListener('wheel', handleWheel);
        }
    }, [handleWheel]);

    useEffect(() => {
        draw();
    }, [draw]);

    // Helper to detect click on a line segment
    const hitTestSegment = (startPose, points, p, threshold = 8) => {
        // Check segment from startPose to first point
        if (points.length > 0) {
            const p1 = startPose;
            const p2 = points[0];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            const len = Math.sqrt(lenSq);

            if (len > 0) {
                const t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq;
                if (t >= 0 && t <= 1) {
                    const projX = p1.x + t * dx;
                    const projY = p1.y + t * dy;
                    const dist = Math.hypot(p.x - projX, p.y - projY);
                    if (dist <= threshold) {
                        return { index: -1, point: { x: projX, y: projY } };
                    }
                }
            }
        }

        // Check segments between points
        if (points.length < 2) return null;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            const len = Math.sqrt(lenSq);

            if (len === 0) continue;

            const t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / lenSq;

            if (t >= 0 && t <= 1) {
                const projX = p1.x + t * dx;
                const projY = p1.y + t * dy;
                const dist = Math.hypot(p.x - projX, p.y - projY);

                if (dist <= threshold) {
                    return { index: i, point: { x: projX, y: projY } };
                }
            }
        }
        return null;
    };

    const onCanvasDown = (e) => {
        if (isSettingOrigin) return;

        // Middle mouse button (Panning)
        if (e.button === 1) {
            e.preventDefault();
            isPanningRef.current = true;
            lastPanPointRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (e.button === 2) {
            e.preventDefault();
            if (!drawMode || !currentSection) return;
            // If dragging/selected, deselect
            if (dragging.active || dragging.sectionId) {
                setDragging({ active: false, sectionId: null, index: -1 });
                return;
            }
            rightPressActiveRef.current = true;
            removeLastPointFromCurrentSection();
            clearInterval(rightEraseTimerRef.current);
            rightEraseTimerRef.current = window.setInterval(() => {
                if (rightPressActiveRef.current) {
                    removeLastPointFromCurrentSection();
                }
            }, 120);
            return;
        }
        if (rulerActive) {
            const p = canvasPos(e, false);
            setRulerPoints({ start: p, end: p });
            setIsDraggingRuler(true);
            return;
        }
        if (e.button !== 0) return;

        // Draw Mode: Add points to end
        if (drawMode && currentSection) {
            const basePose = currentSection.points.length
                ? getLastPoseOfSection(currentSection, sections, initialPose, unitToPx)
                : computePoseUpToSection(sections, initialPose, currentSection.id, unitToPx);
            drawSessionRef.current = {
                active: true,
                lastPoint: { x: basePose.x, y: basePose.y, heading: basePose.theta },
                addedDuringDrag: false,
            };
            drawThrottleRef.current.lastAutoAddTs = 0;
            return;
        }

        // Edit Mode (Not Draw Mode)
        if (!drawMode) {
            const p = canvasPos(e, false); // Use raw coordinates for obstacle interaction

            // PRIORITY 1: Check resize handles on selected obstacle
            if (selectedObstacleId) {
                const obs = obstacles.find(o => o.id === selectedObstacleId);
                if (obs) {
                    const handle = hitTestObstacleHandle(obs, p.x, p.y);
                    if (handle) {
                        setObstacleMode(`resize_${handle}`);
                        setActiveObstacleId(obs.id);
                        obstacleStartRef.current = {
                            x: p.x, y: p.y,
                            obsX: obs.x, obsY: obs.y,
                            obsW: obs.w, obsH: obs.h
                        };
                        return;
                    }
                }
            }

            // PRIORITY 2: Check obstacle body (Move/Select)
            // Use raw coordinates for obstacle body hit test too
            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obs = obstacles[i];
                if (hitTestObstacle(obs, p.x, p.y)) {
                    if (onSelectObstacle) onSelectObstacle(obs.id);
                    // Also select node null to avoid conflicts
                    if (setSelectedNode) setSelectedNode(null);
                    // Deselect mission
                    if (onSelectMission) onSelectMission(null);

                    setObstacleMode('drag');
                    setActiveObstacleId(obs.id);
                    obstacleStartRef.current = { x: p.x, y: p.y, obsX: obs.x, obsY: obs.y };
                    return;
                }
            }

            // PRIORITY 3: Check mission resize handles on selected mission
            if (selectedMissionId) {
                const mission = missions.find(m => m.id === selectedMissionId);
                if (mission) {
                    const handle = hitTestMissionHandle(mission, p.x, p.y);
                    if (handle) {
                        setMissionMode(`resize_${handle}`);
                        setActiveMissionId(mission.id);
                        missionStartRef.current = {
                            x: p.x, y: p.y,
                            mX: mission.x, mY: mission.y,
                            mSize: mission.size
                        };
                        return;
                    }
                }
            }

            // PRIORITY 4: Check mission body (Move/Select)
            for (let i = missions.length - 1; i >= 0; i--) {
                const mission = missions[i];
                if (hitTestMission(mission, p.x, p.y)) {
                    if (onSelectMission) onSelectMission(mission.id);
                    // Deselect node and obstacle
                    if (setSelectedNode) setSelectedNode(null);
                    if (onSelectObstacle) onSelectObstacle(null);

                    setMissionMode('drag');
                    setActiveMissionId(mission.id);
                    missionStartRef.current = { x: p.x, y: p.y, mX: mission.x, mY: mission.y };
                    return;
                }
            }

            // If we clicked on empty space and have an obstacle selected, deselect it
            // UNLESS we hit a node or segment (handled below)
            const pSnap = canvasPos(e); // Use snapped for nodes

            // 1. Check if clicking on initial pose
            if (Math.hypot(initialPose.x - pSnap.x, initialPose.y - pSnap.y) <= 10) {
                setDraggingStart(true);
                // Also deselect obstacle and mission if any
                if (onSelectObstacle) onSelectObstacle(null);
                if (onSelectMission) onSelectMission(null);
                return;
            }

            // 2. Check if clicking on existing point (Select for editing or drag)
            // First, check ALL sections for node hits, not just current section
            for (const section of sections) {
                if (!section.isVisible) continue;
                const idx = hitTestNode(section.points, pSnap, 10);
                if (idx > -1) {
                    // Set as selected node for editing
                    if (setSelectedNode) {
                        setSelectedNode({ sectionId: section.id, index: idx });
                    }
                    // Deselect obstacle and mission
                    if (onSelectObstacle) onSelectObstacle(null);
                    if (onSelectMission) onSelectMission(null);

                    // Also set as dragging if it's the current section
                    if (section.id === currentSection?.id) {
                        setDragging({ active: true, sectionId: section.id, index: idx });
                    } else {
                        // Switch to that section
                        setSelectedSectionId(section.id);
                    }
                    return;
                }
            }

            // 3. Click on empty area - deselect any selected node, obstacle AND mission
            if (setSelectedNode) {
                setSelectedNode(null);
            }
            if (onSelectObstacle) {
                onSelectObstacle(null);
            }
            if (onSelectMission) {
                onSelectMission(null);
            }

            // 4. Check if clicking on a segment (Insert Point) - only for current section
            const startPose = computePoseUpToSection(sections, initialPose, currentSection.id, unitToPx);
            const hitSegment = hitTestSegment(startPose, currentSection.points, pSnap, 8);
            if (hitSegment) {
                const { index, point } = hitSegment;
                // Insert point at index + 1
                // If index is -1, insert at 0
                const prevPoint = index === -1 ? { ...startPose, reference: 'center', reverse: false } : currentSection.points[index];
                const pointMm = pxToMmPointForCanvas(point.x, point.y);
                const newPoint = {
                    x: pointMm.x,
                    y: pointMm.y,
                    reverse: prevPoint.reverse,
                    reference: prevPoint.reference,
                    heading: undefined // Allow auto-calculation based on segment
                };

                // COLLISION CHECK
                if (preventCollisions) {
                    try {
                        const paddingPx = unitToPx(collisionPadding);
                        const widthPx = unitToPx(robot.width);
                        const lengthPx = unitToPx(robot.length);
                        const robotPx = { width: widthPx, length: lengthPx };

                        // 1. Rotation Check at New Point
                        // Calculate distance to obstacles. If < radius, block.
                        if (checkRotationCollision(newPoint, obstacles, robotPx, paddingPx)) return;

                        // 2. Path Check (Previous -> New)
                        // Check if point itself is inside an *inflated* obstacle (covered by rotation check mostly, but path check covers edges)
                        // Use checkIntersection for a 0-length segment to trigger point-inside check with padding
                        const obsHit = checkIntersection(newPoint, newPoint, obstacles, paddingPx);
                        if (obsHit) return;

                        const width = unitToPx(robot.width);

                        // Check intersection with PREVIOUS point
                        const prevP = prevPoint;
                        if (checkPathCollision(prevP, newPoint, width, obstacles, paddingPx)) return;

                        // Check intersection with NEXT point
                        if (index + 1 < currentSection.points.length) {
                            const nextP = currentSection.points[index + 1];
                            if (checkPathCollision(newPoint, nextP, width, obstacles, paddingPx)) return;
                        }
                    } catch (err) {
                        console.error("Error in onCanvasClick collision check:", err);
                        // In case of error, assume collision to be safe (or safe to ignore? better safe to ignore to not block flow)
                        // Actually, if error, we should probably allow the click but log it.
                    }
                }

                setSections(prev => {
                    const modified = prev.map(s => {
                        if (s.id !== currentSection.id) return s;
                        const newPts = [...s.points];
                        newPts.splice(index + 1, 0, newPoint);
                        return { ...s, points: newPts };
                    });
                    return recalcSectionsAndConvertToMm(modified);
                });

                // Select the newly created point
                setDragging({ active: true, sectionId: currentSection.id, index: index + 1 });
                return;
            }

            // If clicked on empty space, deselect
            setDragging({ active: false, sectionId: null, index: -1 });
        }
    };

    const onCanvasMove = (e) => {
        if (isPanningRef.current) {
            const dx = e.clientX - lastPanPointRef.current.x;
            const dy = e.clientY - lastPanPointRef.current.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPanPointRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (!robot) return; // Safety check

        const rawPoint = canvasPos(e, false);
        setCursorGuide({
            x: rawPoint.x,
            y: rawPoint.y,
            screenX: e.clientX,
            screenY: e.clientY,
            visible: true,
            label: `${Math.round(rawPoint.x)}, ${Math.round(rawPoint.y)}`
        });

        if (!drawMode || !currentSection) {
            setGhost(prev => (prev.active ? { ...prev, active: false } : prev));
        }

        // Handle obstacle drag/resize
        if (obstacleMode !== 'none' && activeObstacleId) {
            const obs = obstacles.find(o => o.id === activeObstacleId);
            if (!obs) return;

            const start = obstacleStartRef.current;
            const dx = rawPoint.x - start.x;
            const dy = rawPoint.y - start.y;

            if (obstacleMode === 'drag') {
                if (onUpdateObstacle) {
                    onUpdateObstacle(activeObstacleId, {
                        x: start.obsX + dx,
                        y: start.obsY + dy
                    });
                }
            } else if (obstacleMode.startsWith('resize_')) {
                const corner = obstacleMode.replace('resize_', '');
                let newW = start.obsW;
                let newH = start.obsH;
                let newX = start.obsX;
                let newY = start.obsY;

                // Simple resize logic from center
                if (corner.includes('e')) { newW = Math.max(10, start.obsW + dx); newX = start.obsX + dx / 2; }
                if (corner.includes('w')) { newW = Math.max(10, start.obsW - dx); newX = start.obsX + dx / 2; }
                if (corner.includes('s')) { newH = Math.max(10, start.obsH + dy); newY = start.obsY + dy / 2; }
                if (corner.includes('n')) { newH = Math.max(10, start.obsH - dy); newY = start.obsY + dy / 2; }

                if (onUpdateObstacle) {
                    onUpdateObstacle(activeObstacleId, { x: newX, y: newY, w: newW, h: newH });
                }
            }
            return;
        }

        // Handle mission drag/resize
        if (missionMode !== 'none' && activeMissionId) {
            const mission = missions.find(m => m.id === activeMissionId);
            if (!mission) return;

            const start = missionStartRef.current;
            const dx = rawPoint.x - start.x;
            const dy = rawPoint.y - start.y;

            if (missionMode === 'drag') {
                if (onUpdateMission) {
                    onUpdateMission(activeMissionId, {
                        x: start.mX + dx,
                        y: start.mY + dy
                    });
                }
            } else if (missionMode.startsWith('resize_')) {
                // Calculate distance from center to mouse for size
                const distFromCenter = Math.sqrt(
                    Math.pow(rawPoint.x - mission.x, 2) + 
                    Math.pow(rawPoint.y - mission.y, 2)
                );
                const newSize = Math.max(20, distFromCenter * 2); // Min size 20px

                if (onUpdateMission) {
                    onUpdateMission(activeMissionId, { size: newSize });
                }
            }
            return;
        }

        if (rulerActive && isDraggingRuler) {
            setRulerPoints(prev => ({ ...prev, end: rawPoint }));
            return;
        }

        const p = snapGrid ? canvasPos(e, true) : rawPoint;

        if (draggingStart) {
            const newInitialPose = { ...initialPose, x: p.x, y: p.y };
            setInitialPose(newInitialPose);

            setSections(prev => {
                if (prev.length === 0 || prev[0].points.length === 0) return prev;

                const modified = prev.map((s, idx) => {
                    if (idx !== 0) return s;
                    return { ...s };
                });

                return recalcSectionsAndConvertToMm(modified, newInitialPose);
            });
            return;
        }

        if (dragging.active) {
            const pointMm = pxToMmPointForCanvas(p.x, p.y);
            setSections(prev => {
                const modified = prev.map(s => {
                    if (s.id !== dragging.sectionId) return s;
                    const newPoints = s.points.map((pt, i) =>
                        i === dragging.index ? { ...pt, x: pointMm.x, y: pointMm.y } : pt
                    );
                    return { ...s, points: newPoints };
                });
                return recalcSectionsAndConvertToMm(modified);
            });
            return;
        }

        if (!drawMode && currentSection) {
            const idx = hitTestNode(currentSection.points, p, 8);
            setHoverNode(idx > -1 ? { sectionId: currentSection.id, index: idx } : { sectionId: null, index: -1 });
            return;
        }

        if (drawMode && currentSection) {
            const segmentReference = referenceMode;
            const basePose = currentSection.points.length
                ? getLastPoseOfSection(currentSection, sections, initialPose, unitToPx)
                : computePoseUpToSection(sections, initialPose, currentSection.id, unitToPx);
            const activeSession = drawSessionRef.current.active;
            let anchorPose = basePose;
            if (activeSession && drawSessionRef.current.lastPoint) {
                const last = drawSessionRef.current.lastPoint;
                anchorPose = {
                    x: last.x,
                    y: last.y,
                    theta: typeof last.heading === 'number' ? last.heading : basePose.theta,
                };
            }

            const projection = projectPointWithReference({ rawPoint: p, anchorPose, reference: segmentReference, reverse: reverseDrawing, halfRobotLengthPx: unitToPx(robot.wheelOffset ?? robot.length / 2), snap45, baseAngles: SNAP_45_BASE_ANGLES });
            const previewPose = { x: projection.center.x, y: projection.center.y, theta: projection.theta };

            // Determine if this moving ghost is invalid (Collision)
            let isInvalid = false;
            let collisionType = null; // 'path' or 'rotation'
            if (preventCollisions) {
                try {
                    const paddingPx = unitToPx(collisionPadding);
                    const widthPx = unitToPx(robot.width);
                    const lengthPx = unitToPx(robot.length);
                    const robotPx = { width: widthPx, length: lengthPx };

                    // 1. Check Path Collision (Triple Line)
                    if (checkPathCollision(anchorPose, projection.center, widthPx, obstacles, paddingPx)) {
                        isInvalid = true;
                        collisionType = 'path';
                    }

                    // 2. Check Rotation Collision (Circle at Target)
                    // Only check if path is clear (or can check both)
                    if (!isInvalid) {
                        if (checkRotationCollision(projection.center, obstacles, robotPx, paddingPx)) {
                            isInvalid = true;
                            collisionType = 'rotation';
                        }
                    }
                } catch (err) {
                    console.error("Error in onCanvasMove collision check:", err);
                }
            }

            setGhost({
                x: previewPose.x,
                y: previewPose.y,
                theta: previewPose.theta,
                reference: segmentReference,
                displayX: previewPose.x,
                displayY: previewPose.y,
                originX: anchorPose.x,
                originY: anchorPose.y,
                active: true,
                active: true,
                isInvalid: isInvalid, // Visual feedback prop
                collisionType: collisionType,
            });

            if (activeSession) {
                const dist = segmentReference === 'tip' ? projection.referenceDistance : projection.distanceCenter;
                if (dist >= DRAW_STEP_MIN_PX) {
                    const now = Date.now();
                    const last = drawThrottleRef.current.lastAutoAddTs;

                    // Block auto-add if collision detected
                    if (preventCollisions && isInvalid) {
                        return;
                    }

                    if (now - last < DRAW_AUTO_INTERVAL_MS) {
                        return;
                    }
                    const centerPoint = projection.center;

                    // COLLISION CHECK
                    if (preventCollisions) {
                        const paddingPx = unitToPx(collisionPadding);
                        const widthPx = unitToPx(robot.width);
                        const lengthPx = unitToPx(robot.length);
                        const robotPx = { width: widthPx, length: lengthPx };

                        if (checkPathCollision(anchorPose, centerPoint, widthPx, obstacles, paddingPx) ||
                            checkRotationCollision(centerPoint, obstacles, robotPx, paddingPx)) {
                            return;
                        }
                    }

                    const centerMm = pxToMmPointForCanvas(centerPoint.x, centerPoint.y);
                    setSections(prev => {
                        const modified = prev.map(s => {
                            if (s.id !== currentSection.id) return s;
                            const newPts = [...s.points, { x: centerMm.x, y: centerMm.y, reverse: reverseDrawing, reference: segmentReference, heading: projection.theta }];
                            return { ...s, points: newPts };
                        });
                        return recalcSectionsAndConvertToMm(modified);
                    });
                    drawSessionRef.current = {
                        active: true,
                        lastPoint: { x: centerPoint.x, y: centerPoint.y, heading: projection.theta },
                        addedDuringDrag: true,
                    };
                    drawThrottleRef.current.lastAutoAddTs = now;
                }
            }
        }
    };

    const onCanvasUp = () => {
        if (isPanningRef.current) {
            isPanningRef.current = false;
        }
        rightPressActiveRef.current = false;
        if (rightEraseTimerRef.current) {
            clearInterval(rightEraseTimerRef.current);
            rightEraseTimerRef.current = null;
        }
        if (rulerActive) {
            setIsDraggingRuler(false);
            return;
        }

        if (obstacleMode !== 'none') {
            setObstacleMode('none');
            setActiveObstacleId(null);
        }

        if (missionMode !== 'none') {
            setMissionMode('none');
            setActiveMissionId(null);
        }

        setDraggingStart(false);
        // Do NOT clear dragging here to allow selection for deletion
        // Only stop the "active" dragging (movement)
        setDragging(prev => ({ ...prev, active: false }));

        if (drawSessionRef.current.active) {
            drawSessionRef.current = { active: false, lastPoint: null, addedDuringDrag: drawSessionRef.current.addedDuringDrag };
        }
        drawThrottleRef.current.lastAutoAddTs = 0;
        setGhost(prev => (prev.active ? { ...prev, active: false } : prev));
    };

    const onCanvasLeave = () => {
        setCursorGuide(prev => ({ ...prev, visible: false }));
        onCanvasUp();
    };

    const onCanvasClick = (e) => {
        if (isSettingOrigin) {
            const p = canvasPos(e, false);
            setGrid(g => ({ ...g, offsetX: p.x, offsetY: p.y }));
            setIsSettingOrigin(false);
            return;
        }
        if (rulerActive) return;
        if (!drawMode || !currentSection) return;
        if (drawSessionRef.current.addedDuringDrag) {
            drawSessionRef.current = { active: false, lastPoint: null, addedDuringDrag: false };
            return;
        }
        const rawPoint = canvasPos(e, false);
        const p = snapGrid ? canvasPos(e, true) : rawPoint;
        const basePose = currentSection.points.length
            ? getLastPoseOfSection(currentSection, sections, initialPose, unitToPx)
            : computePoseUpToSection(sections, initialPose, currentSection.id, unitToPx);
        const segmentReference = referenceMode;
        const projection = projectPointWithReference({ rawPoint: p, anchorPose: basePose, reference: segmentReference, reverse: reverseDrawing, halfRobotLengthPx: unitToPx(robot.wheelOffset ?? robot.length / 2), snap45, baseAngles: SNAP_45_BASE_ANGLES });
        const centerPoint = projection.center;

        // COLLISION CHECK
        if (preventCollisions) {
            const paddingPx = unitToPx(collisionPadding);
            const widthPx = unitToPx(robot.width);
            const lengthPx = unitToPx(robot.length);
            const robotPx = { width: widthPx, length: lengthPx };

            if (checkPathCollision(basePose, centerPoint, widthPx, obstacles, paddingPx) ||
                checkRotationCollision(centerPoint, obstacles, robotPx, paddingPx)) {
                return;
            }
        }

        const centerMm = pxToMmPointForCanvas(centerPoint.x, centerPoint.y);
        setSections(prev => {
            const modified = prev.map(s => {
                if (s.id !== currentSection.id) return s;
                const newPts = [...s.points, { x: centerMm.x, y: centerMm.y, reverse: reverseDrawing, reference: segmentReference, heading: projection.theta }];
                return { ...s, points: newPts };
            });
            return recalcSectionsAndConvertToMm(modified);
        });
        drawSessionRef.current = { active: false, lastPoint: null, addedDuringDrag: false };
        drawThrottleRef.current.lastAutoAddTs = Date.now();
    };

    return (
        <div
            ref={containerRef}
            className={`canvas-container ${drawMode ? 'cursor-crosshair' : 'cursor-default'}`}
            onContextMenu={handleContextMenu}
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <canvas
                ref={canvasRef}
                width={canvasBaseSize.width}
                height={canvasBaseSize.height}
                style={{ width: '100%', height: '100%', touchAction: 'none' }}
                onPointerDown={onCanvasDown}
                onPointerMove={onCanvasMove}
                onPointerUp={onCanvasUp}
                onPointerLeave={onCanvasLeave}
                onClick={onCanvasClick}
            />
            {/* Cursor Guide */}
            {cursorGuide && cursorGuide.visible && (
                <div
                    className="pointer-events-none fixed z-50 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow transform -translate-x-1/2 -translate-y-full mt-[-8px]"
                    style={{ left: cursorGuide.screenX, top: cursorGuide.screenY }}
                >
                    {cursorGuide.label}
                </div>
            )}
        </div>
    );
};

export default CanvasBoard;
