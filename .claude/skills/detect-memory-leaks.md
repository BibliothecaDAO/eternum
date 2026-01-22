---
name: detect-memory-leaks
description:
  Analyzes React and Three.js code to identify, explain, and fix memory leaks via static analysis. Covers useEffect
  cleanup, event listeners, async operations, detached DOM nodes, global scope mutations, unbounded caching, and
  Three.js resource management.
---

# Memory Leak Detection & Resolution Skill

This skill allows you to analyze source code to detect patterns that cause memory leaks. You must rely on **Static Code
Analysis** of the provided files.

---

## Part 1: React Memory Leak Detection

### Analysis Process

When given a React component or hook file, perform the following checks sequentially:

### 1. The "Effect Cleanup" Check (Resource Persistence)

Scan all `useEffect` and `useLayoutEffect` hooks.

- **Trigger:** Does the effect body create a persistent resource?
  - `addEventListener` (window/document/body)
  - `setInterval` / `setTimeout`
  - `new WebSocket()` / `new EventSource()`
  - External library subscriptions (e.g., `RxJS.subscribe`, `Firebase.onSnapshot`)
- **Validation:** Does the hook return a **cleanup function**?
  - If **NO**: Report **CRITICAL LEAK**.
  - If **YES**: Verify the cleanup function explicitly destroys the specific resource created (e.g.,
    `removeEventListener` matches the `addEventListener` arguments exactly).

### 2. The "Global Scope Mutation" Check (The Singleton Leak)

Scan for variables declared _outside_ the component function (module scope) that are mutated _inside_ the component or
its hooks.

- **Trigger:**
  - A variable (`const cache = []`, `let globalCounter = 0`) defined at the top of the file.
  - Code inside `useEffect` or event handlers that uses `.push()`, `.set()`, or assignment (`=`) on that variable.
- **Why it Leaks:** Variables in module scope persist for the application's lifetime. If a component adds data to them
  on every mount without clearing it, memory usage grows indefinitely.
- **Verdict:** Report **MODULE SCOPE LEAK**.

### 3. The "Detached DOM Node" Check

Scan for direct manipulation of the DOM using vanilla JS methods within React.

- **Trigger:** Usage of `document.createElement`, `document.body.appendChild`, or `document.getElementById` assigned to
  a `ref` or variable.
- **Validation:** If a DOM node is manually created or queried and stored in a variable/ref:
  - Is it explicitly removed from the DOM _and_ is the reference nullified in the cleanup function?
- **Verdict:** If the node is removed from the DOM but the JS reference (`myRef.current`) remains, or vice-versa. Report
  **DETACHED DOM NODE RISK**.

### 4. The "Async State" Check

Scan all `useEffect` hooks that perform asynchronous operations (`fetch`, `axios`, `async/await`) and subsequently call
a `setState` function.

- **Trigger:** A promise resolves/rejects and calls `setState` (or `dispatch`).
- **Validation:** Is there a mechanism to prevent the state update if the component unmounts?
  - Look for `AbortController` usage (Best Practice).
  - Look for `isMounted` ref patterns (Legacy Practice).
- **Verdict:** If neither exists, Report **RACE CONDITION / LEAK RISK**.

### 5. The "Unbounded Caching" Check

Scan for local caches (Maps/Sets) that lack size limits or cleanup policies.

- **Trigger:** `const cache = new Map()` or `new Set()` used to store data.
- **Validation:** Is there logic to `.clear()` or `.delete()` old entries?
- **Verdict:** If data is only ever added, Report **UNBOUNDED CACHE LEAK**.

---

### React Pattern Matching & Solutions

When you identify a leak, provide the specific fix using the patterns below.

#### Pattern A: Event Listeners

**Detection:** `addEventListener` without matching `removeEventListener`.

**Correct Fix:**

```javascript
useEffect(() => {
  const handleResize = () => {
    /* logic */
  };
  window.addEventListener("resize", handleResize);

  // MUST return cleanup
  return () => window.removeEventListener("resize", handleResize);
}, []);
```

#### Pattern B: Intervals and Timeouts

**Detection:** `setInterval` or `setTimeout` without `clearInterval`/`clearTimeout`.

