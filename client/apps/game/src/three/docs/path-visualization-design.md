# Path Visualization System Design
## Technical Proposal for Troop Movement in Eternum

---

## 1. User-Facing Behavior Spec

### When Paths Are Shown

| Trigger | Path Visibility | Notes |
|---------|-----------------|-------|
| **Hover over own army** | Preview destination (if moving) | Subtle, low opacity |
| **Select own army** | Full path + destination marker | Primary use case |
| **Active movement** | Animated flow along path | Progress indicator |
| **Hover destination while army selected** | Proposed path preview | Dashed, "hypothetical" style |
| **Enemy army (moving)** | Destination marker only | No full path (fog of war) |

### What Must Be Shown

| Element | Required | Notes |
|---------|----------|-------|
| Full path polyline | Yes | Screen-space thickness, zoom-stable |
| Destination marker | Yes | Pulsing ring at end hex |
| Direction of travel | Yes | Animated flow texture (arrows/dashes) |
| Progress along path | Optional | Subtle highlight at army head position |
| Origin marker | No | Army position serves this role |

### Path Characteristics

- **Grid-based**: Paths follow hex centers (not continuous bezier)
- **Overlapping**: Yes, multiple armies can share path segments
- **Dynamic rerouting**: Rare (only on blocked hex detection)
- **Max path length**: ~100 hexes (stamina-limited)
- **Max concurrent visible paths**: ~20 (typical), ~50 (stress case)

---

## 2. Path Data Model

### Current Data Flow (from codebase analysis)

```
gameWorkerManager.findPath(start, end, maxHex)
         ↓
    Position[] (hex coords)
         ↓
    getWorldPositionForHex() per node
         ↓
    Vector3[] stored in armyPaths Map
```

### Proposed Path Data Structure

```typescript
interface PathSegment {
  start: Vector3;      // World space
  end: Vector3;        // World space
  direction: Vector3;  // Normalized (end - start)
  length: number;      // Segment length in world units
}

interface ArmyPath {
  entityId: number;
  segments: PathSegment[];
  totalLength: number;

  // Rendering state
  ownerType: 'self' | 'ally' | 'enemy';
  displayState: 'selected' | 'hover' | 'moving' | 'preview';
  progress: number;           // 0-1, current position along path

  // Color (computed from owner)
  color: Color;

  // Cached bounds for culling
  boundingBox: Box3;
}

interface PathInstanceData {
  // Per-segment instance attributes (Float32Array)
  startPositions: Float32Array;  // vec3 × segmentCount
  endPositions: Float32Array;    // vec3 × segmentCount
  segmentLengths: Float32Array;  // float × segmentCount
  pathProgress: Float32Array;    // float × segmentCount (cumulative)
  colors: Float32Array;          // vec3 × segmentCount
  opacities: Float32Array;       // float × segmentCount
}
```

### Path Computation Stability

- **Deterministic**: A* with consistent tie-breaking
- **Recomputation**: Only on:
  - New destination set
  - Blocked hex detected mid-movement
  - Stamina refill (rare path extension)
- **Update frequency**: ~0.1 Hz average (path changes are infrequent)

---

## 3. Rendering Strategy

### Chosen Approach: Instanced Polyline Segments

**Approach**: Each path segment = instanced quad aligned to segment direction

```
Path: A → B → C → D
Segments: [A-B], [B-C], [C-D]
Each segment = 1 instanced quad
```

| Pros | Cons |
|------|------|
| Single draw call for ALL paths | Quad corners need shader computation |
| CPU updates only on path change | Slight complexity in miter joins |
| Easy per-segment coloring | |
| Works naturally with chunks | |
| Proven pattern (see Three.js Line2) | |

**Draw calls**: 1 (all segments batched)
**Memory**: ~128 bytes per segment
**Max segments**: 5000 (supports 50 paths × 100 segments)

### Why Not Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| GPU Path Texture | Over-engineered, resolution issues |
| SDF Path Ribbon | Too expensive for dynamic paths |
| THREE.Line | More draw calls, less control |

---

## 4. Shader Design

### Geometry: Instanced Quad Ribbon

Each segment is a quad expanded perpendicular to the camera in the vertex shader.

```
Segment A→B:

    [0]────────[1]    ← vertices 0,1 at position A
     │          │
     │  QUAD    │     ← width computed in screen space
     │          │
    [2]────────[3]    ← vertices 2,3 at position B
```

### Vertex Shader

