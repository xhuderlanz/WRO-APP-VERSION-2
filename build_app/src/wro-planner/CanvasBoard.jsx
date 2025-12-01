import React, { useRef, useEffect, useCallback, useState } from "react";
import { DEG2RAD, RAD2DEG, SNAP_45_BASE_ANGLES } from "./domain/constants";
import { normalizeAngle, getReferencePoint, getLastPoseOfSection, projectPointWithReference, pointsFromActions, buildActionsFromPolyline, computePoseUpToSection } from "./domain/geometry";
import { recalcSectionFromPoints, recalcAllFollowingSections } from "./domain/sections";

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
    selectedSectionId,
    initialPose,
    playPose,
    isRunning,
    drawMode,
    rulerActive,
    rulerPoints,
    setRulerPoints,
    snapGrid,
    snap45,
    referenceMode,
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
    setInitialPose
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDraggingRuler, setIsDraggingRuler] = useState(false);

    const DRAW_STEP_MIN_PX = 6;
    const DRAW_AUTO_INTERVAL_MS = 340;

    const currentSection = sections.find(s => s.id === selectedSectionId);

    // Keyboard handler for Space key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                setReverseDrawing(prev => !prev);
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [setReverseDrawing]);

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

    const drawRobot = useCallback((ctx, pose, isGhost = false) => {
        ctx.save();
        ctx.translate(pose.x, pose.y);
        ctx.rotate(pose.theta);
        const wPx = unitToPx(robot.width);
        const lPx = unitToPx(robot.length);

        if (robotImgObj) {
            ctx.globalAlpha = isGhost ? 0.4 : (robot.opacity ?? 1);
            ctx.drawImage(robotImgObj, -lPx / 2, -wPx / 2, lPx, wPx);
        } else {
            ctx.fillStyle = isGhost ? `${robot.color}66` : robot.color;
            ctx.fillRect(-lPx / 2, -wPx / 2, lPx, wPx);
            ctx.strokeStyle = isGhost ? '#666' : '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(-lPx / 2, -wPx / 2, lPx, wPx);

            // Wheels
            ctx.fillStyle = '#111';
            ctx.fillRect(-lPx / 4, -wPx / 2 - 4, lPx / 2, 4);
            ctx.fillRect(-lPx / 4, wPx / 2, lPx / 2, 4);

            // Direction arrow
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(lPx / 2, 0);
            ctx.strokeStyle = isGhost ? '#fff' : '#000';
            ctx.stroke();
        }
        ctx.restore();
    }, [robot, robotImgObj, unitToPx]);

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
        if (sizePx > 5) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,0,0,${grid.lineAlpha})`;
            ctx.lineWidth = 1;
            const offX = grid.offsetX % sizePx;
            const offY = grid.offsetY % sizePx;
            for (let x = offX; x <= w; x += sizePx) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
            for (let y = offY; y <= h; y += sizePx) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
            ctx.stroke();
        }

        // Sections
        sections.forEach(s => {
            if (!s.isVisible || s.points.length === 0) return;
            // Calculate start pose for the section
            const sectionStartPose = computePoseUpToSection(sections, initialPose, s.id, unitToPx);

            ctx.beginPath();
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(sectionStartPose.x, sectionStartPose.y);
            for (let i = 0; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
            ctx.stroke();

            // Draw direction arrows on segments
            let arrowPose = sectionStartPose;
            s.points.forEach((pt) => {
                const reference = pt.reference || 'center';
                const startDisplay = getReferencePoint(arrowPose, reference, unitToPx(robot.length) / 2);
                const dx = pt.x - arrowPose.x;
                const dy = pt.y - arrowPose.y;
                const dist = Math.hypot(dx, dy);
                let segmentTheta = typeof pt.heading === 'number' ? pt.heading : arrowPose.theta;
                if (dist >= 1e-3) {
                    const headingToPoint = Math.atan2(dy, dx);
                    segmentTheta = typeof pt.heading === 'number'
                        ? pt.heading
                        : normalizeAngle(pt.reverse ? headingToPoint + Math.PI : headingToPoint);
                }
                const endPose = { x: pt.x, y: pt.y, theta: segmentTheta };
                const endDisplay = getReferencePoint(endPose, reference, unitToPx(robot.length) / 2);

                // Draw arrow in the middle of the segment
                const midX = (startDisplay.x + endDisplay.x) / 2;
                const midY = (startDisplay.y + endDisplay.y) / 2;
                const segmentAngle = Math.atan2(endDisplay.y - startDisplay.y, endDisplay.x - startDisplay.x);

                ctx.save();
                ctx.translate(midX, midY);
                ctx.rotate(segmentAngle);
                ctx.fillStyle = s.color || '#000';
                ctx.beginPath();
                ctx.moveTo(8, 0);
                ctx.lineTo(0, -4);
                ctx.lineTo(0, 4);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                arrowPose = endPose;
            });

            // Nodes
            if ((selectedSectionId === s.id && drawMode) || !drawMode) {
                s.points.forEach((p, i) => {
                    ctx.beginPath();
                    const isActive = (dragging.active && dragging.sectionId === s.id && dragging.index === i) || (hoverNode.sectionId === s.id && hoverNode.index === i);
                    const isLastActive = drawMode && selectedSectionId === s.id && i === s.points.length - 1;

                    const radius = (isActive || isLastActive) ? 6 : 4;
                    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = (isActive || isLastActive) ? '#fff' : s.color;
                    ctx.fill();
                    ctx.strokeStyle = (isActive || isLastActive) ? s.color : '#000';
                    ctx.lineWidth = (isActive || isLastActive) ? 2 : 1;
                    ctx.stroke();

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

                    // Draw white background for number
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.fillRect(textX - textWidth / 2 - bgPadding, textY - 6, textWidth + bgPadding * 2, 12);

                    // Draw number
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

                // Apply actions up to and including the hovered point
                for (let i = 0; i <= hoverNode.index && i < hoveredSection.actions.length; i++) {
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
        }

        // Robot
        if (isRunning) {
            drawRobot(ctx, playPose);
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
            drawRobot(ctx, initialPose);
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
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
            ctx.lineWidth = 1;
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

    }, [bgImage, bgOpacity, grid, unitToPx, sections, selectedSectionId, drawMode, hoverNode, ghost, isRunning, playPose, robot, robotImgObj, actionCursorRef, initialPose, drawRobot, rulerActive, rulerPoints, pxToUnit, unit, cursorGuide]);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const { width, height } = canvasBaseSize;
        if (!width || !height) return;
        cvs.style.width = `${width * zoom}px`;
        cvs.style.height = `${height * zoom}px`;
    }, [canvasBaseSize, zoom]);

    useEffect(() => {
        draw();
    }, [draw]);

    const onCanvasDown = (e) => {
        if (isSettingOrigin) return;
        if (e.button === 2) {
            e.preventDefault();
            if (!drawMode || !currentSection) return;
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
        if (drawMode) return;
        const p = canvasPos(e);
        if (Math.hypot(initialPose.x - p.x, initialPose.y - p.y) <= 10) { setDraggingStart(true); return; }
        if (currentSection) { const idx = hitTestNode(currentSection.points, p, 8); if (idx > -1) setDragging({ active: true, sectionId: currentSection.id, index: idx }); }
    };

    const onCanvasMove = (e) => {
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

        if (rulerActive && isDraggingRuler) {
            setRulerPoints(prev => ({ ...prev, end: rawPoint }));
            return;
        }

        const p = snapGrid ? canvasPos(e, true) : rawPoint;

        if (draggingStart) {
            const newInitialPose = { ...initialPose, x: p.x, y: p.y };
            setInitialPose(newInitialPose);

            // Only recalculate actions for the first section if it has points
            setSections(prev => {
                if (prev.length === 0 || prev[0].points.length === 0) return prev;

                const firstSection = prev[0];
                // Strip headings to force recalculation based on new geometry
                const pointsWithoutHeadings = firstSection.points.map(({ heading, ...rest }) => rest);

                const newActions = buildActionsFromPolyline(
                    pointsWithoutHeadings,
                    newInitialPose,
                    pxToUnit
                );

                // Regenerate points from actions to ensure consistency (and correct headings)
                const newPoints = pointsFromActions(newActions, newInitialPose, unitToPx);

                const newSections = prev.map((s, idx) =>
                    idx === 0 ? { ...s, points: newPoints, actions: newActions } : s
                );

                return recalcAllFollowingSections({ sections: newSections, changedSectionId: prev[0].id, initialPose: newInitialPose, unitToPx });
            });
            return;
        }

        if (dragging.active) {
            setSections(prev => {
                const updatedSections = prev.map(s => {
                    if (s.id !== dragging.sectionId) return s;

                    // Update the dragged point's position - other points stay fixed
                    const tempPoints = s.points.map((pt, i) =>
                        i === dragging.index ? { ...pt, x: p.x, y: p.y } : pt
                    );

                    // Recalculate actions based on new point positions
                    // Strip headings to force recalculation based on new geometry
                    const pointsWithoutHeadings = tempPoints.map(({ heading, ...rest }) => rest);
                    const startPose = computePoseUpToSection(prev, initialPose, s.id, unitToPx);
                    const newActions = buildActionsFromPolyline(pointsWithoutHeadings, startPose, pxToUnit);

                    // Regenerate points from actions to ensure consistency
                    const finalPoints = pointsFromActions(newActions, startPose, unitToPx);

                    return { ...s, points: finalPoints, actions: newActions };
                });
                return recalcAllFollowingSections({ sections: updatedSections, changedSectionId: dragging.sectionId, initialPose, unitToPx });
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

            const projection = projectPointWithReference({ rawPoint: p, anchorPose, reference: segmentReference, reverse: reverseDrawing, halfRobotLengthPx: unitToPx(robot.length) / 2, snap45, baseAngles: SNAP_45_BASE_ANGLES });
            const previewPose = { x: projection.center.x, y: projection.center.y, theta: projection.theta };
            const anchorDisplay = getReferencePoint(anchorPose, segmentReference, unitToPx(robot.length) / 2);
            const previewDisplay = getReferencePoint(previewPose, segmentReference, unitToPx(robot.length) / 2);
            setGhost({
                x: previewPose.x,
                y: previewPose.y,
                theta: previewPose.theta,
                reference: segmentReference,
                displayX: previewDisplay.x,
                displayY: previewDisplay.y,
                originX: anchorDisplay.x,
                originY: anchorDisplay.y,
                active: true,
            });

            if (activeSession) {
                const dist = segmentReference === 'tip' ? projection.referenceDistance : projection.distanceCenter;
                if (dist >= DRAW_STEP_MIN_PX) {
                    const now = Date.now();
                    const last = drawThrottleRef.current.lastAutoAddTs;
                    if (now - last < DRAW_AUTO_INTERVAL_MS) {
                        return;
                    }
                    const centerPoint = projection.center;
                    setSections(prev => {
                        const updated = prev.map(s => {
                            if (s.id !== currentSection.id) return s;
                            const newPts = [...s.points, { ...centerPoint, reverse: reverseDrawing, reference: segmentReference, heading: projection.theta }];
                            return recalcSectionFromPoints({ section: { ...s, points: newPts }, sections: prev, initialPose, pxToUnit, unitToPx });
                        });
                        return recalcAllFollowingSections({ sections: updated, changedSectionId: currentSection.id, initialPose, unitToPx });
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
        rightPressActiveRef.current = false;
        if (rightEraseTimerRef.current) {
            clearInterval(rightEraseTimerRef.current);
            rightEraseTimerRef.current = null;
        }
        if (rulerActive) {
            setIsDraggingRuler(false);
            return;
        }
        setDraggingStart(false);
        setDragging({ active: false, sectionId: null, index: -1 });
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
        const projection = projectPointWithReference({ rawPoint: p, anchorPose: basePose, reference: segmentReference, reverse: reverseDrawing, halfRobotLengthPx: unitToPx(robot.length) / 2, snap45, baseAngles: SNAP_45_BASE_ANGLES });
        const centerPoint = projection.center;
        setSections(prev => {
            const updated = prev.map(s => {
                if (s.id !== currentSection.id) return s;
                const newPts = [...s.points, { ...centerPoint, reverse: reverseDrawing, reference: segmentReference, heading: projection.theta }];
                return recalcSectionFromPoints({ section: { ...s, points: newPts }, sections: prev, initialPose, pxToUnit, unitToPx });
            });
            return recalcAllFollowingSections({ sections: updated, changedSectionId: currentSection.id, initialPose, unitToPx });
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