**Correct Fix:**

```javascript
useEffect(() => {
  const intervalId = setInterval(() => {
    /* logic */
  }, 1000);

  return () => clearInterval(intervalId);
}, []);
```

#### Pattern C: Async Operations

**Detection:** `fetch`/`async` calling `setState` without cancellation.

**Correct Fix (AbortController):**

```javascript
useEffect(() => {
  const controller = new AbortController();

  fetch("/api/data", { signal: controller.signal })
    .then((res) => res.json())
    .then((data) => setState(data))
    .catch((err) => {
      if (err.name !== "AbortError") throw err;
    });

  return () => controller.abort();
}, []);
```

#### Pattern D: Subscriptions

**Detection:** External library subscriptions without unsubscribe.

**Correct Fix:**

```javascript
useEffect(() => {
  const unsubscribe = someStore.subscribe(callback);

  return () => unsubscribe();
}, []);
```

#### Pattern E: Module Scope Cache

**Detection:** Module-level array/object mutated inside component.

**Correct Fix:** Move cache inside component or use WeakMap/cleanup:

```javascript
// Option 1: Move inside component with cleanup
const MyComponent = () => {
  const cacheRef = useRef(new Map());

  useEffect(() => {
    return () => cacheRef.current.clear();
  }, []);
};

// Option 2: Use WeakMap for automatic GC
const cache = new WeakMap(); // Keys are GC'd when objects are unreachable
```

---

## Part 2: Three.js Memory Leak Detection

### Analysis Process for Three.js Code

When analyzing Three.js managers, scenes, or components:

### 1. The "Geometry Disposal" Check

Scan for `new THREE.BufferGeometry()`, `new THREE.PlaneGeometry()`, etc.

- **Trigger:** Any geometry instantiation.
- **Validation:** Is `.dispose()` called in a cleanup/destroy method?
- **Verdict:** If no disposal, Report **GEOMETRY LEAK**.

### 2. The "Material Disposal" Check

Scan for `new THREE.MeshBasicMaterial()`, `new THREE.ShaderMaterial()`, etc.

- **Trigger:** Any material instantiation.
- **Validation:** Is `.dispose()` called in cleanup?
- **Additional:** If material has a `.map` (texture), is that also disposed?
- **Verdict:** If no disposal, Report **MATERIAL LEAK**.

### 3. The "Texture Disposal" Check

Scan for `new THREE.TextureLoader().load()`, `new THREE.Texture()`.

- **Trigger:** Any texture creation.
- **Validation:** Is `.dispose()` called?
- **Verdict:** If no disposal, Report **TEXTURE LEAK**.

### 4. The "Render Target Disposal" Check

Scan for `new THREE.WebGLRenderTarget()`.

- **Trigger:** Render target instantiation.
- **Validation:** Is `.dispose()` called?
- **Verdict:** If no disposal, Report **RENDER TARGET LEAK** (very expensive).

### 5. The "Scene Object Removal" Check

Scan for `scene.add(mesh)` or `parent.add(child)`.

- **Trigger:** Adding objects to scene graph.
- **Validation:** Is `scene.remove(mesh)` called in cleanup?
- **Verdict:** If not removed, Report **SCENE GRAPH LEAK**.

### 6. The "Animation Loop Cleanup" Check

Scan for `requestAnimationFrame` or GSAP animations.

- **Trigger:** Animation registration.
- **Validation:** Is `cancelAnimationFrame` or `gsap.killTweensOf()` called?
- **Verdict:** If not cancelled, Report **ANIMATION LEAK**.

### 7. The "Interval in Class" Check

Scan for `setInterval` in class methods (especially debug/GUI code).

- **Trigger:** `setInterval` without stored ID.
- **Validation:** Is interval ID stored and cleared in `dispose()`/`destroy()`?
- **Verdict:** If not tracked, Report **INTERVAL LEAK**.

### 8. The "Shared Resource Pattern" Check

Scan for per-instance resource creation that could be shared.

- **Trigger:** Constructor creates geometry/material/texture.
- **Validation:** Could this be a shared singleton with reference counting?
- **Verdict:** If many instances exist, Report **RESOURCE DUPLICATION** (not a leak, but optimization opportunity).

