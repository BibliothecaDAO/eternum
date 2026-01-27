# PRD: Player Indicator Dots Above Units

## Overview

**Feature:** Add colored indicator dots above units in the 3D world to show player ownership

**Status:** Phase 1 - In Progress

**Owner:** Three.js Team

**Created:** 2026-01-13

**Last Updated:** 2026-01-13

## Problem Statement

Units in the three.js world previously had colored bases (the "stand" material) to indicate player ownership. The base
has been removed from unit models, making it difficult for players to distinguish which units belong to which player
during gameplay.

## Goals

### Primary Goals

- Provide clear visual indication of unit ownership in the 3D world
- Maintain performance with 1000+ unit instances
- Integrate seamlessly with existing player color system
- Follow established three.js architecture patterns

### Non-Goals

- Replace or modify existing minimap indicators
- Add interactive functionality to dots (clickable, hoverable)
- Support for non-unit entities (buildings, structures)

## Success Metrics

| Metric             | Target                                    | Method                |
| ------------------ | ----------------------------------------- | --------------------- |
| Performance Impact | <5% FPS drop with 1000 units              | Performance profiling |
| Visual Clarity     | 95%+ player color accuracy                | Visual inspection     |
| Memory Usage       | <15KB for 1000 instances                  | Memory profiling      |
| Code Quality       | TypeScript strict mode, no linting errors | Automated checks      |

## Technical Architecture

### System Design

```
Scene
  └─ Model Groups (per ModelType)
      ├─ InstancedMesh[] (unit meshes)
      └─ InstancedMesh (contact shadows)
  └─ PlayerIndicatorMesh (NEW)
      └─ InstancedMesh
          ├─ instanceMatrix (positions)
          └─ instanceColor (player colors)
```

### Key Components

#### 1. PlayerIndicatorManager

- **File:** `client/apps/game/src/three/managers/player-indicator-manager.ts`
- **Responsibility:** Manage lifecycle of indicator dots
- **Pattern:** InstancedMesh for batch rendering
- **Capacity:** 1000 instances (MAX_INSTANCES)

#### 2. Integration Points

- **ArmyManager:** Add/update/remove indicator calls
- **PlayerColorManager:** Reuse existing color profiles
- **Constants:** Y-offset configuration per model type

### Data Flow

```
User Action (Unit Created/Moved)
  ↓
ArmyManager.addModel() / updateArmyPosition()
  ↓
armyModel.updateInstance() → Unit rendered
  ↓
playerIndicatorManager.updateIndicator() → Dot rendered
  ↓
InstancedMesh matrices and colors updated
```

## Requirements

### Functional Requirements

| ID    | Requirement                                                         | Priority | Status  |
| ----- | ------------------------------------------------------------------- | -------- | ------- |
| FR-1  | Display colored dot above each unit                                 | P0       | Phase 1 |
| FR-2  | Use player color from PlayerColorManager                            | P0       | Phase 1 |
| FR-3  | Update dot position when unit moves                                 | P0       | Phase 1 |
| FR-4  | Remove dot when unit is destroyed                                   | P0       | Phase 1 |
| FR-5  | Support all unit types (Knight, Crossbowman, Paladin, Boat, Agents) | P0       | Phase 1 |
| FR-6  | Adjust Y-offset based on unit model height                          | P1       | Phase 1 |
| FR-7  | Hide dots when units are not visible (culling)                      | P1       | Phase 2 |
| FR-8  | User setting to enable/disable indicators                           | P2       | Phase 2 |
| FR-9  | User setting to adjust size and opacity                             | P2       | Phase 2 |
| FR-10 | Handle overlapping dots for stacked armies                          | P2       | Phase 2 |

### Non-Functional Requirements

