import { DEG2RAD } from "./constants";
import { pointsFromActions, computePoseUpToSection, buildActionsFromPolyline } from "./geometry";

export const recalcAllFollowingSections = ({ sections, changedSectionId, initialPose, unitToPx }) => {
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
        if (i >= changedIndex) {
            const newPoints = pointsFromActions(sectionsCopy[i].actions, startPose, unitToPx);
            sectionsCopy[i] = { ...sectionsCopy[i], points: newPoints };
        }
        runningPose = advancePose(startPose, sectionsCopy[i].actions);
    }

    return sectionsCopy;
};

export const recalcSectionFromPoints = ({ section, sections, initialPose, pxToUnit, unitToPx }) => {
    // We need to compute pose up to the START of this section.
    // So we pass section.id to computePoseUpToSection, which iterates until it finds the section.
    const start = computePoseUpToSection(sections, initialPose, section.id, unitToPx);
    const acts = buildActionsFromPolyline(section.points, start, pxToUnit);
    return { ...section, actions: acts };
};
