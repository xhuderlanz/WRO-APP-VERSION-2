import { DEG2RAD, RAD2DEG } from "./constants";
import { pointsFromActions, computePoseUpToSection, buildActionsFromPolyline, getPoseAfterActions } from "./geometry";

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
            // Instead of regenerating points from actions (which rotates the section if start angle changes),
            // we want to preserve the absolute orientation of the section (points) and just translate it.

            // 1. Get the OLD start pose of this section (from the original sections array)
            const oldStartPose = computePoseUpToSection(sections, initialPose, sections[i].id, unitToPx);

            // 2. Calculate the translation delta
            const dx = startPose.x - oldStartPose.x;
            const dy = startPose.y - oldStartPose.y;

            // 3. Translate all points
            const newPoints = sectionsCopy[i].points.map(p => ({
                ...p,
                x: p.x + dx,
                y: p.y + dy
            }));

            sectionsCopy[i] = { ...sectionsCopy[i], points: newPoints };

            // 4. Recalculate actions based on the new start pose and translated points
            // This will automatically adjust the first action (turn/move) to connect correctly
            const newActions = buildActionsFromPolyline(newPoints, startPose, pxToUnit);
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
