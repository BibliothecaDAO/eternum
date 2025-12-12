# FX Manager “Juice” Overhaul Plan

Polish the FX system so every event feels tactile and responsive. This plan refactors the current sprite-based
`FXManager` into a generalised pipeline that supports configurable profiles, pooled instances, GPU-driven animations,
and layered feedback (world, overlay, camera/haptic). The end state is a reusable FX platform that any system can emit
to (`armies`, `structures`, `resources`, `quests`, `UI`).

---

## 1. Architecture

### 1.1 Pipeline Overview

```
[Gameplay/Event Bus]
        │
    FxDirector ── profile lookup + payload merge
        │
┌───────┴─────────────┐
│                     │
WorldFxLayer      OverlayFxLayer
(instanced quads)  (CSS2D/canvas widgets)
│                     │
FxInstancePool    UiFxPool
│                     │
FxAnimator (shared tick) ─── CameraFxLayer (screen shake, offsets)
```

- **FxDirector**: single entry point; resolves `FxProfile` by event key, chooses layer, allocates instance from pool,
  and returns an `FxHandle`.
- **FxLayer**: world, overlay, camera. Each owns renderers, pools, and update routines but share a common interface.
- **FxInstancePool**: typed pool per profile/layer. Reuses sprites, instanced rows, DOM nodes, and material uniforms to
  keep allocations minimal.
- **FxAnimator**: one update loop that steps all active FX via render clock (`delta`), eliminating per-instance RAF
  usage.
- **Profile Registry**: `fx-profiles.ts` exposes designer-friendly configs; runtime merges payload overrides (value,
  icon, intensity, etc.).
- **Layering Strategy**:
  - **World layer**: GPU instanced quads (shader-driven) for floating numbers, icons, orbiting markers.
  - **Overlay layer**: CSS2D/canvas for HUD pulses, damage overlays, UI trackers.
  - **Camera layer**: handles shake, subtle offsets, zoom pulses; integrates with existing `scene-manager` camera
    controls.

### 1.2 Module Responsibilities

| Module                    | Responsibility                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `FxDirector`              | `emit/emitAtEntity/preload`, profile lookup, handing off to layers, chaining FX.              |
| `FxProfileRegistry`       | Load/validate profile definitions in config, support overrides per environment.               |
| `FxLayer` implementations | Manage render resources (instanced mesh, CSS2D nodes, camera impulses) + pooling.             |
| `FxHandle`                | Cancel/end FX, retarget, chain follow-up FX (e.g., crit explosion after damage).              |
| `FxEventBridge`           | Subscribes to gameplay events (armies, resources, quests, structures) and calls `FxDirector`. |

### 1.3 Lightweight Implementation

- Persistent pools (arrays + freelists) for sprites, instanced rows, DOM nodes, and camera impulses.
- Shared textures/materials per FX family; load once via `TextureLoader` and mark `SRGBColorSpace`.
- Preallocated math buffers (e.g., reuse `Vector3` scratch objects) to avoid GC churn.
- Shared instanced geometry + shader uniforms so each FX only updates per-instance attributes (position, velocity,
  color, startTime).

### 1.4 CSS2D vs Mesh Hybrid

- Prefer instanced meshes for world-anchored FX (damage numbers, resource pickups) to leverage GPU animation.
- Use CSS2D/canvas only when FX must anchor to DOM UI (resource counter pulse, quest UI pop).
- Overlay layer batches DOM writes (only `transform` updates) and throttles layout to 60fps.

---

## 2. Performance Strategy

- **Pooling**: Maintain fixed-size pools per profile (e.g., 32 damage numbers). When exhausted, reuse the oldest
  instance or drop gracefully.
- **Instancing**: World layer uses a single `THREE.InstancedMesh` per atlas (numbers/icons) so draw calls stay low
  regardless of FX count.
- **Shader Animation**: Vertex shader applies translation, squash/stretch, gravity, and billboard logic using
  per-instance attributes.
- **Curve Handling**: Store easing profiles as parametric functions or LUTs (Float32Array) to avoid runtime allocations.
  Evaluate analytically (e.g., `easeOutCubic`) in shader or CPU.
- **Batched Updates**: `FxAnimator.update(delta)` iterates per profile, updating shared uniforms (time, camera facing)
  once.
- **CSS2D Optimisation**: Pre-build DOM nodes, set `will-change: transform`, only update position/opacity, and avoid
  style recalcs mid-frame.
- **Camera Effects**: Maintain an impulse accumulator to combine multiple shake requests; apply once per frame to camera
  transform.

---

## 3. FX Types & Standardised API

### 3.1 Emit API