| ID    | Requirement                                         | Priority | Status  |
| ----- | --------------------------------------------------- | -------- | ------- |
| NFR-1 | Performance: <5% FPS impact with 1000 units         | P0       | Phase 1 |
| NFR-2 | Memory: <15KB additional memory for indicators      | P0       | Phase 1 |
| NFR-3 | Render order: Dots render after units but before UI | P0       | Phase 1 |
| NFR-4 | Code follows existing TypeScript/Three.js patterns  | P0       | Phase 1 |
| NFR-5 | Proper resource disposal on cleanup                 | P0       | Phase 1 |

## Visual Design

### Indicator Specifications

| Property     | Value                      | Rationale                                    |
| ------------ | -------------------------- | -------------------------------------------- |
| Geometry     | Sphere (8×6 segments)      | Low-poly for performance, recognizable shape |
| Size         | 0.4 world units diameter   | Visible but not obtrusive                    |
| Material     | MeshBasicMaterial          | Unlit, always visible, no shadow computation |
| Opacity      | 0.9                        | Slightly transparent to blend naturally      |
| Color        | PlayerColorProfile.primary | Consistent with player color system          |
| Position     | Unit position + Y-offset   | Floats above unit bounding box               |
| Depth Test   | Enabled                    | Occludes behind terrain/buildings            |
| Render Order | 10                         | After units (0), before UI (100+)            |

### Y-Offset Configuration

| Unit Type      | Y-Offset | Notes                |
| -------------- | -------- | -------------------- |
| Knight T1      | 2.5      | Standard height      |
| Knight T2      | 2.7      | Slightly taller      |
| Knight T3      | 2.9      | Tallest knight       |
| Crossbowman T1 | 2.3      | Shorter stance       |
| Crossbowman T2 | 2.5      | Standard height      |
| Crossbowman T3 | 2.7      | Taller with gear     |
| Paladin T1     | 2.8      | Large armor          |
| Paladin T2     | 3.0      | Larger armor         |
| Paladin T3     | 3.2      | Largest model        |
| Boat           | 2.0      | Low profile on water |
| Agent Models   | 2.5      | Standard AI agents   |

## Implementation Plan

### Phase 1: Core Implementation (MVP) ✅ IN PROGRESS

**Goal:** Basic functional indicator dots with player colors

**Tasks:**

- [x] Create PRD document
- [ ] Create `PlayerIndicatorManager` class
  - [ ] InstancedMesh setup with sphere geometry
  - [ ] updateIndicator() method
  - [ ] removeIndicator() method
  - [ ] dispose() method
- [ ] Create `indicator-constants.ts` with Y-offsets
- [ ] Integrate with `ArmyManager`
  - [ ] Import and instantiate PlayerIndicatorManager
  - [ ] Call updateIndicator() in addModel()
  - [ ] Call updateIndicator() in updateArmyPosition()
  - [ ] Call removeIndicator() in deleteModel()
  - [ ] Call dispose() in dispose()
- [ ] Visual testing
  - [ ] Test all player types (self, ally, enemy, neutral, AI)
  - [ ] Test all unit types (Knight, Crossbowman, Paladin, T1-T3)
  - [ ] Test boat models
  - [ ] Verify colors match PlayerColorManager

**Acceptance Criteria:**

- ✅ Colored dots visible above all units
- ✅ Correct player colors displayed
- ✅ Dots follow units during movement
- ✅ Dots removed when units destroyed
- ✅ Performance impact <5%

**Estimated Effort:** 4-6 hours

**Target Date:** 2026-01-14

### Phase 2: Polish & Optimization

**Goal:** Add user settings and performance optimizations

**Tasks:**

- [ ] Implement LOD system
  - [ ] Hide indicators beyond certain camera distance
  - [ ] Scale indicators based on zoom level
- [ ] Add settings UI
  - [ ] Enable/disable toggle
  - [ ] Size slider (0.5-1.0)
  - [ ] Opacity slider (0.5-1.0)
- [ ] Handle overlapping indicators
  - [ ] Detect stacked armies on same hex
  - [ ] Offset dots in circle pattern
