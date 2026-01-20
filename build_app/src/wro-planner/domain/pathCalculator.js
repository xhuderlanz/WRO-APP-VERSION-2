/**
 * @fileoverview WRO Path Planner - Stateless Path Calculator
 * 
 * This module implements a "Rubber-Band" architecture for calculating robot paths.
 * It is completely stateless - given the same inputs, it will always produce 
 * the same outputs. This enables:
 * 
 * 1. Robust deletion: When a waypoint is deleted, the path naturally "snaps" 
 *    to connect the previous point to the next.
 * 2. Easy section grouping: Each waypoint carries its section info, which is 
 *    preserved in the output for visualization.
 * 3. Predictable behavior: No hidden state that can break on edge cases.
 * 
 * @module pathCalculator
 */

import { DEG2RAD, RAD2DEG } from "./constants";

/* =====================================================================
 * HELPER FUNCTIONS
 * ===================================================================== */

/**
 * Normalizes an angle to the range (-π, π].
 * @param {number} angle - Angle in radians.
 * @returns {number} Normalized angle.
 */
export const normalizeAngle = (angle) => {
    let a = angle;
    while (a <= -Math.PI) a += 2 * Math.PI;
    while (a > Math.PI) a -= 2 * Math.PI;
    return a;
};

/**
 * Calculates the shortest turn angle between two headings.
 * Result is in the range (-π, π].
 * @param {number} from - Current heading in radians.
 * @param {number} to - Target heading in radians.
 * @returns {number} Shortest turn angle in radians.
 */
export const shortestTurnAngle = (from, to) => {
    return normalizeAngle(to - from);
};

/**
 * Converts radians to degrees.
 * @param {number} rad - Angle in radians.
 * @returns {number} Angle in degrees.
 */
export const radToDeg = (rad) => rad * RAD2DEG;

/**
 * Converts degrees to radians.
 * @param {number} deg - Angle in degrees.
 * @returns {number} Angle in radians.
 */
export const degToRad = (deg) => deg * DEG2RAD;

/* =====================================================================
 * MAIN CALCULATION FUNCTION
 * ===================================================================== */

/**
 * @typedef {Object} Pose
 * @property {number} x - X coordinate in pixels.
 * @property {number} y - Y coordinate in pixels.
 * @property {number} theta - Heading angle in radians (0 = East, positive = CCW in math, but CW on canvas due to inverted Y).
 */

/**
 * @typedef {Object} Waypoint
 * @property {string} id - Unique identifier for the waypoint.
 * @property {number} x - X coordinate in pixels.
 * @property {number} y - Y coordinate in pixels.
 * @property {boolean} [reverse=false] - If true, robot backs into this point.
 * @property {string} [sectionId] - ID of the section this waypoint belongs to.
 * @property {string} [sectionColor] - Color for visualizing this section.
 * @property {string} [reference='center'] - Reference point: 'center' or 'tip'.
 */

/**
 * @typedef {Object} Instruction
 * @property {string} type - Either 'TURN' or 'MOVE'.
 * @property {number} value - Degrees for TURN, centimeters for MOVE.
 * @property {string} sectionId - Section this instruction belongs to.
 * @property {string} waypointId - Waypoint that triggered this instruction.
 * @property {string} [direction] - 'forward' or 'reverse' for MOVE instructions.
 */

/**
 * @typedef {Object} PathSegment
 * @property {number} x1 - Start X coordinate in pixels.
 * @property {number} y1 - Start Y coordinate in pixels.
 * @property {number} x2 - End X coordinate in pixels.
 * @property {number} y2 - End Y coordinate in pixels.
 * @property {string} color - Color for drawing this segment.
 * @property {string} sectionId - Section this segment belongs to.
 * @property {string} waypointId - Target waypoint ID.
 * @property {boolean} isReverse - Whether this is a reverse movement.
 */

/**
 * @typedef {Object} RouteCalculationResult
 * @property {Instruction[]} instructions - Array of TURN and MOVE commands.
 * @property {PathSegment[]} pathSegments - Array of line segments for drawing.
 * @property {Pose[]} poses - Array of robot poses at each waypoint (for debugging/visualization).
 */

