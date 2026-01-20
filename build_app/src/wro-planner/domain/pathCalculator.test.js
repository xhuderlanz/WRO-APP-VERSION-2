/**
 * @fileoverview Unit tests for pathCalculator.js
 * 
 * Run with: node src/wro-planner/domain/pathCalculator.test.js
 * 
 * These tests verify the stateless path calculation logic including:
 * - Heading calculations (forward and reverse)
 * - Turn angle calculations (shortest path)
 * - Path segment generation with section colors
 * - Rubber-band behavior (deletion resilience)
 */

// Mock constants for standalone testing
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Inline helper functions (for standalone testing without module system)
const normalizeAngle = (angle) => {
    let a = angle;
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
};

const shortestTurnAngle = (from, to) => {
    return normalizeAngle(to - from);
};

const radToDeg = (rad) => rad * RAD2DEG;
const degToRad = (deg) => deg * DEG2RAD;

// Main calculation function (inlined for standalone testing)
function calculateRouteInstructions(initialPose, waypoints, pixelsPerUnit = 1) {
    const instructions = [];
    const pathSegments = [];
    const poses = [{ ...initialPose }];

    let robot = {
        x: initialPose.x,
        y: initialPose.y,
        theta: initialPose.theta
    };

    for (let i = 0; i < waypoints.length; i++) {
        const point = waypoints[i];

        const dx = point.x - robot.x;
        const dy = point.y - robot.y;
        const distancePx = Math.hypot(dx, dy);

        if (distancePx < 1e-6) {
            poses.push({ x: point.x, y: point.y, theta: robot.theta });
            continue;
        }

        let headingToTarget = Math.atan2(dy, dx);

        const targetHeading = point.reverse
            ? normalizeAngle(headingToTarget + Math.PI)
            : normalizeAngle(headingToTarget);

        const turnAngleRad = shortestTurnAngle(robot.theta, targetHeading);
        const turnAngleDeg = radToDeg(turnAngleRad);

        if (Math.abs(turnAngleDeg) > 0.1) {
            instructions.push({
                type: 'TURN',
                value: Number(turnAngleDeg.toFixed(2)),
                sectionId: point.sectionId || null,
                waypointId: point.id,
                direction: turnAngleDeg >= 0 ? 'right' : 'left'
            });
        }

        robot.theta = targetHeading;

        const distanceCm = distancePx / pixelsPerUnit;

        const isReverse = Boolean(point.reverse);
        instructions.push({
            type: 'MOVE',
            value: Number(distanceCm.toFixed(2)),
            sectionId: point.sectionId || null,
            waypointId: point.id,
            direction: isReverse ? 'reverse' : 'forward'
        });

        pathSegments.push({
            x1: robot.x,
            y1: robot.y,
            x2: point.x,
            y2: point.y,
            color: point.sectionColor || '#888888',
            sectionId: point.sectionId || null,
            waypointId: point.id,
            isReverse: isReverse
        });

        robot.x = point.x;
        robot.y = point.y;

        poses.push({
            x: robot.x,
            y: robot.y,
            theta: robot.theta
        });
    }

    return { instructions, pathSegments, poses };
}

function generatePlaybackActions(initialPose, waypoints, pixelsPerUnit = 1) {
    const { instructions } = calculateRouteInstructions(initialPose, waypoints, pixelsPerUnit);
    const actions = [];

    for (const instr of instructions) {
        if (instr.type === 'TURN') {
            actions.push({
                type: 'rotate',
                angle: instr.value,
                sectionId: instr.sectionId,
                waypointId: instr.waypointId
            });
        } else if (instr.type === 'MOVE') {
            const isReverse = instr.direction === 'reverse';
            actions.push({
                type: 'move',
                distance: isReverse ? -instr.value : instr.value,
                sectionId: instr.sectionId,
                waypointId: instr.waypointId,
                isReverse: isReverse
            });
        }
    }

    return actions;
}

// =====================================================================
// TEST UTILITIES
// =====================================================================

let testsPassed = 0;
let testsFailed = 0;

function assertEqual(actual, expected, message) {
    let pass;
    if (typeof actual === 'number' && typeof expected === 'number') {
        pass = Math.abs(actual - expected) < 0.01;  // Allow small floating point errors
    } else {
        pass = actual === expected;
    }
    if (pass) {
        testsPassed++;
        console.log(`  PASS: ${message}`);
    } else {
        testsFailed++;
        console.log(`  FAIL: ${message}`);
        console.log(`    Expected: ${expected}, Got: ${actual}`);
    }
}

