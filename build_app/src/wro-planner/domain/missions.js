/**
 * missions.js
 * Mission markers module for WRO Planner.
 * Missions are visual markers that indicate target locations for the robot.
 * Unlike obstacles, missions do NOT have collision detection.
 */

import { uid } from "./constants";

/**
 * Available mission shapes
 */
export const MISSION_SHAPES = {
    CIRCLE: 'circle',
    SQUARE: 'square',
    TRIANGLE: 'triangle',
    STAR: 'star',
    FLAG: 'flag'
};

/**
 * Default mission colors palette
 */
export const MISSION_COLORS = [
    '#22c55e', // green-500
    '#3b82f6', // blue-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
    '#f59e0b', // amber-500
    '#14b8a6', // teal-500
];

/**
 * Create a new mission object
 * @param {number} x - X position in pixels
 * @param {number} y - Y position in pixels
 * @param {Object} options - Optional configuration
 * @returns {Object} Mission object
 */
export const createMission = (x, y, options = {}) => {
    const colorIndex = Math.floor(Math.random() * MISSION_COLORS.length);
    return {
        id: uid('mission'),
        x,
        y,
        size: options.size || 40,
        color: options.color || MISSION_COLORS[colorIndex],
        shape: options.shape || MISSION_SHAPES.CIRCLE,
        label: options.label || '',
        rotation: options.rotation || 0,
        opacity: options.opacity || 0.7
    };
};

/**
 * Draw a mission marker on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} mission - Mission object
 * @param {boolean} isSelected - Whether the mission is selected
 */
export const drawMission = (ctx, mission, isSelected = false) => {
    const { x, y, size, color, shape, label, rotation, opacity } = mission;
    const halfSize = size / 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation || 0) * Math.PI / 180);
    ctx.globalAlpha = opacity || 0.7;

    // Draw shape based on type
    switch (shape) {
        case MISSION_SHAPES.SQUARE:
            drawSquare(ctx, halfSize, color, isSelected);
            break;
        case MISSION_SHAPES.TRIANGLE:
            drawTriangle(ctx, halfSize, color, isSelected);
            break;
        case MISSION_SHAPES.STAR:
            drawStar(ctx, halfSize, color, isSelected);
            break;
        case MISSION_SHAPES.FLAG:
            drawFlag(ctx, halfSize, color, isSelected);
            break;
        case MISSION_SHAPES.CIRCLE:
        default:
            drawCircle(ctx, halfSize, color, isSelected);
            break;
    }

    // Draw crosshair in center
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-halfSize * 0.4, 0);
    ctx.lineTo(halfSize * 0.4, 0);
    ctx.moveTo(0, -halfSize * 0.4);
    ctx.lineTo(0, halfSize * 0.4);
    ctx.stroke();

    // Draw label if exists
    if (label) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, halfSize + 14);
    }

    // Draw selection ring
    if (isSelected) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, halfSize + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw resize handles
        const handleSize = 8;
        const handlePositions = [
            { x: -halfSize, y: -halfSize },
            { x: halfSize, y: -halfSize },
            { x: -halfSize, y: halfSize },
            { x: halfSize, y: halfSize },
        ];
        handlePositions.forEach(({ x: hx, y: hy }) => {
            ctx.fillStyle = '#06b6d4';
            ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        });
    }

    ctx.restore();
};

// Helper drawing functions
const drawCircle = (ctx, halfSize, color, isSelected) => {
    ctx.beginPath();
    ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#06b6d4' : adjustColor(color, -30);
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();
};

const drawSquare = (ctx, halfSize, color, isSelected) => {
    ctx.fillStyle = color;
    ctx.fillRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
    ctx.strokeStyle = isSelected ? '#06b6d4' : adjustColor(color, -30);
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.strokeRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
};

const drawTriangle = (ctx, halfSize, color, isSelected) => {
    ctx.beginPath();
    ctx.moveTo(0, -halfSize);
    ctx.lineTo(halfSize, halfSize);
    ctx.lineTo(-halfSize, halfSize);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#06b6d4' : adjustColor(color, -30);
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();
};

