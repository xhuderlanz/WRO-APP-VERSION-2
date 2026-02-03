import juniorFieldImg from "../../assets/WRO-2025-GameMat-Junior2025.jpg";
import elementaryFieldImg from "../../assets/WRO-2025-GameMat-Elementary2025.jpg";
import doubleTennisFieldImg from "../../assets/WRO-2025_RoboSports_Double-Tennis_Playfield.jpg";

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;
export const MAT_MM = { w: 2362, h: 1143 };
export const MAT_CM = { w: MAT_MM.w / 10, h: MAT_MM.h / 10 };

export const FIELD_PRESETS = [
    { key: "junior", name: "RoboMission Junior 2025", bg: juniorFieldImg },
    { key: "elementary", name: "RoboMission Elementary 2025", bg: elementaryFieldImg },
    { key: "double-tennis", name: "RoboSports Double Tennis 2025", bg: doubleTennisFieldImg },
    { key: "custom", name: "Personalizado", bg: null },
];

export const DEFAULT_GRID = { cellSize: 1, pixelsPerUnit: 5, lineAlpha: 0.35, offsetX: 0, offsetY: 0, color: "#ffffff" };
export const DEFAULT_ROBOT = { width: 18, length: 20, color: "#0ea5e9", imageSrc: null, opacity: 1, wheelOffset: 10 };
export const ZOOM_LIMITS = { min: 0.5, max: 2, step: 0.25 };
export const SNAP_45_BASE_ANGLES = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];

/**
 * Convert a point from mm (tapete coordinates) to canvas pixels.
 * Uses canvas size so the path scales correctly when the canvas resizes.
 */
export function mmToPxPoint(xMm, yMm, canvasWidth, canvasHeight) {
    if (!canvasWidth || !canvasHeight) return { x: 0, y: 0 };
    const scaleX = canvasWidth / MAT_MM.w;
    const scaleY = canvasHeight / MAT_MM.h;
    return { x: xMm * scaleX, y: yMm * scaleY };
}

/**
 * Convert a point from canvas pixels to mm (tapete coordinates).
 */
export function pxToMmPoint(xPx, yPx, canvasWidth, canvasHeight) {
    if (!canvasWidth || !canvasHeight) return { x: 0, y: 0 };
    const scaleX = canvasWidth / MAT_MM.w;
    const scaleY = canvasHeight / MAT_MM.h;
    return { x: xPx / scaleX, y: yPx / scaleY };
}

/**
 * Convert all section points from mm to px (for a given canvas size).
 */
export function mmToPxSections(sections, canvasWidth, canvasHeight) {
    if (!canvasWidth || !canvasHeight) return sections;
    return sections.map(s => ({
        ...s,
        points: s.points.map(p => {
            const px = mmToPxPoint(p.x, p.y, canvasWidth, canvasHeight);
            return { ...p, x: px.x, y: px.y };
        })
    }));
}

/**
 * Convert all section points from px to mm (for a given canvas size).
 */
export function pxToMmSections(sections, canvasWidth, canvasHeight) {
    if (!canvasWidth || !canvasHeight) return sections;
    return sections.map(s => ({
        ...s,
        points: s.points.map(p => {
            const mm = pxToMmPoint(p.x, p.y, canvasWidth, canvasHeight);
            return { ...p, x: mm.x, y: mm.y };
        })
    }));
}
