import { DEG2RAD, RAD2DEG } from "./constants";
import { pointsFromActions, computePoseUpToSection, buildActionsFromPolyline, getPoseAfterActions, normalizeAngle } from "./geometry";

/**
 * LEGACY FILE - DO NOT USE FOR NEW FEATURES
 * 
 * This is the old sections recalc logic that modifies point coordinates.
 * Use sections_stable.js instead, which keeps points immutable.
 */

export const recalcAllFollowingSections = ({ sections, changedSectionId, initialPose, unitToPx, pxToUnit }) => {
    const changedIndex = sections.findIndex(s => s.id === changedSectionId);
    if (changedIndex === -1) return sections;

    const sectionsCopy = sections.map(section => ({ ...section }));

    const advancePose = (start, actions) => {
        let pose = { ...start };
        for (const act of actions) {
            if (act.type === 'rotate') {
                pose.theta += act.angle * DEG2RAD;
            } else {
                const dx = Math.cos(pose.theta) * unitToPx(act.distance);
                const dy = Math.sin(pose.theta) * unitToPx(act.distance);
                pose = { x: pose.x + dx, y: pose.y + dy, theta: pose.theta };
            }
        }
        return pose;
    };

    let runningPose = { ...initialPose };

    for (let i = 0; i < sectionsCopy.length; i++) {
        const startPose = { ...runningPose };

        // Store start angle
        sectionsCopy[i].startAngle = startPose.theta * RAD2DEG;

        if (i > changedIndex) {
            // For sections after the changed section, we need to translate the points
            // to preserve their absolute orientation while connecting to the new start position

            // Get the old start position of this section from ORIGINAL sections array
            // This ensures we always calculate the translation based on where the section
            // started BEFORE any updates, not where it is now
            const oldStartPose = computePoseUpToSection(sections, initialPose, sections[i].id, unitToPx);

            // Calculate translation delta
            const dx = startPose.x - oldStartPose.x;
            const dy = startPose.y - oldStartPose.y;

            // Translate all points to new position (preserving absolute orientation)
            const translatedPoints = sectionsCopy[i].points.map(p => ({
                ...p,
                x: p.x + dx,
                y: p.y + dy
            }));

            // Recalculate actions from the translated points
            // This will automatically insert the needed rotation at the beginning to connect
            const newActions = buildActionsFromPolyline(translatedPoints, startPose, pxToUnit);

            sectionsCopy[i].points = translatedPoints;
            sectionsCopy[i].actions = newActions;
        }

        // Advance running pose for the next section
        runningPose = advancePose(startPose, sectionsCopy[i].actions);

        // Store end angle
        sectionsCopy[i].endAngle = runningPose.theta * RAD2DEG;
    }

    return sectionsCopy;
};

export const recalcSectionFromPoints = ({ section, sections, initialPose, pxToUnit, unitToPx }) => {
    // We need to compute pose up to the START of this section.
    const start = computePoseUpToSection(sections, initialPose, section.id, unitToPx);
    const acts = buildActionsFromPolyline(section.points, start, pxToUnit);

    // Calculate end pose to store endAngle
    const endPose = getPoseAfterActions(start, acts, unitToPx);

    return {
        ...section,
        actions: acts,
        startAngle: start.theta * RAD2DEG,
        endAngle: endPose.theta * RAD2DEG
    };
};