- [ ] Performance profiling
  - [ ] Measure FPS impact
  - [ ] Optimize update frequency
  - [ ] Add dirty flags for batch updates
- [ ] Comprehensive testing
  - [ ] Edge case scenarios
  - [ ] Memory leak testing
  - [ ] 1000 unit stress test

**Acceptance Criteria:**

- ✅ User can customize indicator appearance
- ✅ Indicators scale appropriately with camera
- ✅ No overlapping dots for stacked armies
- ✅ Performance optimized (<2% FPS impact)

**Estimated Effort:** 3-4 hours

**Target Date:** TBD

### Phase 3: Future Enhancements (Optional)

**Goal:** Advanced features for improved UX

**Potential Features:**

- Billboard orientation (always face camera)
- Bounding box height auto-calculation
- Pulse/glow effects for selected units
- Different shapes for different unit types (circle for Knight, square for Crossbowman, etc.)
- Minimap integration sync

**Status:** Not scheduled

## Technical Specifications

### File Structure

```
client/apps/game/src/three/
├── managers/
│   ├── army-manager.ts (MODIFIED)
│   └── player-indicator-manager.ts (NEW)
├── constants/
│   └── indicator-constants.ts (NEW)
└── docs/
    └── player-indicator-dots-prd.md (THIS FILE)
```

### API Surface

#### PlayerIndicatorManager

```typescript
class PlayerIndicatorManager {
  constructor(scene: THREE.Scene, capacity: number);

  public updateIndicator(entityId: ID, position: Vector3, color: Color, yOffset: number): void;

  public removeIndicator(entityId: ID): void;

  public setEnabled(enabled: boolean): void;

  public setSize(size: number): void;

  public setOpacity(opacity: number): void;

  public dispose(): void;
}
```

#### Constants

```typescript
export const INDICATOR_SIZE = 0.4;
export const INDICATOR_OPACITY = 0.9;
export const INDICATOR_RENDER_ORDER = 10;

export const INDICATOR_Y_OFFSETS: Record<ModelType, number> = {
  // ... all model types
};
```

### Performance Budget

| Resource     | Budget           | Current | Notes                         |
| ------------ | ---------------- | ------- | ----------------------------- |
| Draw Calls   | +1               | TBD     | Single InstancedMesh          |
| Triangles    | +84 per instance | TBD     | 8×6 sphere geometry           |
| Memory       | <15KB            | TBD     | Matrix + color buffers        |
| CPU (update) | <1ms per frame   | TBD     | Only on position/color change |
| FPS Impact   | <5%              | TBD     | With 1000 units               |

## Testing Strategy

### Visual Testing Checklist

- [ ] Self units show bright green dots
- [ ] Ally units show sky blue dots
- [ ] Enemy units show distinct colored dots (16+ colors)
- [ ] Neutral units show gray dots
- [ ] AI agent units show gold/amber dots
- [ ] Dots positioned correctly above all unit types
- [ ] Dots follow units during movement
- [ ] Dots occlude behind terrain/buildings
- [ ] Dots visible at normal gameplay distances
- [ ] No z-fighting or rendering artifacts

### Performance Testing Checklist

- [ ] Measure baseline FPS (no indicators)
- [ ] Measure FPS with 100 units + indicators
- [ ] Measure FPS with 500 units + indicators
- [ ] Measure FPS with 1000 units + indicators
- [ ] Profile memory usage over 10 minute session
- [ ] Test for memory leaks (create/destroy 1000 units)
- [ ] Profile update frequency and duration
- [ ] Verify batch updates working correctly

### Edge Case Testing Checklist

- [ ] Units at hex boundaries
- [ ] Units with custom cosmetic skins
- [ ] Rapid army creation/deletion
- [ ] Camera zoom: far view
- [ ] Camera zoom: close view
- [ ] Different screen resolutions (1920×1080, 2560×1440, 3840×2160)
- [ ] Multiple units on same hex
- [ ] Units transitioning between biomes (land to ocean)

