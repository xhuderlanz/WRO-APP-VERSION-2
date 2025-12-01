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

export const DEFAULT_GRID = { cellSize: 1, pixelsPerUnit: 5, lineAlpha: 0.35, offsetX: 0, offsetY: 0, color: "#000000" };
export const DEFAULT_ROBOT = { width: 18, length: 20, color: "#0ea5e9", imageSrc: null, opacity: 1 };
export const ZOOM_LIMITS = { min: 0.5, max: 2, step: 0.25 };
export const SNAP_45_BASE_ANGLES = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