function assertApprox(actual, expected, tolerance, message) {
    const pass = Math.abs(actual - expected) < tolerance;
    if (pass) {
        testsPassed++;
        console.log(`  PASS: ${message}`);
    } else {
        testsFailed++;
        console.log(`  FAIL: ${message}`);
        console.log(`    Expected: ~${expected} (±${tolerance}), Got: ${actual}`);
    }
}

function assertTrue(condition, message) {
    if (condition) {
        testsPassed++;
        console.log(`  PASS: ${message}`);
    } else {
        testsFailed++;
        console.log(`  FAIL: ${message}`);
    }
}

// =====================================================================
// TESTS
// =====================================================================

console.log('\n======== PATH CALCULATOR TESTS ========\n');

// Test 1: Simple forward movement (East)
console.log('Test 1: Simple forward movement (East)');
{
    const initialPose = { x: 100, y: 100, theta: 0 };  // Facing East
    const waypoints = [
        { id: 'p1', x: 200, y: 100, reverse: false, sectionId: 'sec_1', sectionColor: '#0000FF' }
    ];
    const result = calculateRouteInstructions(initialPose, waypoints, 1);

    assertEqual(result.instructions.length, 1, 'Should have 1 instruction (no turn needed)');
    assertEqual(result.instructions[0].type, 'MOVE', 'First instruction should be MOVE');
    assertEqual(result.instructions[0].value, 100, 'Should move 100 units');
    assertEqual(result.pathSegments[0].color, '#0000FF', 'Segment should have section color');
}

// Test 2: 90-degree right turn then move
console.log('\nTest 2: 90-degree right turn (South) then move');
{
    const initialPose = { x: 100, y: 100, theta: 0 };  // Facing East
    const waypoints = [
        { id: 'p1', x: 100, y: 200, reverse: false, sectionId: 'sec_1', sectionColor: '#FF0000' }
    ];
    const result = calculateRouteInstructions(initialPose, waypoints, 1);

    assertEqual(result.instructions.length, 2, 'Should have 2 instructions (turn + move)');
    assertEqual(result.instructions[0].type, 'TURN', 'First instruction should be TURN');
    assertApprox(result.instructions[0].value, 90, 0.1, 'Should turn 90 degrees right');
    assertEqual(result.instructions[1].value, 100, 'Should move 100 units');
}

// Test 3: Reverse movement (backing into target)
console.log('\nTest 3: Reverse movement (backing East)');
{
    const initialPose = { x: 100, y: 100, theta: 0 };  // Facing East
    const waypoints = [
        { id: 'p1', x: 200, y: 100, reverse: true, sectionId: 'sec_1', sectionColor: '#00FF00' }
    ];
    const result = calculateRouteInstructions(initialPose, waypoints, 1);

    assertEqual(result.instructions.length, 2, 'Should have 2 instructions (turn around + move)');
    // Robot needs to face West to back into the East target
    assertApprox(Math.abs(result.instructions[0].value), 180, 0.1, 'Should turn 180 degrees');
    assertEqual(result.instructions[1].direction, 'reverse', 'Should be reverse movement');
}

// Test 4: Rubber-band behavior (deletion resilience)
console.log('\nTest 4: Rubber-band behavior (path recalculates naturally)');
{
    const initialPose = { x: 0, y: 0, theta: 0 };

    // Original path: 0,0 -> 100,0 -> 100,100 -> 200,100
    const waypointsOriginal = [
        { id: 'p1', x: 100, y: 0, sectionId: 'sec_1', sectionColor: '#FF0000' },
        { id: 'p2', x: 100, y: 100, sectionId: 'sec_2', sectionColor: '#00FF00' },
        { id: 'p3', x: 200, y: 100, sectionId: 'sec_2', sectionColor: '#00FF00' }
    ];

    // After deleting p2: 0,0 -> 100,0 -> 200,100
    const waypointsAfterDelete = [
        { id: 'p1', x: 100, y: 0, sectionId: 'sec_1', sectionColor: '#FF0000' },
        { id: 'p3', x: 200, y: 100, sectionId: 'sec_2', sectionColor: '#00FF00' }
    ];

    const resultOriginal = calculateRouteInstructions(initialPose, waypointsOriginal, 1);
    const resultAfterDelete = calculateRouteInstructions(initialPose, waypointsAfterDelete, 1);

    assertEqual(resultOriginal.pathSegments.length, 3, 'Original should have 3 segments');
    assertEqual(resultAfterDelete.pathSegments.length, 2, 'After delete should have 2 segments');

    // The second segment in the deleted version should connect p1 to p3 directly
    assertEqual(resultAfterDelete.pathSegments[1].x1, 100, 'Second segment starts at p1.x');
    assertEqual(resultAfterDelete.pathSegments[1].y1, 0, 'Second segment starts at p1.y');
    assertEqual(resultAfterDelete.pathSegments[1].x2, 200, 'Second segment ends at p3.x');
    assertEqual(resultAfterDelete.pathSegments[1].y2, 100, 'Second segment ends at p3.y');
    assertEqual(resultAfterDelete.pathSegments[1].color, '#00FF00', 'Bridge inherits TARGET section color');
}