---

### Three.js Pattern Matching & Solutions

#### Pattern A: Geometry Pool with Disposal

**Detection:** Multiple instances creating same geometry.

**Correct Fix:**

```typescript
// Module-level shared geometry with reference counting
let sharedGeometry: THREE.PlaneGeometry | null = null;
let geometryRefCount = 0;

function getSharedGeometry(): THREE.PlaneGeometry {
  if (!sharedGeometry) {
    sharedGeometry = new THREE.PlaneGeometry(1, 1);
  }
  geometryRefCount++;
  return sharedGeometry;
}

function releaseSharedGeometry(): void {
  geometryRefCount--;
  if (geometryRefCount <= 0 && sharedGeometry) {
    sharedGeometry.dispose();
    sharedGeometry = null;
    geometryRefCount = 0;
  }
}
```

#### Pattern B: Complete Three.js Object Cleanup

**Detection:** Class creates Three.js objects.

**Correct Fix:**

```typescript
class MyManager {
  private mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;
  private texture: THREE.Texture;

  dispose(): void {
    // 1. Remove from scene
    this.mesh.parent?.remove(this.mesh);

    // 2. Dispose geometry
    this.geometry.dispose();

    // 3. Dispose material and its textures
    if (this.material.map) this.material.map.dispose();
    this.material.dispose();

    // 4. Dispose standalone textures
    this.texture.dispose();
  }
}
```

#### Pattern C: InstancedMesh for Draw Call Reduction

**Detection:** Multiple identical meshes with different transforms.

**Correct Fix:**

```typescript
// Instead of N meshes:
const instancedMesh = new THREE.InstancedMesh(geometry, material, maxCount);
instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

// Update transforms via matrix:
const matrix = new THREE.Matrix4();
matrix.setPosition(x, y, z);
instancedMesh.setMatrixAt(index, matrix);
instancedMesh.instanceMatrix.needsUpdate = true;
```

#### Pattern D: Interval Tracking in Classes

**Detection:** `setInterval` without stored ID.

**Correct Fix:**

```typescript
class MyManager {
  private intervalId?: ReturnType<typeof setInterval>;

  startUpdates(): void {
    this.intervalId = setInterval(() => this.update(), 100);
  }

  dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}
```

#### Pattern E: GSAP Animation Cleanup

**Detection:** GSAP tweens without cleanup.

**Correct Fix:**

```typescript
class MyAnimator {
  private tweens: gsap.core.Tween[] = [];

  animate(target: object): void {
    const tween = gsap.to(target, { x: 100 });
    this.tweens.push(tween);
  }

  dispose(): void {
    this.tweens.forEach((tween) => tween.kill());
    this.tweens = [];
  }
}
```

---

## Part 3: Memory Monitoring

### Stats Recording (Three.js)

Use the built-in stats recording system:

- **Ctrl+Shift+R** - Start recording
- **Ctrl+Shift+S** - Stop and export JSON

Key metrics in the exported summary:

```json
{
  "memory": {
    "heapUsedMB": { "start": 500, "end": 550 },
    "growthMBPerSecond": 1.5,
    "resourceChanges": {
      "geometries": 0,
      "textures": 0,
      "programs": 0
    }
  }
}
```

**Interpretation:**

- `growthMBPerSecond < 0.5` = Healthy
- `growthMBPerSecond > 1.0` = Leak present
- `resourceChanges > 0` = Three.js resource leak

### Chrome DevTools

1. **Performance tab** -> Record for 60s -> Check JS Heap trend
2. **Memory tab** -> Take heap snapshots -> Compare allocations
3. **Performance Monitor** -> Watch real-time JS heap size

---

## Output Format

When reporting findings, use this format:

```
## Memory Leak Analysis: [filename]

### CRITICAL LEAKS
1. **[LEAK TYPE]** at line [N]
   - Problem: [description]
   - Fix: [code snippet]

### WARNINGS
1. **[WARNING TYPE]** at line [N]
   - Risk: [description]
   - Recommendation: [suggestion]

### OPTIMIZATION OPPORTUNITIES
1. **[TYPE]** at line [N]
   - Current: [description]
   - Suggested: [description]
```
