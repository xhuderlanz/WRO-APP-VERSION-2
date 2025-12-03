import { DEG2RAD, RAD2DEG } from "./constants";
import { pointsFromActions, computePoseUpToSection, buildActionsFromPolyline, getPoseAfterActions } from "./geometry";

/**
 * Recalculates a single section's actions and end pose based on its points.
 * This is used when the user edits the points of a section directly.
 * 
 * @param {Object} params
 * @param {Object} params.section - The section being edited
 * @param {Array} params.sections - All sections (to calculate start pose)
 * @param {Object} params.initialPose - Global initial pose
 * @param {Function} params.pxToUnit - Converter
 * @param {Function} params.unitToPx - Converter
 */
export const recalcSectionFromPointsV3 = ({ section, sections, initialPose, pxToUnit, unitToPx }) => {
    // 1. Calculate the start pose of this section based on previous sections
    const startPose = computePoseUpToSection(sections, initialPose, section.id, unitToPx);

    // 2. Re-build actions from the current points
    const actions = buildActionsFromPolyline(section.points, startPose, pxToUnit);

    // 3. Calculate the new end pose based on these actions
    const endPose = getPoseAfterActions(startPose, actions, unitToPx);

    // 4. Return updated section
    return {
        ...section,
        actions,
        startAngle: startPose.theta * RAD2DEG,
        endAngle: endPose.theta * RAD2DEG
    };
};

/**
 * Recalculates all sections following a change.
 * STRICT V3 LOGIC:
 * - The changed section is recalculated from its points (actions are regenerated).
 * - Subsequent sections have ONLY their first point moved to connect to the previous section.
 * - ALL OTHER POINTS in subsequent sections remain EXACTLY at their current coordinates.
 * - Actions for subsequent sections are recalculated from these pinned points.
 * 
 * @param {Object} params
 * @param {Array} params.sections - The full list of sections
 * @param {string} params.changedSectionId - The ID of the section that was edited
 * @param {Object} params.initialPose - Global initial pose
 * @param {Function} params.unitToPx - Converter
 * @param {Function} params.pxToUnit - Converter
 */
export const recalcAllFollowingSectionsV3 = ({ sections, changedSectionId, initialPose, unitToPx, pxToUnit }) => {
    const changedIndex = sections.findIndex(s => s.id === changedSectionId);
    if (changedIndex === -1) return sections;

    const newSections = [...sections];

    // 1. Recalculate the changed section itself (Actions from Points)
    newSections[changedIndex] = recalcSectionFromPointsV3({
        section: newSections[changedIndex],
        sections: newSections,
        initialPose,
        pxToUnit,
        unitToPx
    });

    // 2. Propagate changes to subsequent sections
    // Initialize runningPose to the end of the changed section
    const changedSection = newSections[changedIndex];
    const startPoseOfChanged = computePoseUpToSection(newSections, initialPose, changedSection.id, unitToPx);
    let runningPose = getPoseAfterActions(startPoseOfChanged, changedSection.actions, unitToPx);

    for (let i = changedIndex + 1; i < newSections.length; i++) {
        const section = newSections[i];

        // Update start angle
        const startAngle = runningPose.theta * RAD2DEG;

        // STRICT PINNED LOGIC:
        // 1. Create a copy of points
        let newPoints = [...section.points];

        // 2. Update ONLY the first point to match the new start pose
        if (newPoints.length > 0) {
            newPoints[0] = {
                ...newPoints[0],
                x: runningPose.x,
                y: runningPose.y,
                // We clear heading to allow it to be recalculated if needed, 
                // or we could keep it if we want to enforce the angle?
                // Usually heading is derived from the segment, so undefined is safer for auto-calc.
                heading: undefined
            };
        }

        // 3. Recalculate ACTIONS from these new points
        // This uses the existing points (which haven't moved except the first one)
        const newActions = buildActionsFromPolyline(newPoints, runningPose, pxToUnit);

        // 4. Calculate end pose
        const endPose = getPoseAfterActions(runningPose, newActions, unitToPx);

        // 5. Update section
        newSections[i] = {
            ...section,
            points: newPoints,
            actions: newActions,
            startAngle,
            endAngle: endPose.theta * RAD2DEG
        };

        // Advance running pose
        runningPose = endPose;
    }

    return newSections;
};