// Test 5: Multiple sections with different colors
console.log('\nTest 5: Multiple sections with different colors');
{
    const initialPose = { x: 0, y: 0, theta: 0 };
    const waypoints = [
        { id: 'p1', x: 100, y: 0, sectionId: 'sec_1', sectionColor: '#FF0000' },
        { id: 'p2', x: 200, y: 0, sectionId: 'sec_2', sectionColor: '#00FF00' },
        { id: 'p3', x: 300, y: 0, sectionId: 'sec_3', sectionColor: '#0000FF' }
    ];

    const result = calculateRouteInstructions(initialPose, waypoints, 1);

    assertEqual(result.pathSegments[0].color, '#FF0000', 'Segment 1 has section 1 color');
    assertEqual(result.pathSegments[1].color, '#00FF00', 'Segment 2 has section 2 color');
    assertEqual(result.pathSegments[2].color, '#0000FF', 'Segment 3 has section 3 color');

    assertEqual(result.pathSegments[0].sectionId, 'sec_1', 'Segment 1 has section 1 id');
    assertEqual(result.pathSegments[1].sectionId, 'sec_2', 'Segment 2 has section 2 id');
    assertEqual(result.pathSegments[2].sectionId, 'sec_3', 'Segment 3 has section 3 id');
}

// Test 6: Playback actions generation
console.log('\nTest 6: Playback actions generation');
{
    const initialPose = { x: 0, y: 0, theta: 0 };
    const waypoints = [
        { id: 'p1', x: 100, y: 100, sectionId: 'sec_1', sectionColor: '#FF0000' }
    ];

    const actions = generatePlaybackActions(initialPose, waypoints, 1);

    assertTrue(actions.length >= 2, 'Should have at least 2 actions (rotate + move)');
    assertTrue(actions.some(a => a.type === 'rotate'), 'Should have a rotate action');
    assertTrue(actions.some(a => a.type === 'move'), 'Should have a move action');

    const moveAction = actions.find(a => a.type === 'move');
    assertApprox(Math.abs(moveAction.distance), Math.hypot(100, 100), 0.1, 'Move distance should be ~141.42');
}

// Test 7: Shortest turn (prefer -90 over +270)
console.log('\nTest 7: Shortest turn path');
{
    const initialPose = { x: 100, y: 100, theta: 0 };  // Facing East
    const waypoints = [
        { id: 'p1', x: 100, y: 0, sectionId: 'sec_1', sectionColor: '#FF0000' }  // North
    ];

    const result = calculateRouteInstructions(initialPose, waypoints, 1);

    // To go North from facing East, shortest is -90 degrees (left turn)
    const turnInstr = result.instructions.find(i => i.type === 'TURN');
    assertTrue(turnInstr !== undefined, 'Should have a turn instruction');
    assertTrue(Math.abs(turnInstr.value) <= 180, 'Turn should be <= 180 degrees');
    assertApprox(turnInstr.value, -90, 0.1, 'Should turn -90 degrees (left)');
}

// Test 8: Pixels per unit scaling
console.log('\nTest 8: Pixels per unit scaling');
{
    const initialPose = { x: 0, y: 0, theta: 0 };
    const waypoints = [
        { id: 'p1', x: 50, y: 0, sectionId: 'sec_1' }  // 50 pixels away
    ];

    // With pixelsPerUnit = 5 (5 pixels = 1 cm)
    const result = calculateRouteInstructions(initialPose, waypoints, 5);

    const moveInstr = result.instructions.find(i => i.type === 'MOVE');
    assertEqual(moveInstr.value, 10, 'Should move 10 cm (50px / 5)');
}

// =====================================================================
// SUMMARY
// =====================================================================

console.log('\n======== TEST SUMMARY ========');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total:  ${testsPassed + testsFailed}`);
console.log('==============================\n');

if (testsFailed > 0) {
    process.exit(1);
}
