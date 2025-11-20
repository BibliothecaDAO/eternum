# Deep Performance Review: Eternum Hexagon Map

This review focuses on the performance issues encountered when the hexagon world map is fully explored and visible. The
primary bottleneck identified is the **Minimap rendering logic**, specifically when zoomed out, combined with high
overhead in the main render loop.

## 1. Critical Bottleneck: Minimap Rendering

### The Issue

The `Minimap` class performs an immediate-mode render of the entire visible map area every ~33ms (30 FPS throttled).

- **Scaling Problem**: The `drawExploredTiles` method iterates over `this.scaledCoords`. The size of this map depends on
  `mapSize.width` and `mapSize.height`.
  - When zoomed out (`MAX_ZOOM_RANGE = 900`), the visible grid can exceed **400,000 tiles** (900 width x ~450 height).
  - The loop performs `Map.get()` and `context.fillRect()` for _every single tile coordinate_ in the viewport,
    regardless of whether a tile exists there or if it has changed.
  - **Result**: Hundreds of thousands of canvas draw calls per frame on the main thread, causing severe FPS drops when
    the map is "full" (zoomed out).

### Solution: Offscreen Canvas & Dirty Rectangles

Move the static tile rendering to an offscreen canvas that is only updated when:

1.  The camera moves (map center changes).
2.  The zoom level changes.
3.  New tiles are fetched/updated.

**Implementation Strategy:**

1.  **Static Layer**: Create an `OffscreenCanvas` (or a second `<canvas>` element) to hold the rendered biomes.
2.  **Blitting**: In the `draw()` loop, simply draw this cached canvas onto the main minimap context using `drawImage`.
    This replaces 400k `fillRect` calls with 1 `drawImage` call.
3.  **Dynamic Layer**: Draw dynamic entities (Armies, Structures, Camera rect) on top of the static layer every frame.

## 2. Optimization: Instanced Model Animations

### The Issue

Both `InstancedBiome` and `InstancedModel` have an `updateAnimations` method that runs every frame via
`HexagonScene.update`.

- It iterates over all `instancedMeshes`.
- Inside the mesh loop, it iterates over `mesh.count` (total number of instances) to update morph targets
  (`setMorphAt`).
- While there is a bucket optimization (`ANIMATION_BUCKETS`), calculating and setting morph targets for thousands of
  hexes/structures every frame is CPU intensive.

### Solution: Culling & LOD

1.  **Strict Frustum Culling**: Ensure animations are ONLY updated for instances that are actually visible. The current
    implementation checks chunk visibility, but could be more granular.
2.  **Distance-based Animation**: Disable animations for objects that are far away from the camera.
3.  **GPU-based Animations**: If possible, move simple animations (like water undulation or simple idle sways) entirely
    to the vertex shader to avoid CPU overhead.

## 3. Optimization: WorldmapScene Update Loop

### The Issue

The `update` method in `WorldmapScene` calls update on multiple managers sequentially:

```typescript
update(deltaTime: number) {
  super.update(deltaTime); // Updates biomes
  this.armyManager.update(deltaTime);
  this.fxManager.update(deltaTime);
  this.selectedHexManager.update(deltaTime);
  this.structureManager.updateAnimations(deltaTime);
  this.chestManager.update(deltaTime);
  this.updateMinimapThrottled?.();
}
```

With a full map, these cascading updates add up.

### Solution: Staggered Updates

Not all systems need to update every frame (16ms).

- **Minimap**: Throttle further or use `requestIdleCallback`.
- **Logic Updates**: Run heavy logic updates (like `selectedHexManager` or non-visual army logic) every n-th frame or
  strictly on a timer, separate from the render loop.

## 4. Memory & Garbage Collection

### The Issue

`Minimap.drawExploredTiles` and other render loops often create temporary objects or strings (e.g., `cacheKey` strings
in loops).

- The `scaledCoords` map keys are strings like `"100,200"`. Creating these strings every time we recompute scales causes
  GC pressure.

### Solution

- Use integer keys (cantor pairing or bit shifting) instead of strings for coordinate maps where possible.
- Reuse Vector3/Object3D instances (already being done in some places like `dummy` and `tempPosition`, but verify
  coverage).

## Recommended Immediate Actions (Priority Order)

1.  **Refactor Minimap**: Implement the offscreen canvas caching for the static tile layer. This will yield the largest
    performance gain when the map is fully visible.
2.  **Optimize Animation Loop**: Add distance checks to `updateAnimations` to skip processing for distant
    hexes/structures.
3.  **Profile `drawExploredTiles`**: Use Chrome Profiler to confirm the time spent in `fillRect`.

## Example Code for Minimap Optimization

```typescript
// In Minimap class

private staticLayerCanvas: HTMLCanvasElement;
private staticLayerContext: CanvasRenderingContext2D;
private needsStaticRedraw: boolean = true;

constructor(...) {
  // ... init ...
  this.staticLayerCanvas = document.createElement('canvas');
  this.staticLayerContext = this.staticLayerCanvas.getContext('2d')!;
}

private resizeStaticLayer() {
  this.staticLayerCanvas.width = this.canvas.width;
  this.staticLayerCanvas.height = this.canvas.height;
  this.needsStaticRedraw = true;
}

private drawExploredTilesToStaticLayer() {
  // Clear static layer
  this.staticLayerContext.clearRect(0, 0, this.staticLayerCanvas.width, this.staticLayerCanvas.height);

  // Perform the heavy loop here ONCE per change
  for (const [cacheKey, { scaledCol, scaledRow }] of this.scaledCoords) {
    const tile = this.tileMap.get(cacheKey);
    if (tile) {
       // ... get color ...
       this.staticLayerContext.fillStyle = biomeColor;
       this.staticLayerContext.fillRect(...);
    }
  }
  this.needsStaticRedraw = false;
}

draw() {
  // Check if we need to redraw static layer (pan/zoom/new tiles)
  if (this.needsStaticRedraw) {
    this.drawExploredTilesToStaticLayer();
  }

  // 1. Blit static layer (Fast!)
  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  this.context.drawImage(this.staticLayerCanvas, 0, 0);

  // 2. Draw dynamic entities on top
  this.drawStructures();
  this.drawArmies();
  // ...
}
```