/**
 * Calculates route instructions and path segments from a list of waypoints.
 * This is a STATELESS function - it recalculates everything from scratch each time.
 * 
 * **Algorithm:**
 * 1. Initialize a "Virtual Robot" at the initial pose.
 * 2. For each waypoint:
 *    a. Calculate dx, dy, and distance (hypot).
 *    b. Calculate target heading (atan2). If reverse, add π to heading.
 *    c. Calculate turn angle (shortest path, -180° to 180°).
 *    d. Update virtual robot state.
 *    e. Generate TURN and MOVE instructions.
 *    f. Generate path segment with section color.
 * 
 * **Coordinate System:**
 * - HTML5 Canvas: Y increases downwards.
 * - Angles: 0 = East, positive angles rotate clockwise on canvas.
 * - This follows standard atan2 behavior on an inverted Y axis.
 * 
 * @param {Pose} initialPose - Starting pose of the robot.
 * @param {Waypoint[]} waypoints - List of waypoints to visit.
 * @param {number} pixelsPerUnit - Conversion factor (pixels per cm).
 * @returns {RouteCalculationResult} Calculated instructions and path segments.
 */
export function calculateRouteInstructions(initialPose, waypoints, pixelsPerUnit = 1) {
    const instructions = [];
    const pathSegments = [];
    const poses = [{ ...initialPose }];  // Track all poses for debugging

    // Virtual robot state
    let robot = {
        x: initialPose.x,
        y: initialPose.y,
        theta: initialPose.theta  // radians
    };

    for (let i = 0; i < waypoints.length; i++) {
        const point = waypoints[i];

        // Calculate vector to target
        const dx = point.x - robot.x;
        const dy = point.y - robot.y;
        const distancePx = Math.hypot(dx, dy);

        // Skip if we're already at the target (prevents division by zero)
        if (distancePx < 1e-6) {
            poses.push({ x: point.x, y: point.y, theta: robot.theta });
            continue;
        }

        // Calculate heading to target
        // On canvas: Y increases downward, so atan2(dy, dx) gives:
        // - 0 = East
        // - π/2 = South
        // - ±π = West
        // - -π/2 = North
        let headingToTarget = Math.atan2(dy, dx);

        // If reversing, the robot faces OPPOSITE to travel direction
        // (it backs into the target)
        const targetHeading = point.reverse
            ? normalizeAngle(headingToTarget + Math.PI)
            : normalizeAngle(headingToTarget);

        // Calculate turn angle (shortest path)
        const turnAngleRad = shortestTurnAngle(robot.theta, targetHeading);
        const turnAngleDeg = radToDeg(turnAngleRad);

        // Generate TURN instruction if significant
        if (Math.abs(turnAngleDeg) > 0.1) {  // Threshold to avoid tiny turns
            instructions.push({
                type: 'TURN',
                value: Number(turnAngleDeg.toFixed(2)),
                sectionId: point.sectionId || null,
                waypointId: point.id,
                direction: turnAngleDeg >= 0 ? 'right' : 'left'  // Positive = clockwise on canvas
            });
        }

        // Update robot heading after turn
        robot.theta = targetHeading;

        // Calculate distance in centimeters
        const distanceCm = distancePx / pixelsPerUnit;

        // Generate MOVE instruction
        const isReverse = Boolean(point.reverse);
        instructions.push({
            type: 'MOVE',
            value: Number(distanceCm.toFixed(2)),
            sectionId: point.sectionId || null,
            waypointId: point.id,
            direction: isReverse ? 'reverse' : 'forward'
        });

        // Generate path segment for drawing
        // The segment always connects robot's current position to target
        // Color is inherited from the TARGET waypoint's section
        pathSegments.push({
            x1: robot.x,
            y1: robot.y,
            x2: point.x,
            y2: point.y,
            color: point.sectionColor || '#888888',  // Default gray if no color
            sectionId: point.sectionId || null,
            waypointId: point.id,
            isReverse: isReverse
        });

        // Update robot position
        robot.x = point.x;
        robot.y = point.y;

        // Store pose for debugging
        poses.push({
            x: robot.x,
            y: robot.y,
            theta: robot.theta
        });
    }

    return {
        instructions,
        pathSegments,
        poses
    };
}

