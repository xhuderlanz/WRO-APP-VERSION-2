/**
 * collision.js
 * Collision detection module for WRO Planner.
 * Uses Determinant method for robust Segment-vs-Segment intersection.
 * Implements "Thick Line" (Triple Line) check for physical robot width.
 */

// Epsilon for floating point comparison to handle edge cases
const EPSILON = 0.000001;

/**
 * Check if a point is inside a rotated rectangle (obstacle)
 * @param {Object} point - {x, y}
 * @param {Object} obs - {x, y, w, h, rotation} (degrees)
 * @returns {boolean}
 */
export const isPointInside = (point, obs) => {
    // Translate point to obstacle's local coordinate system
    const dx = point.x - obs.x;
    const dy = point.y - obs.y;

    // Rotate point backwards by obstacle rotation
    const rad = -(obs.rotation || 0) * (Math.PI / 180);
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

    // Check against unrotated rectangle centered at origin
    const halfW = obs.w / 2;
    const halfH = obs.h / 2;

    return localX >= -halfW && localX <= halfW &&
        localY >= -halfH && localY <= halfH;
};

/**
 * Check if the segment (p1, p2) intersects with any obstacle
 * Base function for single line check.
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @param {Array} obstacles - Array of obstacles
 * @param {number} padding - Optional padding (inflation) in pixels
 * @returns {boolean}
 */
export const checkIntersection = (p1, p2, obstacles, padding = 0) => {
    if (!obstacles || obstacles.length === 0) return false;

    for (const obs of obstacles) {
        const effectiveObs = padding > 0
            ? { ...obs, w: obs.w + padding * 2, h: obs.h + padding * 2 }
            : obs;

        // 1. Check if either endpoint is inside the obstacle
        if (isPointInside(p1, effectiveObs) || isPointInside(p2, effectiveObs)) return true;

        // 2. Check if the segment intersects any of the 4 edges
        if (segmentIntersectsObstacle(p1, p2, effectiveObs)) return true;
    }
    return false;
};

/**
 * Check if a "Thick Path" (Robot Body) intersects with any obstacle.
 * Uses Triple Line method: Center, Left Edge, Right Edge.
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @param {number} width - Robot width (in pixels) // Or units? Caller should pass consistent unit, likely px.
 * @param {Array} obstacles - Array of obstacles
 * @param {number} padding - Optional padding (inflation) in pixels
 * @returns {boolean}
 */
export const checkPathCollision = (p1, p2, width, obstacles, padding = 0) => {
    // 1. Check Center Line
    if (checkIntersection(p1, p2, obstacles, padding)) return true;

    // Avoid calculation if points are same
    if (Math.abs(p1.x - p2.x) < EPSILON && Math.abs(p1.y - p2.y) < EPSILON) {
        // Just point check (already covered by center line check mostly, but robustly:)
        return checkIntersection(p1, p2, obstacles, padding);
    }

    // 2. Calculate Offsets
    // Vector V = P2 - P1
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);

    // Normal vector (-dy, dx) normalized
    // Left normal (if Y is down? or up? checking both sides so sign mostly matters for consistency)
    // Assume standard screen coords (Y down):
    // V = (dx, dy). Normal = (-dy, dx).
    const nx = -dy / len;
    const ny = dx / len;

    const halfWidth = width / 2;
    const offX = nx * halfWidth;
    const offY = ny * halfWidth;

    // 3. Generate Parallel Lines
    const leftP1 = { x: p1.x + offX, y: p1.y + offY };
    const leftP2 = { x: p2.x + offX, y: p2.y + offY };

    const rightP1 = { x: p1.x - offX, y: p1.y - offY };
    const rightP2 = { x: p2.x - offX, y: p2.y - offY };

    // 4. Check Parallel Lines
    if (checkIntersection(leftP1, leftP2, obstacles, padding)) return true;
    if (checkIntersection(rightP1, rightP2, obstacles, padding)) return true;

    return false;
};

/**
 * Check if the robot can rotate at a point without hitting obstacles (Circle collision)
 * @param {Object} point - {x, y}
 * @param {Array} obstacles - Array of obstacles
 * @param {Object} robot - Robot config {width, length} (in generic units, function expects pixels or consistent units)
 * @param {number} padding - Optional padding
 * @returns {boolean}
 */
export const checkRotationCollision = (point, obstacles, robot, padding = 0) => {
    if (!obstacles || obstacles.length === 0) return false;

    // Calculate rotation radius (hypotenuse of half-width/half-length)
    // Assuming robot dimensions passed are already in pixels or consistent with point/obstacles
    const halfW = (robot.width || 0) / 2;
    const halfL = (robot.length || 0) / 2;
    const radius = Math.hypot(halfW, halfL);

    for (const obs of obstacles) {
        // Inflate obstacle by padding
        const effectiveObs = padding > 0
            ? { ...obs, w: obs.w + padding * 2, h: obs.h + padding * 2 }
            : obs;

        // Check distance from point to rotated rectangle
        const dist = distPointToRotatedRect(point, effectiveObs);

        // If distance is 0 (inside) or less than radius, collision!
        if (dist < radius) return true;
    }
    return false;
};

/**
 * Calculate minimum distance from a point to a rotated rectangle.
 * Returns 0 if point is inside.
 */
const distPointToRotatedRect = (p, obs) => {
    // 1. Transform point to obstacle's local space
    const rad = -(obs.rotation || 0) * (Math.PI / 180);
    const dx = p.x - obs.x;
    const dy = p.y - obs.y;

    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

    const halfW = obs.w / 2;
    const halfH = obs.h / 2;

    // 2. Calculate distance in local aligned space
    // sdBox logic (signed distance to box) from Inigo Quilez or similar
    // d = length(max(abs(p)-b,0.0))
    const dX = Math.max(Math.abs(localX) - halfW, 0);
    const dY = Math.max(Math.abs(localY) - halfH, 0);

    // If both are 0, it's inside
    if (dX === 0 && dY === 0) return 0;

    return Math.hypot(dX, dY);
};


/**
 * Check if segment p1-p2 intersects any edge of the obstacle
 */
const segmentIntersectsObstacle = (p1, p2, obs) => {
    const corners = getCorners(obs);

    // Check intersection with all 4 edges
    for (let i = 0; i < 4; i++) {
        const c1 = corners[i];
        const c2 = corners[(i + 1) % 4];

        if (getLineIntersection(p1, p2, c1, c2)) {
            return true;
        }
    }
    return false;
};

/**
 * Calculate intersection using Determinant / Cross Product method.
 */
const getLineIntersection = (p1, p2, p3, p4) => {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if (Math.abs(denominator) < EPSILON) {
        return false;
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

    return t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON;
};

/**
 * Get the 4 corners of the rotated rectangle in world space
 */
const getCorners = (obs) => {
    const rad = (obs.rotation || 0) * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const halfW = obs.w / 2;
    const halfH = obs.h / 2;

    const corners = [
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH }
    ];

    return corners.map(p => ({
        x: obs.x + (p.x * cos - p.y * sin),
        y: obs.y + (p.x * sin + p.y * cos)
    }));
};
