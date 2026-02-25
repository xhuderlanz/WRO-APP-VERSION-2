# WRO Path Planner - Cleanup Audit Report

> **Generated:** 2026-01-20  
> **Architecture:** Stateless / Rubber-Band  
> **Audit Scope:** `src/wro-planner/` directory

---

## Executive Summary

| Category | Count | Action |
|----------|-------|--------|
| ✅ **KEEP** (Active) | 17 files | No action needed |
| ⚠️ **REFACTOR** (Mixed) | 2 files | Remove legacy imports/code |
| 🗑️ **DELETE** (Dead/Legacy) | 6 items | Safe to delete |

---

## Detailed File Audit

### 📁 `src/wro-planner/` (Root)

| File | Status | Reasoning | Action |
|------|--------|-----------|--------|
| `WROPlaybackPlanner.jsx` | ✅ KEEP | Core controller with `sections` state and `useMemo` routing. | None |
| `CanvasBoard.jsx` | ✅ KEEP | Core renderer. ✅ *Cleaned:* Removed legacy fallback code and unused imports. | None |
| `SectionsPanel.jsx` | ✅ KEEP | Active UI: Section list management with add/delete/select. | None |
| `SectionsPanel.css` | ✅ KEEP | Active styles for SectionsPanel. | None |
| `WaypointsPanel.jsx` | ✅ KEEP | Active UI: Displays calculated instructions grouped by section. | None |
| `WaypointsPanel.css` | ✅ KEEP | Active styles for WaypointsPanel. | None |
| `TopBar.jsx` | ✅ KEEP | Active UI: Toolbar with playback controls and actions. | None |
| `TopBar.css` | ✅ KEEP | Active styles for TopBar. | None |
| `OptionsPanel.jsx` | ✅ KEEP | Active UI: Settings panel (grid, robot size, units). | None |
| `ShortcutsModal.jsx` | ✅ KEEP | Active UI: Keyboard shortcuts help modal. | None |
| `ShortcutsModal.css` | ✅ KEEP | Active styles for ShortcutsModal. | None |
| `icons.jsx` | ✅ KEEP | Active: SVG icon components used throughout UI. | None |

---

### 📁 `src/wro-planner/domain/`

| File | Status | Reasoning | Action |
|------|--------|-----------|--------|
| `pathCalculator.js` | ✅ KEEP | **CORE**: Stateless route calculation - the heart of new architecture. | None |
| `pathCalculator.test.js` | ✅ KEEP | Unit tests for pathCalculator (32 tests). | None |
| `geometry.js` | ✅ KEEP | Active math utilities used by CanvasBoard and WROPlaybackPlanner. | None |
| `playback.js` | ✅ KEEP | Active: `usePlayback` hook for animation primitives. | None |
| `constants.js` | ✅ KEEP | Active: Field presets, defaults, unit conversions. | None |
| `robotConfigStorage.js` | ✅ KEEP | Active: LocalStorage persistence for robot config. | None |
| `sections_stable.js` | ✅ KEEP | **ACTIVE**: Recalculates `actions[]` from points. Used by WROPlaybackPlanner and CanvasBoard. | None |
| `sections.js` | 🗑️ DELETE | **DEAD CODE**: Legacy recalc logic. Marked as "LEGACY" in file. Never imported. | Delete file |
| `sections_v2.js` | 🗑️ DELETE | **DEAD CODE**: Experimental V2 section logic. Never imported anywhere. | Delete file |
| `sections_v3.js` | 🗑️ DELETE | **DEAD CODE**: Experimental V3 section logic. Never imported anywhere. | Delete file |

---

### 📁 `src/wro-planner/domain/collision/`

| Item | Status | Reasoning | Action |
|------|--------|-----------|--------|
| `collision/` (empty directory) | 🗑️ DELETE | **EMPTY**: Placeholder directory with no files. No collision detection implemented. | Delete directory |

---

### 📁 `src/wro-planner/domain/history/`

| File | Status | Reasoning | Action |
|------|--------|-----------|--------|
| `useHistory.js` | 🗑️ DELETE | **DEAD CODE**: Undo/redo hook that is never imported or used anywhere. | Delete file + directory |

---

### 📁 `src/wro-planner/components/`

| File | Status | Reasoning | Action |
|------|--------|-----------|--------|
| `RobotSizeModal.jsx` | ✅ KEEP | Active: Modal for configuring robot dimensions. Imported by WROPlaybackPlanner. | None |
| `RobotSizePreview.jsx` | ✅ KEEP | Active: Visual preview used inside RobotSizeModal. | None |