/* =====================================================================
 * PLAYBACK HELPER
 * ===================================================================== */

/**
 * @typedef {Object} PlaybackAction
 * @property {string} type - Either 'rotate' or 'move'.
 * @property {number} angle - Rotation angle in degrees (only for 'rotate').
 * @property {number} distance - Distance in units (only for 'move').
 * @property {string} sectionId - Section this action belongs to.
 * @property {string} waypointId - Associated waypoint ID.
 * @property {boolean} [isReverse] - Whether this is a reverse movement.
 */

/**
 * Converts calculated instructions into playback actions compatible with
 * a standard animation loop.
 * 
 * This function transforms the output of calculateRouteInstructions into
 * a simpler format suitable for step-by-step animation.
 * 
 * @param {Pose} initialPose - Starting pose of the robot.
 * @param {Waypoint[]} waypoints - List of waypoints to visit.
 * @param {number} pixelsPerUnit - Conversion factor (pixels per cm).
 * @returns {PlaybackAction[]} Array of actions for animation.
 */
export function generatePlaybackActions(initialPose, waypoints, pixelsPerUnit = 1) {
    const { instructions } = calculateRouteInstructions(initialPose, waypoints, pixelsPerUnit);
    const actions = [];

    for (const instr of instructions) {
        if (instr.type === 'TURN') {
            actions.push({
                type: 'rotate',
                angle: instr.value,  // degrees
                sectionId: instr.sectionId,
                waypointId: instr.waypointId
            });
        } else if (instr.type === 'MOVE') {
            // For reverse movements, the distance is positive but 
            // we mark it as reverse for the animation to handle
            const isReverse = instr.direction === 'reverse';
            actions.push({
                type: 'move',
                distance: isReverse ? -instr.value : instr.value,  // Negative for reverse
                sectionId: instr.sectionId,
                waypointId: instr.waypointId,
                isReverse: isReverse
            });
        }
    }

    return actions;
}

/* =====================================================================
 * UTILITY FUNCTIONS
 * ===================================================================== */

/**
 * Groups instructions by section for UI display.
 * @param {Instruction[]} instructions - Flat list of instructions.
 * @returns {Object.<string, Instruction[]>} Instructions grouped by sectionId.
 */
export function groupInstructionsBySection(instructions) {
    const groups = {};
    for (const instr of instructions) {
        const sectionId = instr.sectionId || 'default';
        if (!groups[sectionId]) {
            groups[sectionId] = [];
        }
        groups[sectionId].push(instr);
    }
    return groups;
}

/**
 * Formats an instruction as a human-readable string.
 * @param {Instruction} instr - The instruction to format.
 * @returns {string} Formatted instruction string.
 */
export function formatInstruction(instr) {
    if (instr.type === 'TURN') {
        const direction = instr.value >= 0 ? 'RIGHT' : 'LEFT';
        return `TURN ${direction} ${Math.abs(instr.value).toFixed(1)}°`;
    } else if (instr.type === 'MOVE') {
        const direction = instr.direction === 'reverse' ? 'REVERSE' : 'FORWARD';
        return `MOVE ${direction} ${instr.value.toFixed(1)} cm`;
    }
    return `UNKNOWN: ${JSON.stringify(instr)}`;
}

/**
 * Calculates the total path length in centimeters.
 * @param {Instruction[]} instructions - List of instructions.
 * @returns {number} Total path length in cm.
 */
export function calculateTotalPathLength(instructions) {
    return instructions
        .filter(instr => instr.type === 'MOVE')
        .reduce((total, instr) => total + instr.value, 0);
}

/**
 * Calculates the total rotation in degrees (absolute).
 * @param {Instruction[]} instructions - List of instructions.
 * @returns {number} Total rotation in degrees.
 */
