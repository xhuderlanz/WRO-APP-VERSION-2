import { SNAP_45_BASE_ANGLES, DEG2RAD, RAD2DEG } from "./constants";

export const normalizeAngle = (angle) => {
    let a = angle;
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
};

export const getReferencePoint = (pose, reference, halfRobotLengthPx) => {
    if (!pose) return { x: 0, y: 0 };
    if (reference === 'tip') {
        return {
            x: pose.x + Math.cos(pose.theta) * halfRobotLengthPx,
            y: pose.y + Math.sin(pose.theta) * halfRobotLengthPx,
        };
    }
    return { x: pose.x, y: pose.y };
};

export const computePoseUpToSection = (sections, initialPose, sectionId, unitToPx) => {
    let pose = { ...initialPose };
    for (const s of sections) {
        if (sectionId && s.id === sectionId) break;
        for (const act of s.actions) {
            if (act.type === 'rotate') { pose.theta = normalizeAngle(pose.theta + act.angle * DEG2RAD); }
            else { pose.x += Math.cos(pose.theta) * unitToPx(act.distance); pose.y += Math.sin(pose.theta) * unitToPx(act.distance); }
        }
    }
    return pose;
};

export const getPoseAfterActions = (startPose, actions, unitToPx) => {
    let pose = { ...startPose };
    for (const act of actions) {
        if (act.type === 'rotate') {
            pose.theta = normalizeAngle(pose.theta + act.angle * DEG2RAD);
        } else {
            const delta = unitToPx(act.distance);
            pose = {
                x: pose.x + Math.cos(pose.theta) * delta,
                y: pose.y + Math.sin(pose.theta) * delta,
                theta: pose.theta,
            };
        }
    }
    return pose;
};

export const getLastPoseOfSection = (section, sections, initialPose, unitToPx) => {
    if (!section) return { ...initialPose };
    // We need to compute pose up to this section first
    // But wait, computePoseUpToSection calculates UP TO the start of the section.
    // So we can use that.
    let pose = computePoseUpToSection(sections, initialPose, section.id, unitToPx);

    for (const pt of section.points || []) {
        const dx = pt.x - pose.x;
        const dy = pt.y - pose.y;
        const dist = Math.hypot(dx, dy);
        let nextTheta = typeof pt.heading === 'number' ? pt.heading : pose.theta;
        if (dist >= 1e-3) {
            const headingToPoint = Math.atan2(dy, dx);
            nextTheta = typeof pt.heading === 'number'
                ? pt.heading
                : normalizeAngle((pt.reverse ? headingToPoint + Math.PI : headingToPoint));
        }
        pose = { x: pt.x, y: pt.y, theta: nextTheta };
    }
    return pose;
};

export const buildReversePlayback = (actions) => {
    const reversed = [];
    for (let i = actions.length - 1; i >= 0; i -= 1) {
        const act = actions[i];
        if (act.type === 'rotate') {
            const angle = Number((-act.angle).toFixed(2));
            if (Math.abs(angle) > 1e-3) {
                reversed.push({ type: 'rotate', angle });
            }
        } else {
            const distance = Number((-act.distance).toFixed(2));
            if (Math.abs(distance) > 1e-3) {
                reversed.push({ type: 'move', distance, reference: act.reference || 'center' });
            }
        }
    }
    return reversed;
};

export const buildActionsFromPolyline = (points, startPose, pxToUnit) => {
    const acts = [];
    let prev = { ...startPose };
    for (const pt of points) {
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const distPx = Math.hypot(dx, dy);
        if (distPx < 1e-3) {
            prev = { ...prev, x: pt.x, y: pt.y };
            continue;
        }
        const segmentReverse = Boolean(pt.reverse);
        const segmentReference = pt.reference || 'center';
        const headingToPoint = Math.atan2(dy, dx);
        const storedHeading = typeof pt.heading === 'number'
            ? normalizeAngle(pt.heading)
            : normalizeAngle(headingToPoint + (segmentReverse ? Math.PI : 0));
        const targetHeading = storedHeading;
        const ang = normalizeAngle(targetHeading - prev.theta);
        const deg = ang * RAD2DEG;
        if (Math.abs(deg) > 1e-3) {
            acts.push({ type: 'rotate', angle: Number(deg.toFixed(2)) });
        }
        const cm = pxToUnit(distPx);
        if (cm > 1e-3) {
            const signed = segmentReverse ? -cm : cm;
            acts.push({ type: 'move', distance: Number(signed.toFixed(2)), reference: segmentReference });
        }
        prev = { x: pt.x, y: pt.y, theta: targetHeading };
    }
    return acts;
};

