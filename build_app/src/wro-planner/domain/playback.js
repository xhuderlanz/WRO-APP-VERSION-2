import { useState, useRef, useCallback, useEffect } from "react";
import { DEG2RAD } from "./constants";
import { getPoseAfterActions, buildReversePlayback, computePoseUpToSection } from "./geometry";

export function usePlayback({ initialPose, sections, unitToPx, currentSection, playbackSpeed = 1 }) {
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [playPose, setPlayPose] = useState({ ...initialPose });

    const animRef = useRef(0);
    const actionCursorRef = useRef({ list: [], idx: 0, phase: 'idle', remainingPx: 0, remainingAngle: 0, moveDirection: 1 });

    // Ref to track isPaused inside the animation loop without stale closures
    const isPausedRef = useRef(isPaused);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

    const stopPlayback = useCallback(() => {
        cancelAnimationFrame(animRef.current);
        setIsRunning(false);
        setIsPaused(false);
        actionCursorRef.current = { list: [], idx: 0, phase: 'idle', remainingPx: 0, remainingAngle: 0, moveDirection: 1 };
        setPlayPose({ ...initialPose });
    }, [initialPose]);

    const tick = useCallback(() => {
        if (isPausedRef.current) {
            animRef.current = requestAnimationFrame(tick);
            return;
        }
        const ac = actionCursorRef.current;
        if (ac.idx >= ac.list.length) {
            stopPlayback();
            return;
        }
        const a = ac.list[ac.idx];
        const rotStep = 5 * DEG2RAD * playbackSpeed;
        const speedPx = (unitToPx(40) / 60) * playbackSpeed;

        setPlayPose(prev => {
            let pose = { ...prev };
            if (a.type === 'rotate') {
                if (ac.phase !== 'rotate') {
                    ac.phase = 'rotate';
                    ac.remainingAngle = a.angle * DEG2RAD;
                }
                const remaining = ac.remainingAngle;
                if (Math.abs(remaining) < 1e-3) {
                    ac.phase = 'idle';
                    ac.idx++;
                    return pose;
                }
                const step = Math.sign(remaining) * Math.min(Math.abs(remaining), rotStep);
                pose.theta += step;
                ac.remainingAngle -= step;
                if (Math.abs(ac.remainingAngle) < 1e-3) {
                    ac.phase = 'idle';
                    ac.idx++;
                }
            } else {
                if (ac.phase !== 'move') {
                    ac.phase = 'move';
                    ac.remainingPx = unitToPx(Math.abs(a.distance));
                    ac.moveDirection = Math.sign(a.distance) || 1;
                }
                const remainingPx = ac.remainingPx ?? 0;
                if (remainingPx < 1e-3) {
                    ac.phase = 'idle';
                    ac.idx++;
                    return pose;
                }
                const step = Math.min(speedPx, remainingPx);
                const direction = ac.moveDirection ?? 1;
                pose.x += Math.cos(pose.theta) * step * direction;
                pose.y += Math.sin(pose.theta) * step * direction;
                ac.remainingPx = remainingPx - step;
                if ((ac.remainingPx ?? 0) < 1e-3) {
                    ac.phase = 'idle';
                    ac.idx++;
                }
            }
            return pose;
        });
        animRef.current = requestAnimationFrame(tick);
    }, [stopPlayback, unitToPx, playbackSpeed]);

    const startPlayback = useCallback((list, startPose) => {
        cancelAnimationFrame(animRef.current);
        setPlayPose({ ...startPose });
        actionCursorRef.current = { list, idx: 0, phase: 'idle', remainingPx: 0, remainingAngle: 0, moveDirection: 1 };
        setIsRunning(true);
        setIsPaused(false);
        animRef.current = requestAnimationFrame(tick);
    }, [tick]);

    const startMission = useCallback(() => {
        const fullActions = [];
        let currentPose = { ...initialPose };
        sections.forEach(s => {
            if (!s.isVisible) return;
            const sectionStartPose = currentPose;
            s.actions.forEach(a => {
                fullActions.push({ ...a, startPose: sectionStartPose });
            });
            currentPose = getPoseAfterActions(currentPose, s.actions, unitToPx);
        });
        startPlayback(fullActions, initialPose);
    }, [sections, initialPose, unitToPx, startPlayback]);

    const startMissionReverse = useCallback(() => {
        const fullActions = [];
        let currentPose = { ...initialPose };
        sections.forEach(s => {
            if (!s.isVisible) return;
            const sectionStartPose = currentPose;
            s.actions.forEach(a => {
                fullActions.push({ ...a, startPose: sectionStartPose });
            });
            currentPose = getPoseAfterActions(currentPose, s.actions, unitToPx);
        });
        const reverseList = buildReversePlayback(fullActions);
        startPlayback(reverseList, currentPose);
    }, [sections, initialPose, unitToPx, startPlayback]);

    const startSection = useCallback(() => {
        if (!currentSection) return;
        const startPose = computePoseUpToSection(sections, initialPose, currentSection.id, unitToPx);
        startPlayback(currentSection.actions, startPose);
    }, [currentSection, sections, initialPose, unitToPx, startPlayback]);

    const startSectionReverse = useCallback(() => {
        if (!currentSection) return;
        const startPose = computePoseUpToSection(sections, initialPose, currentSection.id, unitToPx);
        const endPose = getPoseAfterActions(startPose, currentSection.actions, unitToPx);
        const reverseList = buildReversePlayback(currentSection.actions);
        startPlayback(reverseList, endPose);
    }, [currentSection, sections, initialPose, unitToPx, startPlayback]);

    const pauseResume = () => {
        setIsPaused(prev => !prev);
    };

    return {
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
    };
}