```glsl
// === ATTRIBUTES (per-vertex) ===
attribute vec2 uv;              // (0,0), (1,0), (0,1), (1,1)

// === INSTANCE ATTRIBUTES (per-segment) ===
attribute vec3 instanceStart;   // Segment start position (world)
attribute vec3 instanceEnd;     // Segment end position (world)
attribute float instanceLength; // Segment length (world units)
attribute float instancePathProgress; // 0-1 cumulative progress along full path
attribute vec3 instanceColor;   // RGB color
attribute float instanceOpacity;// Alpha

// === UNIFORMS ===
uniform float time;
uniform float thickness;        // Base thickness in pixels
uniform float zoomFactor;       // Camera distance / reference distance
uniform vec2 resolution;        // Screen resolution
uniform float armyProgress;     // 0-1, how far army has traveled

// === VARYINGS ===
varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;
varying float vSegmentProgress; // For animated flow
varying float vArmyProgress;    // For progress highlight

#include <common>
#include <logdepthbuf_pars_vertex>

void main() {
    // Interpolate position along segment based on UV.y
    vec3 worldPos = mix(instanceStart, instanceEnd, uv.y);

    // Project start and end to screen space
    vec4 clipStart = projectionMatrix * modelViewMatrix * vec4(instanceStart, 1.0);
    vec4 clipEnd = projectionMatrix * modelViewMatrix * vec4(instanceEnd, 1.0);

    vec2 screenStart = clipStart.xy / clipStart.w;
    vec2 screenEnd = clipEnd.xy / clipEnd.w;

    // Direction in screen space
    vec2 screenDir = normalize(screenEnd - screenStart);
    vec2 screenNormal = vec2(-screenDir.y, screenDir.x);

    // Project current position
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);

    // Offset perpendicular to line direction (screen space)
    // UV.x: 0 = left edge, 1 = right edge
    float side = uv.x * 2.0 - 1.0; // -1 or +1
    float screenThickness = thickness / resolution.y; // Normalize to clip space

    // Apply thickness (constant screen-space width)
    clipPos.xy += screenNormal * side * screenThickness * clipPos.w;

    gl_Position = clipPos;

    // Pass to fragment
    vUv = uv;
    vColor = instanceColor;
    vOpacity = instanceOpacity;
    vSegmentProgress = instancePathProgress + uv.y * (instanceLength / 100.0);
    vArmyProgress = armyProgress;

    #include <logdepthbuf_vertex>
}
```

### Fragment Shader

```glsl
uniform float time;
uniform float dashScale;        // Dashes per world unit
uniform float flowSpeed;        // Animation speed
uniform float fadeNearCamera;   // Distance to start fading
uniform float fadeAtEnd;        // Fade at path endpoints

varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;
varying float vSegmentProgress;
varying float vArmyProgress;

#include <common>
#include <logdepthbuf_pars_fragment>

void main() {
    #include <logdepthbuf_fragment>

    // === DASHED LINE ===
    float dashPhase = vSegmentProgress * dashScale - time * flowSpeed;
    float dash = smoothstep(0.4, 0.5, fract(dashPhase));

    // === SOFT EDGES ===
    float distFromCenter = abs(vUv.x - 0.5) * 2.0;
    float edgeAA = 1.0 - smoothstep(0.7, 1.0, distFromCenter);

    // === PROGRESS HIGHLIGHT ===
    float progressDist = abs(vSegmentProgress - vArmyProgress);
    float progressHighlight = 1.0 + 0.5 * (1.0 - smoothstep(0.0, 0.05, progressDist));

    // === ENDPOINT FADE ===
    float endFade = smoothstep(0.0, 0.02, vSegmentProgress) *
                    smoothstep(1.0, 0.98, vSegmentProgress);

    // === COMBINE ===
    vec3 finalColor = vColor * progressHighlight;
    float finalAlpha = vOpacity * dash * edgeAA * endFade;

    if (finalAlpha < 0.01) discard;

    gl_FragColor = vec4(finalColor, finalAlpha);
}
```

### Uniforms Summary

| Uniform | Type | Update Frequency | Source |
|---------|------|------------------|--------|
| `time` | float | Every frame | `clock.getElapsedTime()` |
| `thickness` | float | On zoom change | 3.0 (pixels) |
| `resolution` | vec2 | On resize | `renderer.getSize()` |
| `armyProgress` | float | Every frame (if moving) | Movement system |
| `dashScale` | float | Static | 8.0 |
| `flowSpeed` | float | Static | 2.0 |

---

## 5. Chunking & Lifecycle Integration

### Path-Chunk Relationship

Paths are **NOT** attached to chunks. Instead:

```
PathRenderer (singleton)
    └── InstancedMesh (one mesh for ALL paths)
          └── instanceAttributes (all segments)
```

**Rationale**: Paths span chunk boundaries. Attaching to chunks would create seams.

### Visibility & Culling

```typescript
class PathRenderer {
  private visibilityManager = CentralizedVisibilityManager.getInstance();

  updateVisibility() {
    for (const [entityId, path] of this.activePaths) {
      const visible = this.visibilityManager.isBoxInFrustum(path.boundingBox);

      if (!visible) {
        this.setPathOpacity(entityId, 0);
      } else {
        this.setPathOpacity(entityId, path.baseOpacity);
      }
    }
  }
}
```

### Lifecycle Hooks

```typescript
// In ArmyManager.moveArmy()
const worldPath = pathPositions.map(p => getWorldPositionForHex(p));
pathRenderer.createPath(entityId, worldPath, ownerType);

// In ArmyModel.updateMovements() - progress update
pathRenderer.updateProgress(entityId, currentProgress);

// On movement complete
pathRenderer.removePath(entityId);
```

---

## 6. Performance Budget

### Target Metrics

| Metric | Budget | Notes |
|--------|--------|-------|
| Draw calls | 1-2 | 1 for paths, 1 for destination markers |
| Max instances | 5000 segments | ~50 paths × 100 segments |
| Instance buffer size | 640 KB | 5000 × 128 bytes |
| CPU update/frame | <0.5 ms | Only time uniform + progress |
| GPU time | <1 ms | Simple shader, low overdraw |

### Memory Layout (SoA)

```typescript
class PathInstanceBuffer {
  readonly startPositions: Float32Array;  // 5000 × 3 = 60 KB
  readonly endPositions: Float32Array;    // 5000 × 3 = 60 KB
  readonly lengths: Float32Array;         // 5000 × 1 = 20 KB
  readonly pathProgress: Float32Array;    // 5000 × 1 = 20 KB
  readonly colors: Float32Array;          // 5000 × 3 = 60 KB
  readonly opacities: Float32Array;       // 5000 × 1 = 20 KB
}
```

---

## 7. Quality Tiers

| Feature | HIGH/MID | LOW |
|---------|----------|-----|
| Rendering | Instanced quads | THREE.Line |
| Draw calls | 1 | 1 per path |
| Animation | Flowing dashes | Static |
| Anti-aliasing | Shader-based | Native line AA |
| Thickness | Screen-space constant | 1px native |

---

## 8. Implementation Phases

### Phase 1: MVP (Core Functionality)

1. **PathRenderer class** - singleton, manages instance buffer
2. **Basic instanced quad geometry** - 4 vertices, indexed
3. **Simple vertex shader** - screen-space thickness
4. **Simple fragment shader** - solid color, no dash
5. **Integration with ArmyManager** - hook into `moveArmy()`
6. **Basic visibility** - show/hide based on selection

### Phase 2: Polish (Visual Quality)

1. **Animated dash pattern** - time-based flow
2. **Progress indicator** - highlight at army position
3. **Soft anti-aliased edges** - smoothstep in fragment
4. **Endpoint fade** - gradual fade at start/end
5. **Player color integration** - use `playerColorManager`

### Phase 3: Optimization (Scale)

1. **Instance pooling** - reuse inactive segments
2. **Frustum culling** - integrate with `CentralizedVisibilityManager`
3. **Buffer compaction** - periodic cleanup
4. **Quality tiers** - LOW fallback to THREE.Line
5. **Memory monitoring** - integrate with existing MemoryMonitor

### Phase 4: UX Enhancements (Optional)

1. **Preview paths** - show hypothetical path on hover destination
2. **Path comparison** - show multiple candidate destinations
3. **Waypoint indicators** - subtle dots at hex centers
4. **Terrain integration** - paths follow terrain height

---

## 9. File Structure

```
src/three/
├── managers/
│   └── path-renderer.ts         # Main PathRenderer class
├── shaders/
│   └── path-line-material.ts    # ShaderMaterial + GLSL
├── types/
│   └── path.ts                  # PathSegment, ArmyPath interfaces
└── geometry/
    └── path-geometry.ts         # Instanced quad BufferGeometry
```

---

## 10. Color Coding

| State | Base Color | Opacity |
|-------|------------|---------|
| Selected (own) | Player primary | 0.8 |
| Hover (own) | Player primary | 0.4 |
| Moving (own) | Player primary | 0.6 |
| Preview | Gray | 0.3 |
| Ally | Ally green | 0.5 |
| Enemy (dest only) | Enemy red | 0.4 |
