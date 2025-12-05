
// Mock Constants
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Mock Converters
const unitToPx = (u) => u * 10;
const pxToUnit = (p) => p / 10;

// Geometry Functions (Simplified/Copied)
const normalizeAngle = (angle) => {
    let a = angle;
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
};

const buildActionsFromPolyline = (points, startPose, pxToUnit) => {
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
            acts.push({ type: 'move', distance: Number(signed.toFixed(2)) });
        }
        prev = { x: pt.x, y: pt.y, theta: targetHeading };
    }
    return acts;
};

const getPoseAfterActions = (startPose, actions, unitToPx) => {
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

// Stable Logic
const recalcSectionsFromPointsStable = ({ sections, initialPose, unitToPx, pxToUnit }) => {
    let currentPose = { ...initialPose };
    const newSections = [];

    for (const section of sections) {
        const points = section.points || [];

        const actions = buildActionsFromPolyline(points, currentPose, pxToUnit);
        const endPose = getPoseAfterActions(currentPose, actions, unitToPx);

        const updatedSection = {
            ...section,
            points: points,
            actions: actions,
            startAngle: currentPose.theta * RAD2DEG,
            endAngle: endPose.theta * RAD2DEG
        };

        newSections.push(updatedSection);
        currentPose = endPose;
    }

    return newSections;
};

// --- TEST EXECUTION ---

// Initial Pose
const initialPose = { x: 0, y: 0, theta: 0 };

// Setup Sections
// Sec1: (0,0) -> (100, 0)
// Sec2: (100,0) -> (200, 0)
// Sec3: (200,0) -> (300, 0)
const sections = [
    {
        id: 's1',
        points: [{ x: 100, y: 0, heading: 0 }],
        actions: [],
        color: 'red'
    },
    {
        id: 's2',
        points: [{ x: 200, y: 0, heading: 0 }],
        actions: [],
        color: 'blue'
    },
    {
        id: 's3',
        points: [{ x: 300, y: 0, heading: 0 }],
        actions: [],
        color: 'green'
    }
];

// 1. Initial Calculation
console.log("--- Initial Calculation ---");
const calculated = recalcSectionsFromPointsStable({ sections, initialPose, unitToPx, pxToUnit });

// Trace poses
let pose = { ...initialPose };
calculated.forEach(s => {
    console.log(`Section ${s.id} Start: (${pose.x.toFixed(4)}, ${pose.y.toFixed(4)})`);
    pose = getPoseAfterActions(pose, s.actions, unitToPx);
    console.log(`Section ${s.id} End:   (${pose.x.toFixed(4)}, ${pose.y.toFixed(4)})`);
});

// 2. Edit Section 1 End Point
// Move S1 End to (100, 50).
console.log("\n--- Edit Section 1 End to (100, 50) ---");
const editedSections = calculated.map(s => {
    if (s.id === 's1') {
        return { ...s, points: [{ x: 100, y: 50, heading: undefined }] };
    }
    return s;
});

const recalculated = recalcSectionsFromPointsStable({ sections: editedSections, initialPose, unitToPx, pxToUnit });

// Trace poses
pose = { ...initialPose };
recalculated.forEach(s => {
    console.log(`Section ${s.id} Start: (${pose.x.toFixed(4)}, ${pose.y.toFixed(4)})`);
    pose = getPoseAfterActions(pose, s.actions, unitToPx);
    console.log(`Section ${s.id} End:   (${pose.x.toFixed(4)}, ${pose.y.toFixed(4)})`);
});

// Check drift
const s2End = getPoseAfterActions(
    getPoseAfterActions(initialPose, recalculated[0].actions, unitToPx),
    recalculated[1].actions,
    unitToPx
);
console.log(`\nS2 Actual End: (${s2End.x.toFixed(4)}, ${s2End.y.toFixed(4)})`);
console.log(`S2 Target End: (200.0000, 0.0000)`);

const diff = Math.hypot(s2End.x - 200, s2End.y - 0);
console.log(`Drift: ${diff.toFixed(4)} px`);

if (diff > 1) {
    console.log("FAIL: Significant drift detected!");
} else {
    console.log("PASS: Drift is minimal.");
}