## Dependencies

### External Dependencies

- Three.js (already in project)
- PlayerColorManager (existing system)
- ArmyManager (existing system)

### Internal Dependencies

- `@bibliothecadao/types` - TroopType, TroopTier, ModelType
- `client/apps/game/src/three/types/army.ts` - Type definitions
- `client/apps/game/src/three/systems/player-colors.ts` - Color profiles
- `client/apps/game/src/three/constants/army-constants.ts` - MAX_INSTANCES

## Risks & Mitigations

| Risk                                            | Impact | Probability | Mitigation                                           |
| ----------------------------------------------- | ------ | ----------- | ---------------------------------------------------- |
| Performance degradation with 1000+ units        | High   | Medium      | Use InstancedMesh, batch updates, dirty flags        |
| Indicators not visible at certain camera angles | Medium | Low         | Test multiple camera distances, adjust size          |
| Color confusion with existing UI elements       | Medium | Low         | Use distinct render order, test with actual gameplay |
| Z-fighting with terrain                         | Low    | Low         | Proper depth testing, adjust Y-offset                |
| Memory leaks from improper cleanup              | High   | Low         | Comprehensive dispose() implementation, testing      |

## Open Questions

- [x] Should indicators pulse or glow for selected units? → **No, Phase 1 keeps it simple**
- [x] Should indicators have different shapes for different unit types? → **No, Phase 3 feature**
- [ ] Should indicators be visible on the minimap as well? → **TBD**
- [ ] Should indicators scale with camera distance or stay constant size? → **TBD, test in Phase 1**
- [ ] What should happen when 10+ units are stacked on the same hex? → **Phase 2 feature**

## Alternatives Considered

### Alternative 1: CSS2D Labels

**Rejected** - Poor performance with 1000+ labels, doesn't integrate well with 3D depth

### Alternative 2: Sprite Textures

**Considered** - Simpler than geometry, but requires texture atlas and custom color shader

### Alternative 3: Shader-Based Procedural Dots

**Future** - Maximum performance, but more complex to implement and debug

### Alternative 4: Modify Existing Selection System

**Rejected** - Selection system is for user interaction, not persistent indicators

## References

### Code References

- `client/apps/game/src/three/managers/army-manager.ts` - Unit lifecycle management
- `client/apps/game/src/three/managers/army-model.ts` - Unit rendering with InstancedMesh
- `client/apps/game/src/three/systems/player-colors.ts` - Player color profiles
- `client/apps/game/src/three/managers/selection-pulse-manager.ts` - Precedent for scene indicators

### Documentation

- Three.js InstancedMesh: https://threejs.org/docs/#api/en/objects/InstancedMesh
- Three.js BufferGeometry: https://threejs.org/docs/#api/en/core/BufferGeometry

## Changelog

| Date       | Version | Changes                        | Author |
| ---------- | ------- | ------------------------------ | ------ |
| 2026-01-13 | 0.1     | Initial PRD creation           | Claude |
| 2026-01-13 | 0.2     | Started Phase 1 implementation | Claude |

## Appendix

### Color System Reference

**PlayerColorProfile Structure:**

```typescript
interface PlayerColorProfile {
  playerId: string;
  primary: Color; // Used for indicator dots
  secondary: Color;
  minimap: Color;
  selection: Color;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  lightnessVariant: number;
  patternIndex: number;
}
```

**Player Type Colors:**

- Self: #4ADE80 (bright green)
- Ally: #60A5FA (sky blue)
- AI Agent: #FBBF24 (gold/amber)
- Neutral: #9CA3AF (gray)
- Enemy: 16 distinct hues × 3 lightness variants × patterns

### ModelType Reference

Available model types (from `army.ts`):

- Knight1, Knight2, Knight3
- Crossbowman1, Crossbowman2, Crossbowman3
- Paladin1, Paladin2, Paladin3
- Boat
- AgentApix, AgentElisa, AgentIstarai, AgentYP
