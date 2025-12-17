# Fog of War System + World Map Visual Improvements Proposal

**Author:** Claude Code Analysis
**Date:** December 2024
**Scope:** FoW System Redesign + Multi-Level Terrain Visual Enhancements

---

## Table of Contents

1. [Current System Summary](#1-current-system-summary)
2. [Pipeline Diagram](#2-pipeline-diagram)
3. [Confirmed Issues & Limitations](#3-confirmed-issues--limitations)
4. [FoW Improvement Strategies](#4-fow-improvement-strategies)
5. [Biome Height Offset Design](#5-biome-height-offset-design)
6. [Shader Approach](#6-shader-approach)
7. [Chunking & Lifecycle Integration](#7-chunking--lifecycle-integration)
8. [Performance Budget & Scalability](#8-performance-budget--scalability)
9. [Implementation Order](#9-implementation-order)

---

## 1. Current System Summary

### 1.1 FoW Data Storage

**Location:** `worldmap.tsx:176`

```typescript
private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();
```

| Property | Current Value |
|----------|--------------|
| **Resolution** | Per-tile (hexagonal grid) |
| **Format** | Nested Map structure (`Map<col, Map<row, BiomeType>>`) |
| **States** | Binary: Explored (stored with BiomeType) / Unexplored (absent from map) |
| **Storage** | Client-side JavaScript Map, no GPU texture |

**Key Insight:** There is no traditional "fog texture" - the system uses a binary explored/unexplored state stored in a CPU-side data structure.

### 1.2 FoW Update Mechanism

**Vision Sources:**
- **Explorer Troops:** Primary exploration via `troop_movement.cairo:62-159`
- **Contracts:** `map.cairo:explore()` and `explore_ring()` functions
- **Event-Driven:** Tile updates flow through Torii → `WorldUpdateListener` → `updateExploredHex()`

**Update Flow:**
```
On-Chain Exploration → Torii Indexer → WorldUpdateListener.Tile.onTileUpdate()
                                              ↓
                                    updateExploredHex()
                                              ↓
                            exploredTiles Map + gameWorkerManager
```

**Cadence:** Event-driven (on explorer movement), not per-frame

### 1.3 FoW Rendering

**Current Approach:** Binary visibility via instanced mesh selection

```typescript
// worldmap.tsx:2892-2909
if (effectivelyExplored) {
  const biome = isExplored as BiomeType;
  tempPosition.y += 0.05;  // Explored: Y = 0.05
  biomeHexes[biomeVariant].push(pooledMatrix);
} else {
  tempPosition.y = 0.01;   // Unexplored: Y = 0.01
  biomeHexes.Outline.push(pooledMatrix);  // Render as outline
}
```

**Rendering Characteristics:**
- No fog texture overlay
- No alpha blending or soft transitions
- Unexplored hexes render as "Outline" biome at lower Y (0.01)
- Explored hexes render actual biome at Y (0.05)
- No shader-based fog sampling

### 1.4 Chunk System

**Configuration:** `world-chunk-config.ts`

| Setting | Value |
|---------|-------|
| **Stride** | 24 hexes |
| **Render Size** | 48x48 hexes |
| **Pin Radius** | 2 (5x5 neighborhood) |
| **Max Cache** | 20 chunks (LRU) |

**Chunk Lifecycle:**
1. **Creation:** Camera enters new chunk → `updateVisibleChunks()`
2. **Caching:** `cacheMatricesForChunk()` stores instance matrices per biome
3. **Disposal:** LRU eviction via `ensureMatrixCacheLimit()`

### 1.5 Existing Height/Depth Values

**Biome Depth Constants:** `packages/types/src/constants/hex.ts:1-18`

```typescript
export const biomes = {
  deep_ocean:    { depth: 0.1 },  // Low elevation
  ocean:         { depth: 0.1 },
  beach:         { depth: 0.2 },
  scorched:      { depth: 0.8 },  // High elevation
  bare:          { depth: 0.7 },
  tundra:        { depth: 0.6 },
  snow:          { depth: 0.5 },
  grassland:     { depth: 0.4 },
  // ... etc
};
```

**Critical Finding:** These `depth` values exist but are **NOT currently used** in rendering. All biomes render at the same Y position (0.05 for explored, 0.01 for unexplored).

---

## 2. Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT FOW + MAP PIPELINE                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   On-Chain   │    │    Torii     │    │   Client     │    │   Renderer   │
│  Exploration │───▶│   Indexer    │───▶│  Listener    │───▶│  (Three.js)  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                                       │                    │
       │                                       ▼                    │
       │                          ┌────────────────────┐            │
       │                          │  exploredTiles Map │            │
       │                          │  (CPU-side)        │            │
       │                          └────────────────────┘            │
       │                                       │                    │
       │                                       ▼                    │
       │                          ┌────────────────────┐            │
       │                          │  updateHexagonGrid │            │
       │                          │  (per-chunk)       │            │
       │                          └────────────────────┘            │
       │                                       │                    │
       │                          ┌────────────┴────────────┐       │
       │                          ▼                         ▼       │
       │                 ┌────────────────┐      ┌────────────────┐ │
       │                 │ Explored Hexes │      │Unexplored Hexes│ │
       │                 │ (Biome Models) │      │ (Outline Model)│ │
       │                 │ Y = 0.05       │      │ Y = 0.01       │ │
       │                 └────────────────┘      └────────────────┘ │
       │                          │                         │       │
       │                          └──────────┬──────────────┘       │
       │                                     ▼                      │
       │                          ┌────────────────────┐            │
       │                          │  Instanced Meshes  │            │
       │                          │  (per biome type)  │────────────┤
       │                          └────────────────────┘            │
       │                                     │                      │
       │                                     ▼                      │
       │                          ┌────────────────────┐            │
       │                          │    GPU Render      │            │
       │                          │  (Standard Mat'ls) │◀───────────┘
       │                          └────────────────────┘
       │
       └──────────────────────────────────────────────────────────────
                         NO FOG TEXTURE IN CURRENT SYSTEM
```

---

## 3. Confirmed Issues & Limitations

### 3.1 FoW System Issues

| Issue | Severity | Evidence | Impact |
|-------|----------|----------|--------|
| **No soft transitions** | HIGH | Binary explored/unexplored only | Harsh visual edges, no gradual reveal |
| **No "seen but hidden" state** | HIGH | Only two states in Map | Cannot show previously explored but currently obscured areas |
| **No fog texture** | MEDIUM | No texture sampling in render | Cannot do distance-based fog falloff |
| **Per-hex CPU lookup** | MEDIUM | `exploredTiles.get(col)?.get(row)` | O(1) but repeated per hex per frame during chunk rebuild |
| **Full chunk invalidation** | MEDIUM | `removeCachedMatricesForChunk()` | Single hex change invalidates entire chunk cache |

### 3.2 Visual Limitations

| Issue | Severity | Evidence | Impact |
|-------|----------|----------|--------|
| **Flat world** | HIGH | All biomes at Y=0.05 | No terrain depth perception |
| **Unused depth values** | HIGH | `biomes.depth` defined but unused | Existing data wasted |
| **No parallax** | HIGH | No height offset in vertex shader | Map feels 2D at strategy zoom |
| **Uniform fog** | MEDIUM | `FOG_CONFIG` is distance-only | No biome-aware fog density |
| **No edge effects** | MEDIUM | Standard materials only | No FoW edge glow or shadow |

### 3.3 Performance Concerns

| Issue | Severity | Evidence | Impact |
|-------|----------|----------|--------|
| **Chunk rebuild on FoW change** | HIGH | Lines 2225-2262 | Single tile exploration rebuilds chunk |
| **No dirty rect tracking** | MEDIUM | Full grid recompute | Unnecessary work on local changes |
| **CPU-bound matrix generation** | MEDIUM | `processCell()` loop | Frame budget allocation needed |
| **Large cache memory** | LOW | 20 chunks × matrices | ~several MB per chunk |

### 3.4 Verification Methods

```typescript
// To verify FoW lookup overhead:
console.time('exploredLookup');
for (let i = 0; i < 10000; i++) {
  this.exploredTiles.get(col)?.get(row);
}
console.timeEnd('exploredLookup');

// To verify chunk invalidation:
// Add logging in removeCachedMatricesForChunk()

// To verify height values unused:
// Search for biomes[*].depth usage - only defined, never read
```

---

## 4. FoW Improvement Strategies

### 4.1 Strategy Comparison Matrix

| Strategy | Soft Edges | Seen State | GPU Cost | CPU Cost | Implementation Complexity |
|----------|------------|------------|----------|----------|--------------------------|
| **A: Chunk-local FoW Textures** | Yes | Yes | Low | Medium | Medium |
| **B: Global FoW Atlas** | Yes | Yes | Low | Low | High |
| **C: Distance-Field FoW** | Best | Yes | Medium | High (gen) | High |
| **D: Current + Enhancements** | Partial | No | Lowest | Lowest | Low |

### 4.2 Recommended: Strategy A - Chunk-Local FoW Textures

**Rationale:** Best balance of quality improvement, implementation complexity, and performance.

#### Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROPOSED FOW TEXTURE SYSTEM                  │
└─────────────────────────────────────────────────────────────────┘

Per-Chunk FoW Texture (64x64 or 128x128):
┌────────────────────────────────────────┐
│  R: Visibility (0=unseen, 1=visible)   │
│  G: Explored (0=never seen, 1=seen)    │
│  B: Reserved (height modifier?)        │
│  A: Reserved (animation time?)         │
└────────────────────────────────────────┘

Resolution Options:
- 64x64:  ~16KB per chunk, 4 pixels per hex (24-stride chunk)
- 128x128: ~64KB per chunk, 16 pixels per hex (better edges)

Update Strategy:
- Dirty rect tracking: Only update modified region
- texSubImage2D for partial updates
- Double-buffered for smooth transitions
```

#### FoW Texture Data Format

```typescript
interface FoWTextureData {
  visibility: number;   // 0.0 = hidden, 1.0 = fully visible
  explored: number;     // 0.0 = never seen, 1.0 = has been seen
  heightMod: number;    // Reserved for height-based fog
  timestamp: number;    // For temporal smoothing
}

// Pack into RGBA8:
// R = visibility * 255
// G = explored * 255
// B = heightMod * 255
// A = (timestamp % 256)
```

#### Update Mechanism

```typescript
class ChunkFoWTexture {
  private texture: THREE.DataTexture;
  private data: Uint8Array;
  private dirtyRegion: { minX, minY, maxX, maxY } | null = null;

  setVisibility(localCol: number, localRow: number, visibility: number, explored: boolean) {
    const idx = (localRow * this.width + localCol) * 4;
    this.data[idx + 0] = Math.floor(visibility * 255);
    this.data[idx + 1] = explored ? 255 : 0;

    // Track dirty region
    this.expandDirtyRegion(localCol, localRow);
  }

  flush() {
    if (!this.dirtyRegion) return;

    // Partial texture update
    const { minX, minY, maxX, maxY } = this.dirtyRegion;
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    // Use texSubImage2D for efficient update
    this.texture.needsUpdate = true;
    this.dirtyRegion = null;
  }
}
```

### 4.3 Alternative: Strategy D - Current System + Enhancements

If full FoW texture system is too complex, these incremental improvements are valuable:

1. **Add "seen" state** to exploredTiles Map:
   ```typescript
   private exploredTiles: Map<number, Map<number, { biome: BiomeType, visible: boolean }>>
   ```

2. **Outline opacity variation** based on "seen" state:
   - Never seen: opacity 0.04
   - Seen but hidden: opacity 0.15

3. **Dirty rect tracking** for chunk updates:
   - Track which hexes changed
   - Only rebuild affected biome instance buffers

---

## 5. Biome Height Offset Design

### 5.1 Height Offset Values

Using existing `depth` values from `hex.ts`, normalized to visual range:

```typescript
const BIOME_HEIGHT_OFFSETS: Record<BiomeType, number> = {
  // Water (lowest)
  DeepOcean: -0.15,
  Ocean: -0.10,
  Beach: 0.0,

  // Plains (baseline)
  Grassland: 0.05,
  Shrubland: 0.08,
  SubtropicalDesert: 0.04,
  TemperateDesert: 0.06,

  // Forests (medium)
  TemperateDeciduousForest: 0.10,
  TropicalSeasonalForest: 0.10,
  TemperateRainForest: 0.15,
  TropicalRainForest: 0.12,
  Taiga: 0.12,

  // Highlands (elevated)
  Tundra: 0.18,
  Snow: 0.20,
  Bare: 0.22,
  Scorched: 0.25,  // Highest - volcanic peaks
};

// Visual range: -0.15 to +0.25 = 0.40 total units
// At HEX_SIZE = 1, this is subtle but perceivable
```

### 5.2 Implementation Options

#### Option A: Vertex Shader Offset (Recommended)

**Pros:**
- Real parallax effect
- Cheap GPU cost
- True depth in depth buffer

**Cons:**
- Affects raycasting/selection (must account for offset)
- Requires biome ID attribute or texture lookup

**Implementation:**

```typescript
// In instanced-biome.tsx, add per-instance height offset attribute
class InstancedBiome {
  private heightOffsets: Float32Array;
  private heightAttribute: THREE.InstancedBufferAttribute;

  constructor(gltf, count, enableRaycast, name) {
    // ... existing code ...

    // Add height offset attribute
    this.heightOffsets = new Float32Array(count);
    this.heightAttribute = new THREE.InstancedBufferAttribute(this.heightOffsets, 1);

    this.instancedMeshes.forEach(mesh => {
      mesh.geometry.setAttribute('instanceHeightOffset', this.heightAttribute);
    });
  }

  setHeightOffsetAt(index: number, offset: number) {
    this.heightOffsets[index] = offset;
    this.heightAttribute.needsUpdate = true;
  }
}
```

**Custom Shader Material (extends MeshStandardMaterial):**

```glsl
// Vertex shader injection
attribute float instanceHeightOffset;

void main() {
  // Apply height offset to instance position
  vec3 transformed = position;

  // Get instance matrix
  mat4 instanceMat = instanceMatrix;

  // Extract position and add height offset
  vec3 instancePos = vec3(instanceMat[3][0], instanceMat[3][1], instanceMat[3][2]);
  instancePos.y += instanceHeightOffset;

  // Rebuild matrix with offset
  instanceMat[3][1] += instanceHeightOffset;

  // Continue with standard transform
  vec4 mvPosition = modelViewMatrix * instanceMat * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
```

#### Option B: Fragment Shader Lighting Offset (Fallback)

**Pros:**
- No geometry impact
- No raycasting changes

**Cons:**
- No true parallax
- Less convincing depth

**Implementation:**

```glsl
// Fragment shader - fake height via lighting
uniform sampler2D biomeHeightMap;

void main() {
  float heightOffset = texture2D(biomeHeightMap, vUv).r;

  // Bias normal upward for elevated biomes
  vec3 biasedNormal = normalize(normal + vec3(0.0, heightOffset * 0.5, 0.0));

  // Adjust ambient occlusion
  float ao = 1.0 - heightOffset * 0.2;

  // Apply to lighting calculation
  // ...
}
```

#### Option C: Hybrid (Best Quality)

Combine small vertex offset with enhanced lighting:

```typescript
const VERTEX_HEIGHT_SCALE = 0.6;   // Reduce vertex offset
const LIGHTING_HEIGHT_SCALE = 0.4; // Add lighting bias

// Vertex offset (real parallax, reduced to minimize selection issues)
vertexOffset = biomeHeight * VERTEX_HEIGHT_SCALE;

// Lighting bias (enhanced depth perception)
lightingBias = biomeHeight * LIGHTING_HEIGHT_SCALE;
```

### 5.3 Interactive Selection Compensation

When using vertex height offsets, raycasting must compensate:

```typescript
// In interactive-hex-manager.ts
getHexAtPosition(worldPosition: Vector3): HexPosition | null {
  // 1. Get hex coordinates from XZ position
  const hexCoords = this.worldToHex(worldPosition.x, worldPosition.z);

  // 2. Look up biome and height offset
  const biome = this.exploredTiles.get(hexCoords.col)?.get(hexCoords.row);
  const heightOffset = biome ? BIOME_HEIGHT_OFFSETS[biome] : 0;

  // 3. Validate Y position is within height-adjusted range
  const expectedY = 0.05 + heightOffset;
  const tolerance = 0.3; // Allow generous tolerance

  if (Math.abs(worldPosition.y - expectedY) > tolerance) {
    return null; // Click missed the terrain
  }

  return hexCoords;
}
```

---

## 6. Shader Approach

### 6.1 Enhanced Biome Shader (GLSL-like Pseudocode)

```glsl
// ============================================
// BIOME TERRAIN SHADER WITH FOW + HEIGHT
// ============================================

// Uniforms
uniform sampler2D fowTexture;        // R=visibility, G=explored
uniform sampler2D biomeHeightMap;    // Per-biome height lookup
uniform float fowEdgeSoftness;       // 0.0 = hard, 1.0 = soft
uniform float heightScale;           // Global height multiplier
uniform vec3 fowColor;               // Color of unexplored fog
uniform float fowDensityLow;         // Fog density for low terrain
uniform float fowDensityHigh;        // Fog density for high terrain

// Varyings (from vertex shader)
varying vec2 vWorldUV;               // World-space UV for FoW lookup
varying float vHeight;               // Height offset applied
varying vec3 vNormal;
varying vec3 vPosition;

// ============================================
// VERTEX SHADER
// ============================================
attribute float instanceHeightOffset;
attribute float instanceBiomeId;

void vertexMain() {
  // Apply height offset
  vec3 transformed = position;
  float heightOffset = instanceHeightOffset * heightScale;

  // Modify instance matrix Y position
  mat4 instanceMat = instanceMatrix;
  instanceMat[3][1] += heightOffset;

  // Pass height to fragment shader
  vHeight = heightOffset;

  // Calculate world UV for FoW texture sampling
  vec4 worldPos = modelMatrix * instanceMat * vec4(transformed, 1.0);
  vWorldUV = worldPos.xz / chunkWorldSize; // Normalize to 0-1

  // Standard transform
  vec4 mvPosition = modelViewMatrix * instanceMat * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vNormal = normalMatrix * normal;
  vPosition = mvPosition.xyz;
}

// ============================================
// FRAGMENT SHADER
// ============================================
void fragmentMain() {
  // Sample FoW texture
  vec4 fowSample = texture2D(fowTexture, vWorldUV);
  float visibility = fowSample.r;
  float explored = fowSample.g;

  // Soft edge calculation using smoothstep
  float fowEdge = smoothstep(0.0, fowEdgeSoftness, visibility);

  // Height-aware fog density
  // Lower terrain = more fog, higher terrain = less fog
  float heightNorm = (vHeight + 0.15) / 0.40; // Normalize to 0-1
  float fogDensity = mix(fowDensityLow, fowDensityHigh, heightNorm);

  // Explored but not visible = "remembered" state
  float rememberedAlpha = explored * (1.0 - visibility) * 0.4;

  // Base color from material
  vec4 baseColor = /* standard material color calculation */;

  // Apply FoW effect
  vec3 fowTint = mix(fowColor, baseColor.rgb, fowEdge);

  // Height-based lighting adjustment
  // Higher terrain receives more direct light
  float lightBias = heightNorm * 0.3;
  vec3 litColor = fowTint * (1.0 + lightBias);

  // Ambient occlusion for valleys
  float valleyAO = 1.0 - (1.0 - heightNorm) * 0.2;
  litColor *= valleyAO;

  // Final color with fog blending
  float fogFactor = (1.0 - fowEdge) * fogDensity;
  vec3 finalColor = mix(litColor, fowColor, fogFactor);

  // Output
  gl_FragColor = vec4(finalColor, baseColor.a);
}
```

### 6.2 Shader Integration with Three.js

```typescript
// Create custom material extending MeshStandardMaterial
class BiomeFoWMaterial extends THREE.MeshStandardMaterial {
  constructor(params: THREE.MeshStandardMaterialParameters & {
    fowTexture?: THREE.Texture,
    fowEdgeSoftness?: number,
    heightScale?: number,
  }) {
    super(params);

    this.onBeforeCompile = (shader) => {
      // Add uniforms
      shader.uniforms.fowTexture = { value: params.fowTexture };
      shader.uniforms.fowEdgeSoftness = { value: params.fowEdgeSoftness ?? 0.3 };
      shader.uniforms.heightScale = { value: params.heightScale ?? 1.0 };
      shader.uniforms.fowColor = { value: new THREE.Color(0x1b1e2b) };

      // Inject vertex shader code
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        attribute float instanceHeightOffset;
        varying float vHeight;
        varying vec2 vWorldUV;
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        transformed.y += instanceHeightOffset * heightScale;
        vHeight = instanceHeightOffset;
        vWorldUV = (modelMatrix * vec4(transformed, 1.0)).xz / 24.0;
        `
      );

      // Inject fragment shader code
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform sampler2D fowTexture;
        uniform float fowEdgeSoftness;
        uniform vec3 fowColor;
        varying float vHeight;
        varying vec2 vWorldUV;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        `
        // FoW sampling and blending
        vec4 fowSample = texture2D(fowTexture, vWorldUV);
        float fowEdge = smoothstep(0.0, fowEdgeSoftness, fowSample.r);
        float heightNorm = (vHeight + 0.15) / 0.40;

        outgoingLight = mix(fowColor, outgoingLight, fowEdge);
        outgoingLight *= (1.0 + heightNorm * 0.2);

        #include <output_fragment>
        `
      );
    };
  }
}
```

---

## 7. Chunking & Lifecycle Integration

### 7.1 FoW Texture Lifecycle

```typescript
class ChunkFoWManager {
  private textures: Map<string, ChunkFoWTexture> = new Map();
  private texturePool: ChunkFoWTexture[] = [];
  private maxPoolSize = 5;

  // Called when chunk is loaded
  onChunkLoad(chunkKey: string, exploredTiles: ExploredTilesMap) {
    // Get or create texture
    let texture = this.texturePool.pop();
    if (!texture) {
      texture = new ChunkFoWTexture(CHUNK_FOW_RESOLUTION);
    }

    // Initialize from explored tiles
    this.initializeFromExploredTiles(texture, chunkKey, exploredTiles);

    this.textures.set(chunkKey, texture);
    return texture;
  }

  // Called when chunk is unloaded
  onChunkUnload(chunkKey: string) {
    const texture = this.textures.get(chunkKey);
    if (texture) {
      texture.clear();

      // Return to pool if not full
      if (this.texturePool.length < this.maxPoolSize) {
        this.texturePool.push(texture);
      } else {
        texture.dispose();
      }

      this.textures.delete(chunkKey);
    }
  }

  // Called when tile is explored
  onTileExplored(col: number, row: number, biome: BiomeType) {
    const chunkKey = this.getChunkKeyForTile(col, row);
    const texture = this.textures.get(chunkKey);

    if (texture) {
      const localCoords = this.worldToLocalCoords(col, row, chunkKey);
      texture.setVisibility(localCoords.x, localCoords.y, 1.0, true);
      texture.flush(); // Apply dirty region update
    }
  }

  // Called when visibility changes (e.g., unit moved away)
  onVisibilityChange(col: number, row: number, visible: boolean) {
    const chunkKey = this.getChunkKeyForTile(col, row);
    const texture = this.textures.get(chunkKey);

    if (texture) {
      const localCoords = this.worldToLocalCoords(col, row, chunkKey);
      texture.setVisibility(
        localCoords.x,
        localCoords.y,
        visible ? 1.0 : 0.3, // 0.3 = "remembered" state
        true // explored stays true
      );
      texture.flush();
    }
  }
}
```

### 7.2 Height Data Integration

```typescript
class BiomeHeightManager {
  private heightLookup: Float32Array;

  constructor() {
    // Pre-compute height offsets for all biome types
    this.heightLookup = new Float32Array(Object.keys(BiomeType).length);

    Object.entries(BIOME_HEIGHT_OFFSETS).forEach(([biome, height]) => {
      const biomeId = BiomeTypeToId[biome as BiomeType];
      this.heightLookup[biomeId] = height;
    });
  }

  getHeightForBiome(biome: BiomeType): number {
    const biomeId = BiomeTypeToId[biome];
    return this.heightLookup[biomeId] ?? 0;
  }

  // Called during chunk hex grid generation
  applyHeightToMatrix(matrix: THREE.Matrix4, biome: BiomeType): void {
    const height = this.getHeightForBiome(biome);
    const position = new THREE.Vector3();
    matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
    position.y += height;
    matrix.setPosition(position);
  }
}
```

### 7.3 Seam Handling

For smooth transitions across chunk boundaries:

```typescript
// FoW texture sampling with border pixels
class ChunkFoWTexture {
  // Include 1-pixel border for bilinear sampling across seams
  private readonly BORDER_SIZE = 1;

  constructor(resolution: number) {
    this.width = resolution + this.BORDER_SIZE * 2;
    this.height = resolution + this.BORDER_SIZE * 2;
    // ... texture creation ...
  }

  // Copy border pixels from neighbor chunks
  syncBorders(neighbors: {
    north?: ChunkFoWTexture,
    south?: ChunkFoWTexture,
    east?: ChunkFoWTexture,
    west?: ChunkFoWTexture,
  }) {
    if (neighbors.north) {
      // Copy bottom row of north chunk to our top border
      this.copyRow(neighbors.north, this.resolution - 1, 0);
    }
    // ... similar for other edges
  }
}
```

---

## 8. Performance Budget & Scalability

### 8.1 Memory Budget

| Component | Low Quality | Medium Quality | High Quality |
|-----------|-------------|----------------|--------------|
| **FoW Texture per chunk** | 32x32 RGBA (~4KB) | 64x64 RGBA (~16KB) | 128x128 RGBA (~64KB) |
| **Max cached chunks** | 10 | 20 | 30 |
| **Total FoW memory** | ~40KB | ~320KB | ~1.9MB |
| **Height offset attribute** | N/A (use Y position) | Per-instance float | Per-instance float |

### 8.2 GPU Performance Budget

| Operation | Low | Medium | High |
|-----------|-----|--------|------|
| **FoW texture samples/pixel** | 1 | 1 | 1 (with filtering) |
| **Height offset** | None | Vertex only | Vertex + fragment bias |
| **Soft edges** | Hard cutoff | smoothstep | smoothstep + glow |
| **Target additional cost** | <5% | <10% | <15% |

### 8.3 CPU Performance Budget

| Operation | Budget |
|-----------|--------|
| **FoW texture update (partial)** | <1ms per dirty region |
| **Height offset calculation** | Precomputed (0ms runtime) |
| **Chunk matrix generation** | Existing budget (frame-budgeted) |
| **Max FoW updates per frame** | 100 tiles (with dirty rect) |

### 8.4 Quality Tiers

```typescript
enum FoWQualityTier {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

const FOW_QUALITY_CONFIG: Record<FoWQualityTier, FoWQualitySettings> = {
  [FoWQualityTier.LOW]: {
    textureResolution: 32,
    softEdges: false,
    heightOffsets: false,
    heightLighting: false,
    edgeSoftness: 0,
    maxCachedTextures: 10,
  },
  [FoWQualityTier.MEDIUM]: {
    textureResolution: 64,
    softEdges: true,
    heightOffsets: true,
    heightLighting: false,
    edgeSoftness: 0.3,
    maxCachedTextures: 20,
  },
  [FoWQualityTier.HIGH]: {
    textureResolution: 128,
    softEdges: true,
    heightOffsets: true,
    heightLighting: true,
    edgeSoftness: 0.5,
    maxCachedTextures: 30,
  },
};
```

### 8.5 Fallbacks

```typescript
// Graceful degradation when performance drops
class FoWPerformanceMonitor {
  private frameTimeHistory: number[] = [];
  private currentTier: FoWQualityTier = FoWQualityTier.MEDIUM;

  onFrameEnd(frameTime: number) {
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }

    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b) / this.frameTimeHistory.length;

    // Auto-downgrade if performance drops
    if (avgFrameTime > 33 && this.currentTier !== FoWQualityTier.LOW) { // <30 FPS
      this.downgradeTier();
    }

    // Auto-upgrade if stable good performance
    if (avgFrameTime < 20 && this.currentTier !== FoWQualityTier.HIGH) { // >50 FPS
      this.upgradeTier();
    }
  }
}
```

---

## 9. Implementation Order

### Phase 1: MVP Foundation (1-2 weeks)

**Goal:** Basic height offsets + improved FoW visuals without texture system

**Tasks:**
1. [ ] Add `instanceHeightOffset` attribute to `InstancedBiome`
2. [ ] Implement height offset calculation using existing `biomes.depth` values
3. [ ] Modify `processCell()` in worldmap.tsx to apply height offsets
4. [ ] Update interactive hex manager for height-compensated raycasting
5. [ ] Add height-based ambient occlusion via material parameters
6. [ ] Implement "seen" state in exploredTiles (explored + visible flags)
7. [ ] Vary outline opacity based on seen/unseen state

**Verification:**
- Map shows visible depth variation at strategy zoom
- Hex selection works correctly with height offsets
- Previously seen hexes render differently from never-seen

### Phase 2: FoW Texture System (2-3 weeks)

**Goal:** Introduce per-chunk FoW textures for soft edges

**Tasks:**
1. [ ] Implement `ChunkFoWTexture` class with dirty rect tracking
2. [ ] Create `ChunkFoWManager` for texture lifecycle
3. [ ] Modify biome materials to sample FoW texture
4. [ ] Implement soft edge rendering via smoothstep
5. [ ] Add border pixel syncing for seamless chunk transitions
6. [ ] Integrate with existing chunk cache system

**Verification:**
- FoW edges are soft and gradual
- No seams visible at chunk boundaries
- Memory usage within budget

### Phase 3: Enhanced Visuals (1-2 weeks)

**Goal:** Height-aware fog and advanced lighting

**Tasks:**
1. [ ] Implement height-based fog density variation
2. [ ] Add vertex shader height offset (Option A from 5.2)
3. [ ] Implement lighting bias for elevated terrain
4. [ ] Add subtle valley shadowing
5. [ ] Tune visual parameters via GUI controls
6. [ ] Implement quality tier system with fallbacks

**Verification:**
- Mountains "poke through" fog slightly
- Valleys appear deeper/shadowed
- Performance remains within budget across tiers

### Phase 4: Polish & Optimization (1 week)

**Goal:** Production-ready system

**Tasks:**
1. [ ] Performance profiling and optimization
2. [ ] Memory leak testing
3. [ ] Quality tier auto-detection
4. [ ] Add configuration to graphics settings UI
5. [ ] Documentation and code cleanup

**Verification:**
- No memory leaks over extended sessions
- Smooth quality tier transitions
- User-facing configuration works

---

## Summary

This proposal outlines a staged approach to dramatically improve the visual quality of the Eternum world map while maintaining performance. The key improvements are:

1. **Biome Height Offsets:** Utilize existing `depth` values to create subtle terrain elevation, making the world feel three-dimensional without heavy geometry.

2. **FoW Texture System:** Replace binary explored/unexplored with a texture-based system supporting soft edges, "remembered" areas, and gradual reveal.

3. **Height-Aware Fog:** Make fog density vary with terrain elevation, so peaks emerge from the mist while valleys remain shrouded.

4. **Shader-Based Effects:** Custom material modifications to add depth perception through lighting, ambient occlusion, and fog blending.

The guiding principle throughout: **Depth without geometry wins.** By focusing on perceptual tricks—height offsets, lighting bias, fog density variation—we can create a layered, dimensional world that reads beautifully at strategy zoom without the performance cost of true 3D terrain.