---

### 📁 `src/wro-planner/hooks/`

| File | Status | Reasoning | Action |
|------|--------|-----------|--------|
| `useBreakpoint.js` | ✅ KEEP | Active: Responsive breakpoint hook used by TopBar. | None |

---

## Refactor Details

### Refactor: `WROPlaybackPlanner.jsx`

**Location:** Lines 41-51

**Current imports from `geometry.js`:**
```javascript
import {
    normalizeAngle,
    getReferencePoint,
    computePoseUpToSection,
    getLastPoseOfSection,
    buildReversePlayback,
    buildActionsFromPolyline,
    pointsFromActions,
    projectPointWithReference,
    getPoseAfterActions
} from "./domain/geometry";
```

**Analysis:**
Several of these are used for legacy section-by-section pose calculation. In the stateless architecture, `pathCalculator.js` handles all route derivation. However, these are still used for:
- `computePoseUpToSection`: Still needed for section playback start pose
- `getPoseAfterActions`: Still needed for reverse playback end pose calculation
- `getLastPoseOfSection`: Used in CanvasBoard for ghost drawing

**Verdict:** Most imports are still actively used. No immediate refactoring required here.

---

### Refactor: `CanvasBoard.jsx`

**Location 1:** Line 3 (Imports)
```javascript
import { normalizeAngle, getReferencePoint, getLastPoseOfSection, projectPointWithReference, pointsFromActions, buildActionsFromPolyline, computePoseUpToSection } from "./domain/geometry";
```

**Potentially unused imports:**
- `buildActionsFromPolyline` - No longer used (removed with sections_stable refactor)
- `pointsFromActions` - No longer used (removed with sections_stable refactor)

**Location 2:** Lines 528-585 (Legacy Fallback Drawing)

```javascript
} else {
    // FALLBACK: Legacy path drawing from sections (for backwards compatibility)
    sections.forEach(s => {
        // ... legacy drawing code
    });
}
```

This entire `else` block is legacy fallback that should NEVER execute in the new architecture (since `calculatedPathSegments` is always provided). It can be deleted.

**Action Items:**
1. Remove unused imports: `buildActionsFromPolyline`, `pointsFromActions`
2. Delete legacy fallback block (lines 528-585)

---

## Deletion Commands

```powershell
# Delete legacy section files
Remove-Item "src/wro-planner/domain/sections.js"
Remove-Item "src/wro-planner/domain/sections_v2.js"
Remove-Item "src/wro-planner/domain/sections_v3.js"

# Delete unused history hook and directory
Remove-Item "src/wro-planner/domain/history" -Recurse

# Delete empty collision directory
Remove-Item "src/wro-planner/domain/collision" -Recurse
```

---

## Risk Assessment

| Delete Target | Risk | Mitigation |
|---------------|------|------------|
| `sections.js`, `sections_v2.js`, `sections_v3.js` | ⚪ LOW | Not imported anywhere. Build will confirm. |
| `useHistory.js` + `history/` dir | ⚪ LOW | Not imported anywhere. Future undo/redo can be reimplemented. |
| `collision/` dir | ⚪ LOW | Empty directory, no impact. |
| Legacy fallback in CanvasBoard | 🟡 MEDIUM | Ensure `calculatedPathSegments` prop is ALWAYS passed. Test drawing after removal. |

---

## Post-Cleanup Verification

After deletions:

1. **Build Check:**
   ```bash
   npm run build
   ```
   Should complete without errors.

2. **Manual Testing:**
   - Draw points on canvas
   - Delete waypoints
   - Play mission
   - Toggle reverse direction

---

## Summary of Actions

### Phase 1: Safe Deletions (Low Risk)

| Item | Type | Action |
|------|------|--------|
| `domain/sections.js` | File | DELETE |
| `domain/sections_v2.js` | File | DELETE |
| `domain/sections_v3.js` | File | DELETE |
| `domain/history/useHistory.js` | File | DELETE |
| `domain/history/` | Directory | DELETE |
| `domain/collision/` | Directory | DELETE |

### Phase 2: Code Cleanup (Medium Risk)

| Item | Type | Action |
|------|------|--------|
| `CanvasBoard.jsx` L3 | Import | Remove `buildActionsFromPolyline`, `pointsFromActions` |
| `CanvasBoard.jsx` L528-585 | Code Block | Delete legacy fallback drawing |