```ts
type FxEventName =
  | "damage"
  | "heal"
  | "resourceGain"
  | "structureHit"
  | "structureDestroyed"
  | "questXp"
  | "pickup"
  | "statusEffect"
  | "crit"
  | "combo"
  | string;

interface FxEmitPayload {
  value?: number;
  icon?: string;
  unitId?: string;
  worldPosition?: THREE.Vector3;
  screenAnchor?: HTMLElement;
  variant?: string; // e.g., "crit", "dot", "aoe"
  intensity?: number; // drives shake/haptic magnitude
  velocity?: THREE.Vector3;
  size?: number;
}

fxDirector.emit("damage", worldPos, { value: -32, unitId: "army#7" });
fxDirector.emit("resourceGain", worldPos, { value: +3, icon: "gold" });
fxDirector.emit("heal", worldPos, { value: +15 });
```

### 3.2 Supported FX Types

- Animated number popups (crit, heal, dot, morale, XP).
- Icon + number combos (resource pickups, quest progress).
- Color variations (red damage, green heal, yellow resources, purple XP).
- Directional motion (float, arc to UI, toward camera, jitter).
- Sprite or SDF icon emitters (status effects orbiting units).
- Combined animations (scale-pop + float + fade), configurable per profile.
- Event-based cues: screen shake (big damage), camera offset (mid events), UI pulse (resource gain), damage overlays,
  structure crack particles, chest glint.
- Generalised emitter can attach to any entity (army, structure, quest chest, harvest node, UI widget).

### 3.3 Example Event Map

| Event                | Profile ID            | Layer           | Notes                                             |
| -------------------- | --------------------- | --------------- | ------------------------------------------------- |
| `armyDamage`         | `damage/red-float`    | World           | Red numbers, scale-pop → float, optional shake.   |
| `armyHeal`           | `heal/green-soft`     | World           | Green bounce, glow stroke.                        |
| `resourceGain`       | `resource/yellow`     | World + Overlay | Icon+number over world, UI counter pulse.         |
| `structureHit`       | `structure/impact`    | World + Camera  | Crack sprite, mesh flash, micro-shake.            |
| `structureDestroyed` | `structure/explosion` | World           | Multi-stage: cracks → shards → smoke.             |
| `critHit`            | `combat/crit`         | World + Camera  | Huge yellow numbers, impact ripple, strong shake. |
| `questXp`            | `quest/purple`        | World           | Purple floaters, sparkle trail.                   |
| `statusEffect`       | `status/poison`       | World           | Orbiting icon w/ color-coded glow.                |
| `pickup`             | `pickup/arc`          | World → UI      | Arc motion toward UI anchor.                      |
| `uiResourceUpdate`   | `ui/pulse`            | Overlay         | Button pulse, quick glow.                         |

---

## 4. FX Profile System

### 4.1 Interface

```ts
export interface FxProfile {
  id: string;
  layer: "world" | "overlay" | "camera" | "hybrid";
  color: string;
  animation: "float" | "bounce" | "scale-pop" | "shake" | "impact";
  duration: number;
  icon?: string;
  velocity?: THREE.Vector3;
  gravity?: number;
  size?: number;
  textStyle?: FxTextStyle;
  curves?: FxCurveSet;
  glow?: { color: string; intensity: number };
  screenShake?: { amplitude: number; frequency: number; decay: number };
  cameraOffset?: { magnitude: number; duration: number };
  soundCue?: string;
}
```

### 4.2 Profile Registry & Config

- `configs/fx-profiles.ts` exports a dictionary keyed by event name.
- Designers tweak values without touching logic; support environment overrides via JSON merge.
- Provide helper `combineAnimations("scale-pop", "float")` to mix curves.
- Example:

```ts
export const fxProfiles: Record<string, FxProfile> = {
  damage: {
    id: "damage/red-float",
    layer: "world",
    color: "#ff4a4a",
    animation: "scale-pop",
    duration: 0.8,
    gravity: -2.5,
    screenShake: { amplitude: 0.25, frequency: 12, decay: 0.85 },
  },
  resourceGain: {
    id: "resource/yellow",
    layer: "hybrid",
    color: "#f5c542",
    animation: "float",
    icon: "gold",
    duration: 1.1,
  },
};
```

### 4.3 Emission Flow

`fxDirector.emit(profileId, position, overrides)` → merges overrides → `FxLayer.addInstance(profile, payload)` →
instance grabbed from pool → runtime data written (value, color, startTime) → `FxAnimator` steps all active FX.

---

## 5. Animation Implementation

### 5.1 GPU-Driven World FX

- **Geometry**: single quad, billboarded to camera.
- **Attributes**: `offset`, `velocity`, `color`, `size`, `valueDigitOffset`, `startTime`, `lifetime`, `profileId`.
- **Vertex Shader**: applies translation using `velocity * easeOut(t) + gravity * t^2`, anisotropic scale for
  squash/stretch, optional rotation/jitter.