export const pointsFromActions = (actions, startPose, unitToPx) => {
    const pts = [];
    let pose = { ...startPose };
    for (const a of actions) {
        if (a.type === 'rotate') {
            pose.theta = normalizeAngle(pose.theta + a.angle * DEG2RAD);
        } else {
            const direction = Math.sign(a.distance) || 1;
            const travelPx = unitToPx(Math.abs(a.distance));
            const dx = Math.cos(pose.theta) * travelPx * direction;
            const dy = Math.sin(pose.theta) * travelPx * direction;
            pose = {
                x: pose.x + dx,
                y: pose.y + dy,
                theta: pose.theta,
            };
            pts.push({
                x: pose.x,
                y: pose.y,
                reverse: a.distance < 0,
                reference: a.reference || 'center',
                heading: pose.theta,
            });
        }
    }
    return pts;
};

export const projectPointWithReference = ({
    rawPoint,
    anchorPose,
    reference,
    reverse = false,
    halfRobotLengthPx,
    snap45,
    baseAngles = SNAP_45_BASE_ANGLES
}) => {
    // CRITICAL: The trajectory ALWAYS starts from the robot's CENTER (anchorPose.x, anchorPose.y)
    // The reference mode only affects the visual display, not the trajectory calculation
    const anchorCenter = { x: anchorPose.x, y: anchorPose.y };

    // Calculate the direction and distance from robot center to cursor
    const dx = rawPoint.x - anchorCenter.x;
    const dy = rawPoint.y - anchorCenter.y;
    let distanceRef = Math.hypot(dx, dy);

    if (distanceRef < 1e-6) {
        const thetaIdle = reverse ? normalizeAngle(anchorPose.theta + Math.PI) : anchorPose.theta;
        return {
            center: { x: anchorPose.x, y: anchorPose.y },
            theta: thetaIdle,
            distanceCenter: 0,
            referenceDistance: 0,
        };
    }

    let travelTheta = Math.atan2(dy, dx);
    if (snap45) {
        let bestMatch = null;
        for (const baseAngle of baseAngles) {
            const ux = Math.cos(baseAngle);
            const uy = Math.sin(baseAngle);
            const projection = dx * ux + dy * uy;
            const projX = anchorCenter.x + ux * projection;
            const projY = anchorCenter.y + uy * projection;
            const error = Math.hypot(projX - rawPoint.x, projY - rawPoint.y);
            const thetaCandidate = projection >= 0 ? baseAngle : normalizeAngle(baseAngle + Math.PI);
            const distanceCandidate = Math.abs(projection);
            if (!bestMatch || error < bestMatch.error) {
                bestMatch = { theta: thetaCandidate, distance: distanceCandidate, error };
            }
        }
        if (bestMatch) {
            travelTheta = bestMatch.theta;
            distanceRef = bestMatch.distance;
        }
    }

    const facingTheta = reverse ? normalizeAngle(travelTheta + Math.PI) : normalizeAngle(travelTheta);

    // Calculate the new center position
    let centerX, centerY;

    if (reference === 'tip') {
        // If reference is tip, the projected point (based on rawPoint) is where the TIP should be.
        // So the center is shifted backwards by halfRobotLength.
        // We use the projected point (anchor + vector) instead of rawPoint directly to respect snapping if active
        const projectedTipX = anchorPose.x + Math.cos(travelTheta) * distanceRef;
        const projectedTipY = anchorPose.y + Math.sin(travelTheta) * distanceRef;

        centerX = projectedTipX - Math.cos(facingTheta) * halfRobotLengthPx;
        centerY = projectedTipY - Math.sin(facingTheta) * halfRobotLengthPx;
    } else {
        // If reference is center, the projected point IS the center.
        centerX = anchorPose.x + Math.cos(travelTheta) * distanceRef;
        centerY = anchorPose.y + Math.sin(travelTheta) * distanceRef;
    }

    const distanceCenter = Math.hypot(centerX - anchorPose.x, centerY - anchorPose.y);

    return {
        center: { x: centerX, y: centerY },
        theta: facingTheta,
        distanceCenter,
        referenceDistance: distanceRef,
    };
};