const drawStar = (ctx, halfSize, color, isSelected) => {
    const spikes = 5;
    const outerRadius = halfSize;
    const innerRadius = halfSize * 0.5;

    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (Math.PI / spikes) * i - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#06b6d4' : adjustColor(color, -30);
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();
};

const drawFlag = (ctx, halfSize, color, isSelected) => {
    // Pole
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(-2, -halfSize, 4, halfSize * 2);

    // Flag
    ctx.beginPath();
    ctx.moveTo(2, -halfSize);
    ctx.lineTo(halfSize, -halfSize * 0.5);
    ctx.lineTo(2, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#06b6d4' : adjustColor(color, -30);
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();
};

/**
 * Adjust color brightness
 * @param {string} color - Hex color
 * @param {number} amount - Amount to adjust (-255 to 255)
 * @returns {string} Adjusted hex color
 */
const adjustColor = (color, amount) => {
    const clamp = (val) => Math.min(255, Math.max(0, val));
    const hex = color.replace('#', '');
    const r = clamp(parseInt(hex.substr(0, 2), 16) + amount);
    const g = clamp(parseInt(hex.substr(2, 2), 16) + amount);
    const b = clamp(parseInt(hex.substr(4, 2), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/**
 * Check if a point is inside a mission marker
 * @param {Object} point - {x, y}
 * @param {Object} mission - Mission object
 * @returns {boolean}
 */
export const isPointInsideMission = (point, mission) => {
    const dx = point.x - mission.x;
    const dy = point.y - mission.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= mission.size / 2 + 5; // 5px tolerance
};

/**
 * Check if point is on a resize handle of a selected mission
 * @param {Object} point - {x, y}
 * @param {Object} mission - Mission object
 * @returns {string|null} Handle position ('nw', 'ne', 'sw', 'se') or null
 */
export const getResizeHandleAtPoint = (point, mission) => {
    const halfSize = mission.size / 2;
    const handleSize = 12;
    const handles = [
        { name: 'nw', x: mission.x - halfSize, y: mission.y - halfSize },
        { name: 'ne', x: mission.x + halfSize, y: mission.y - halfSize },
        { name: 'sw', x: mission.x - halfSize, y: mission.y + halfSize },
        { name: 'se', x: mission.x + halfSize, y: mission.y + halfSize },
    ];

    for (const handle of handles) {
        const dx = point.x - handle.x;
        const dy = point.y - handle.y;
        if (Math.abs(dx) <= handleSize / 2 && Math.abs(dy) <= handleSize / 2) {
            return handle.name;
        }
    }
    return null;
};

/**
 * Export missions to JSON format
 * @param {Array} missions - Array of mission objects
 * @returns {Object} Exportable data object
 */
export const exportMissions = (missions) => {
    return {
        version: "1.0",
        type: "wro-missions",
        timestamp: Date.now(),
        missions: missions.map(m => ({
            id: m.id,
            x: m.x,
            y: m.y,
            size: m.size,
            color: m.color,
            shape: m.shape,
            label: m.label || '',
            rotation: m.rotation || 0,
            opacity: m.opacity || 0.7
        }))
    };
};

/**
 * Import missions from JSON data
 * @param {Object} data - Imported data object
 * @returns {Array} Array of mission objects
 */
export const importMissions = (data) => {
    if (!data.missions || !Array.isArray(data.missions)) {
        throw new Error("Formato de archivo inválido: no se encontró la lista de misiones.");
    }

    return data.missions.map(m => ({
        id: m.id || uid('mission'),
        x: m.x,
        y: m.y,
        size: m.size || 40,
        color: m.color || MISSION_COLORS[0],
        shape: m.shape || MISSION_SHAPES.CIRCLE,
        label: m.label || '',
        rotation: m.rotation || 0,
        opacity: m.opacity || 0.7
    }));
};
