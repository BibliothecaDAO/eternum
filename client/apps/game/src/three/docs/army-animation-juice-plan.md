# Army Animation Juice Pass Plan

This plan targets the army animation system in `managers/army-model.ts` with minimal new assets, scalable to hundreds or thousands of units, and aligned with current instanced morph-target animation.

## Scope
- In-place animation playback (idle/moving) driven by instanced morph targets.
- Movement update loop and per-instance transforms.
- Lightweight VFX and camera hooks for impact.
- LOD gating based on camera view and distance.

## Assumptions / Inputs Needed
- Target unit counts (n) per scene and expected FPS per device tier.
- Whether attack/hit/death events exist (or how to hook them from combat logic).
- Desired march/run cadence (BPM target) and typical movement speed.
- Confirmation that all unit clips are in-place and share a comparable stride cycle length.

## Plan Overview (Ordered)
1) De-sync layer (primary fix for army sync)
2) Timing/impact layer (anticipation -> contact -> follow-through)
3) Secondary motion (micro-variation + weight)
4) VFX hooks + pooling (impact layer)
5) LOD gates (keep performance stable as n grows)

## Step 1: De-sync Layer
Goal: Break chorus-line sync and restore organic rhythm.

Changes
- Add per-instance arrays in `managers/army-model.ts` keyed by matrix index:
  - `phaseOffset: Float32Array`
  - `tempoScale: Float32Array`
  - `squadOffset: Float32Array`
  - `accentSeed: Uint8Array` (0/1 flag)
- Seed values once on slot allocation or instance update using a stable hash of `entityId`.
- Increase `ANIMATION_BUCKETS` from 10 to 16 or 24 in `constants/army-constants.ts`.
- Use `clip.duration` and per-instance phase in `updateModelAnimations`:
  - `phase = (time * tempoScale + phaseOffset + squadOffset) % 1`
  - `sampleTime = phase * clip.duration`
- Add a group wave offset using either entityId-derived squads or a cheap position hash.

Scaling
- CPU: O(n_visible * morphCount) remains the same; phase computation adds O(n_visible) arithmetic.
- Memory: + ~16KB to 64KB for arrays at `MAX_INSTANCES = 1000`.

Expected payoff
- Immediate desync and more legible formation movement at all scales.

## Step 2: Timing and Impact Layer
Goal: Add anticipation and contact readability without new clips.

Changes
- Add a phase warp function to hold near contact frames:
  - Example: clamp or ease phase in a small window around 0.5 (contact).
  - Use fast-in for anticipation and longer out for follow-through.
- Add a short start blend when movement begins in `setAnimationState`:
  - Ramp moving weight from 0 to 1 over ~0.15s (per instance).
- If attack/hit events exist, add a brief time spike:
  - `tempoScale = base * 1.2` for 1-2 frames into contact, then ease out.

Scaling
- CPU: O(n_visible) for per-instance phase warp; blend ramps only on state changes.
- Memory: +1 Float32Array for per-instance blend weights if needed.

Expected payoff
- Stronger motion beats and clearer intent (march vs charge).

## Step 3: Weight and Secondary Motion
Goal: Remove floatiness and add subtle life with minimal cost.

Changes
- Replace or reduce `FLOAT_HEIGHT` (currently 0.5) with stride-phase bob:
  - Use a sharp downbeat curve: `bob = -abs(sin(phase * TAU)) * bobAmp`.
  - Add small lift on the upswing if needed.
- Add turn lean and micro sway in `updateRotation`:
  - `leanZ = clamp(turnRate) * leanAmp`.
  - `swayX = sin(time * freq + phaseOffset) * swayAmp`.
- Add idle breathing: scale or y-offset modulation when `ANIMATION_STATE_IDLE`.

Scaling
- CPU: O(n_moving) for bob/lean, O(n_visible_idle) for breathing.
- Memory: reuses phase offsets; no extra buffers required.

Expected payoff
- More grounded steps and a more alive idle state without new bones or IK.

## Step 4: Impact VFX and Camera Hooks
Goal: Add punch on footfalls, hits, and deaths with pooled effects.

Changes
- Add a small batched particle system in `managers/fx-manager.ts`:
  - Dust puff on strong downbeats (1 in 8 accents).
  - Hit spark on attack contact (when available).
- Hook effects from `managers/army-manager.ts` using callbacks from `ArmyModel`.
  - Example: `onBeat(entityId, worldPos)` and `onAttackContact(...)`.
- Add a subtle camera kick in `scenes/hexagon-scene.ts` for close view:
  - 1-2 frame impulse, max 0.2-0.4 world units, no nausea.
- Optional: small emissive pulse on impact if material supports it.

Scaling
- CPU: O(events), not O(n). 
- GPU: O(particles); pooled and capped (e.g., 200-400 total).

Expected payoff
- Big game-feel boost with tight scaling.

## Step 5: LOD Gates
Goal: Keep juice without FPS loss at high n.

Changes
- Use `AnimationVisibilityContext` and `CameraView` for LOD in `updateAnimations`:
  - Near: full buckets, phase warp, secondary motion, VFX enabled.
  - Mid: half buckets, no phase warp, limited secondary motion.
  - Far: freeze animation at a single frame or low-frequency update; no secondary.
- Apply stricter update throttling in `getAnimationUpdateFrequency` for far.
- Stop updating idle states beyond max distance.

Scaling
- CPU: reduces to O(n_near + n_mid + n_far / k) where k is throttling factor.
- GPU: fewer morph texture updates and lower particle load.

Expected payoff
- Stable FPS with consistent close-up quality.

## Implementation Notes (Where)
- `constants/army-constants.ts`
  - `ANIMATION_BUCKETS` increase (16-24).
- `types/army.ts`
  - Extend `ModelData` if per-model animation config is needed.
- `managers/army-model.ts`
  - Add arrays for phase/tempo/squad/accent.
  - Seed values in `allocateInstanceSlot` or `updateInstance`.
  - Apply phase and tempo in `updateModelAnimations`.
  - Replace float height with stride-phase bob in `updateMovingInstance`.
  - Add optional callbacks: `onBeat`, `onAttackContact`.
- `managers/army-manager.ts`
  - Subscribe to `ArmyModel` callbacks and call `FXManager`.
- `managers/fx-manager.ts`
  - Add batched dust/spark systems or extend the existing batched system.
- `scenes/hexagon-scene.ts`
  - Add `cameraKick` helper (optional, gated by `CameraView.Close`).

## LOD Tiers (Concrete)
- Near (<= 25m): bucketStride = 1, phaseWarp = on, secondary = on, VFX = on.
- Mid (25-60m): bucketStride = 2, phaseWarp = off, secondary = minimal, VFX = on (reduced).
- Far (> 60m): bucketStride >= 4, freeze idle, update moving at 5-10Hz, VFX = off.

Scaling: O(n_near + n_mid + n_far / 4) per frame for animation updates.

## Validation Checklist
- Visual: no synchronized rows, readable march cadence, stronger contact beats.
- Motion: reduced foot sliding; downbeats align with movement speed.
- Performance: FPS stable with 500-1000 units; morph updates lower in far view.
- VFX: dust/sparks never exceed pool; no frame spikes on mass movement.

## Risks / Mitigations
- Risk: phase warp causes jitter if clips have inconsistent timing.
  - Mitigation: only warp moving clip, test per model type.
- Risk: added per-instance noise causes instability in far view.
  - Mitigation: disable secondary motion for mid/far LOD.
- Risk: VFX spam on large battles.
  - Mitigation: per-squad accent gating and global rate limit.
