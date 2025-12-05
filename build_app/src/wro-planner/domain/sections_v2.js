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
export const recalcSectionFromPointsV2 = ({ section, sections, initialPose, pxToUnit, unitToPx }) => {
    // 1. Calculate the start pose of this section based on previous sections
    const startPose = computePoseUpToSection(sections, initialPose, section.id, unitToPx);

    // 2. Re-build actions from the current points (this is the "destructive" part for the edited section, which is desired)
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
 * - The changed section is recalculated from its points (actions are regenerated).
 * - Subsequent sections PRESERVE their actions, but their points are regenerated based on the new start pose.
 * 
 * @param {Object} params
 * @param {Array} params.sections - The full list of sections
 * @param {string} params.changedSectionId - The ID of the section that was edited
 * @param {Object} params.initialPose - Global initial pose
 * @param {Function} params.unitToPx - Converter
 * @param {Function} params.pxToUnit - Converter
 */
export const recalcAllFollowingSectionsV2 = ({ sections, changedSectionId, initialPose, unitToPx, pxToUnit }) => {
    const changedIndex = sections.findIndex(s => s.id === changedSectionId);
    if (changedIndex === -1) return sections;

    const newSections = [...sections];

    // 1. Recalculate the changed section itself (Actions from Points)
    // We assume the caller might have already updated the points in 'sections', 
    // but we need to ensure actions match those points.
    newSections[changedIndex] = recalcSectionFromPointsV2({
        section: newSections[changedIndex],
        sections: newSections, // Note: computePoseUpToSection only looks at PREVIOUS sections, so passing newSections is safe
        initialPose,
        pxToUnit,
        unitToPx
    });

    // 2. Propagate changes to subsequent sections (Points from Actions)
    // We start tracking the "running pose" from the end of the changed section
    let runningPose = computePoseUpToSection(newSections, initialPose, newSections[changedIndex + 1]?.id, unitToPx);
    // Actually, it's safer/cleaner to just compute it from the end of the changed section:
    // But computePoseUpToSection(..., nextId) does exactly that.

    // Optimization: We can just calculate the end pose of the changed section directly
    // instead of re-traversing everything for every section.
    // Let's do a loop updating runningPose.

    // Initialize runningPose to the end of the changed section
    const changedSection = newSections[changedIndex];
    const startPoseOfChanged = computePoseUpToSection(newSections, initialPose, changedSection.id, unitToPx);
    runningPose = getPoseAfterActions(startPoseOfChanged, changedSection.actions, unitToPx);

    for (let i = changedIndex + 1; i < newSections.length; i++) {
        const section = newSections[i];

        // Update start angle
        const startAngle = runningPose.theta * RAD2DEG;

        // REGENERATE POINTS from existing actions + new start pose
        // This preserves the "shape" (actions) of the section
        const newPoints = pointsFromActions(section.actions, runningPose, unitToPx);

        // Calculate end pose
        const endPose = getPoseAfterActions(runningPose, section.actions, unitToPx);

        // Update section
        newSections[i] = {
            ...section,
            points: newPoints,
            startAngle,
            endAngle: endPose.theta * RAD2DEG
        };

        // Advance running pose
        runningPose = endPose;
    }

    return newSections;
};
