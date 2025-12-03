import { RAD2DEG } from "./constants";
import { buildActionsFromPolyline, getPoseAfterActions, computePoseUpToSection, pointsFromActions } from "./geometry";

/**
 * Recalculates all sections based on their current points.
 * POINTS ARE IMMUTABLE in this version (X, Y are preserved).
 * However, HEADINGS are recalculated to ensure connectivity without drift.
 * 
 * We iterate through all sections, and for each section:
 * 1. Determine start pose (initialPose or end of previous section).
 * 2. Use existing points (X, Y).
 * 3. Recalculate actions to traverse these points from the start pose.
 * 4. Recalculate end pose and angles.
 * 5. Update point headings based on the new geometry.
 * 
 * @param {Object} params
 * @param {Array} params.sections - The full list of sections
 * @param {Object} params.initialPose - Global initial pose
 * @param {Function} params.unitToPx - Converter
 * @param {Function} params.pxToUnit - Converter
 */
export const recalcSectionsFromPointsStable = ({ sections, initialPose, unitToPx, pxToUnit }) => {
    let currentPose = { ...initialPose };
    const newSections = [];

    for (const section of sections) {
        const originalPoints = section.points || [];

        // 1. Prepare points for action calculation
        // We MUST clear the 'heading' because the start pose might have changed,
        // making the old heading invalid for the segment.
        // We want the actions to naturally follow the geometry (X, Y).
        const pointsForCalc = originalPoints.map(p => ({
            ...p,
            heading: undefined
        }));

        // 2. Calculate actions
        const actions = buildActionsFromPolyline(pointsForCalc, currentPose, pxToUnit);

        // 3. Calculate the end pose
        const endPose = getPoseAfterActions(currentPose, actions, unitToPx);

        // 4. Update points with new headings
        // We use pointsFromActions to derive the correct headings for the new geometry.
        // BUT we strictly preserve the original X, Y to avoid drift.
        const calculatedPoints = pointsFromActions(actions, currentPose, unitToPx);

        const mergedPoints = originalPoints.map((p, i) => {
            const calcP = calculatedPoints[i];
            return {
                ...p, // Keep original X, Y, reverse, reference
                heading: calcP ? calcP.heading : p.heading // Update heading
            };
        });

        // 5. Create updated section
        const updatedSection = {
            ...section,
            points: mergedPoints,
            actions: actions,
            startAngle: currentPose.theta * RAD2DEG,
            endAngle: endPose.theta * RAD2DEG
        };

        newSections.push(updatedSection);

        // Advance pose for next section
        currentPose = endPose;
    }

    return newSections;
};

/**
 * Helper to be called after an edit.
 * In this stable version, we simply recalculate everything from the current points.
 * The 'changedSectionId' is ignored because we always do a full pass to ensure consistency
 * based on the immutable points.
 */
export const recalcAfterEditStable = ({ sections, changedSectionId, initialPose, unitToPx, pxToUnit }) => {
    return recalcSectionsFromPointsStable({ sections, initialPose, unitToPx, pxToUnit });
};

/**
 * Recalculates a single section's actions and end pose based on its points.
 * Used when updating a single section in a map/reduce operation.
 */
export const recalcSectionFromPointsStable = ({ section, sections, initialPose, pxToUnit, unitToPx }) => {
    // Calculate start pose for this section
    const startPose = computePoseUpToSection(sections, initialPose, section.id, unitToPx);

    // Prepare points (clear heading)
    const pointsForCalc = section.points.map(p => ({ ...p, heading: undefined }));

    // Recalc actions
    const actions = buildActionsFromPolyline(pointsForCalc, startPose, pxToUnit);

    // Recalc end pose
    const endPose = getPoseAfterActions(startPose, actions, unitToPx);

    // Update headings
    const calculatedPoints = pointsFromActions(actions, startPose, unitToPx);
    const mergedPoints = section.points.map((p, i) => {
        const calcP = calculatedPoints[i];
        return {
            ...p,
            heading: calcP ? calcP.heading : p.heading
        };
    });

    return {
        ...section,
        points: mergedPoints,
        actions,
        startAngle: startPose.theta * RAD2DEG,
        endAngle: endPose.theta * RAD2DEG
    };
};