export function calculateTotalRotation(instructions) {
    return instructions
        .filter(instr => instr.type === 'TURN')
        .reduce((total, instr) => total + Math.abs(instr.value), 0);
}

/**
 * Simulates the final pose after executing all waypoints.
 * Useful for checking where the robot will end up.
 * 
 * @param {Pose} initialPose - Starting pose.
 * @param {Waypoint[]} waypoints - List of waypoints.
 * @returns {Pose} Final pose after all waypoints.
 */
export function calculateFinalPose(initialPose, waypoints) {
    if (waypoints.length === 0) {
        return { ...initialPose };
    }

    const lastWaypoint = waypoints[waypoints.length - 1];

    // Calculate final heading
    let robot = { x: initialPose.x, y: initialPose.y, theta: initialPose.theta };

    for (const point of waypoints) {
        const dx = point.x - robot.x;
        const dy = point.y - robot.y;
        const distancePx = Math.hypot(dx, dy);

        if (distancePx >= 1e-6) {
            let headingToTarget = Math.atan2(dy, dx);
            robot.theta = point.reverse
                ? normalizeAngle(headingToTarget + Math.PI)
                : normalizeAngle(headingToTarget);
        }

        robot.x = point.x;
        robot.y = point.y;
    }

    return robot;
}

/* =====================================================================
 * SECTION HELPERS (for working with section-grouped waypoints)
 * ===================================================================== */

/**
 * Flattens sections with points into a simple waypoint array.
 * This bridges the gap between the sections-based UI and the 
 * stateless path calculator.
 * 
 * @param {Array} sections - Array of section objects with points.
 * @returns {Waypoint[]} Flattened list of waypoints with section info.
 * 
 * @example
 * const sections = [
 *   { id: 'sec_1', color: '#0000FF', points: [{ id: 'p1', x: 100, y: 100 }] },
 *   { id: 'sec_2', color: '#FF0000', points: [{ id: 'p2', x: 200, y: 150, reverse: true }] }
 * ];
 * const waypoints = flattenSectionsToWaypoints(sections);
 * // Result: [
 * //   { id: 'p1', x: 100, y: 100, sectionId: 'sec_1', sectionColor: '#0000FF', reverse: false },
 * //   { id: 'p2', x: 200, y: 150, sectionId: 'sec_2', sectionColor: '#FF0000', reverse: true }
 * // ]
 */
export function flattenSectionsToWaypoints(sections) {
    const waypoints = [];

    for (const section of sections) {
        if (!section.points || !Array.isArray(section.points)) {
            continue;
        }

        for (const point of section.points) {
            waypoints.push({
                id: point.id,
                x: point.x,
                y: point.y,
                reverse: Boolean(point.reverse),
                reference: point.reference || 'center',
                sectionId: section.id,
                sectionColor: section.color || '#888888'
            });
        }
    }

    return waypoints;
}

/**
 * Wraps the full calculation pipeline for sections-based input.
 * This is a convenience function that combines flattenSectionsToWaypoints
 * and calculateRouteInstructions.
 * 
 * @param {Pose} initialPose - Starting pose.
 * @param {Array} sections - Array of section objects with points.
 * @param {number} pixelsPerUnit - Conversion factor (pixels per cm).
 * @returns {RouteCalculationResult} Calculated instructions and path segments.
 */
export function calculateRouteFromSections(initialPose, sections, pixelsPerUnit = 1) {
    const waypoints = flattenSectionsToWaypoints(sections);
    return calculateRouteInstructions(initialPose, waypoints, pixelsPerUnit);
}

/**
 * Wraps playback generation for sections-based input.
 * 
 * @param {Pose} initialPose - Starting pose.
 * @param {Array} sections - Array of section objects with points.
 * @param {number} pixelsPerUnit - Conversion factor (pixels per cm).
 * @returns {PlaybackAction[]} Array of actions for animation.
 */
export function generatePlaybackFromSections(initialPose, sections, pixelsPerUnit = 1) {
    const waypoints = flattenSectionsToWaypoints(sections);
    return generatePlaybackActions(initialPose, waypoints, pixelsPerUnit);
}