- **Fragment Shader**: samples atlas (digits/icons), applies stroke/glow via expanded alpha channel, fades using
  `smoothstep`.
- **Benefits**: minimal CPU update cost, instancing-friendly, supports hundreds of simultaneous FX.

### 5.2 Overlay/UI FX

- Use CSS2DRenderer or lightweight canvas for text; reuse DOM nodes via pools.
- Position updates use `matrixWorld` conversion to screen coordinates, batched to avoid per-node layout thrash.
- UI pulses (resource gain) manipulate CSS transforms/opacity with GPU-accelerated transitions.

### 5.3 Camera/Haptic FX

- Maintain impulse buffer: each profile adds `(amplitude, frequency, decay)`.
- Apply once per frame to camera transform; integrate with existing `scene-manager` update to keep deterministic and
  replicable.

### 5.4 Timekeeping

- `FxAnimator` receives `delta` from render loop, accumulates total time, and writes uniform(s) to shaders. Avoid
  `THREE.Clock` per instance.

---

## 6. Visual Design Notes

- **Timing**: standard float `~0.8s`, crit `1.2s`, quick ticks `0.45s`. Use `easeOutCubic`, `backOut`, or damped spring
  textures.
- **Squash & Stretch**: initial impact compresses vertically then stretches upward; amplitude tied to event intensity.
- **Readability**: strokes/glows on digits/icons, drop shadows, and color-coded palettes (damage red, heal green,
  resources yellow, XP purple).
- **Depth Handling**: world FX render on dedicated layer or use depth bias so they stay visible but still respect
  occlusion when needed. Provide max concurrent FX per entity to avoid clutter.
- **Clutter Management**: degrade gracefully (aggregate numbers, reduce alpha) when >N FX near same entity; allow
  designer-defined culling rules.
- **Screen Feedback**: pair large events with brief camera shake and UI highlight to emulate haptics.

---

## 7. Performance & Technical Considerations

- Keep `THREE.Texture` references in a cache; dispose only on teardown.
- Preload resource, relic, and status icon atlases at startup to avoid runtime stalls.
- Provide debug stats (`activeFxCount`, `poolUsage`, `droppedFx`) for tuning.
- Ensure CSS2D nodes use `pointer-events: none` and `translateZ(0)` to keep them cheap.
- For mobile, cap instanced FX count and lower texture resolution as needed.

---

## 8. Recommended Class Interfaces

```ts
class FxDirector {
  constructor(
    private registry: FxProfileRegistry,
    private layers: Record<FxLayerType, FxLayer>,
  ) {}
  emit(profileOrEvent: FxEventName, position?: THREE.Vector3, payload?: FxEmitPayload): FxHandle;
  emitAtEntity(entityId: string, profile: FxEventName, payload?: FxEmitPayload): FxHandle;
  preload(profileIds: string[]): Promise<void>;
}

interface FxLayer {
  addInstance(profile: FxProfile, payload: FxEmitPayload): FxHandle;
  update(delta: number): void;
}

class FxInstancePool<T extends FxRenderable> {
  acquire(): T;
  release(instance: T): void;
}

interface FxHandle {
  cancel(): void;
  chain(nextProfileId: string, overrides?: FxEmitPayload): FxHandle;
  retarget(position: THREE.Vector3): void;
}
```

---

## 9. Migration Plan

1. **Scaffold**: Add `fx/` module with director, registry, layers, handle interfaces, and config stubs.
2. **Instanced Layer Prototype**: Implement instanced quad renderer and animator; replicate current resource popup
   behaviour using shader curves.
3. **Profile Definitions**: Port existing FX types (skull, compass, travel, resource) into `fx-profiles.ts`, verifying
   parity with old visuals.
4. **Event Bridge**: Update `army-manager`, `structure-manager`, `resource-fx-manager`, quest systems to emit via
   `FxDirector`. Keep legacy manager behind feature flag during transition.
5. **Overlay & Camera Layers**: Implement UI pulses, damage overlay, camera shake modules referencing shared profiles.
6. **Performance Hardening**: Add pooling metrics, stress test high-FX scenarios, tune pool sizes and instancing limits.
7. **Cleanup**: Remove legacy `FXManager`/`ResourceFXManager` after full parity, document usage, and train content
   designers on profile editing.

---

## 10. Deliverables

- `fx/` module containing Director, layers, pools, and animator.
- `fx-profiles.ts` with default profiles covering combat, resources, structures, UI, quests.
- Instanced quad shader + material handling number/icon atlases with configurable animation curves.
- CSS2D/canvas overlay pool + camera shake module for hybrid FX.
- Event bridge wiring (armies, structures, resources, quests, UI) to new system.
- Debug/telemetry hooks (`activeFxCount`, pool usage, dropped FX warnings).
- Migration checklist + documentation for designers/developers to add new FX profiles.
