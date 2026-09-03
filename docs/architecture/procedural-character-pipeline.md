# Procedural character pipeline and promotion runbook

Use this guide when replacing a humanoid GLB, adding a rigged character family, changing procedural motion, or promoting
a gym character into the world map. The detailed visual rubric is in [Animation evaluation](./animation-evaluation.md);
the numeric walk/run targets are in [Adult human gait targets](./procedural-human-gait-parameter-research.md); the
capture controls are in [Procedural animation frame inspector](./procedural-animation-frame-inspector.md); the 100-unit
gate is in [Procedural character performance evaluation](./procedural-character-performance-evaluation.md).

## Mental model

The GLB supplies the **surface**: skinned mesh, rest skeleton, skin weights, materials, and textures. It intentionally
supplies no animation clips. The runtime supplies the **motion**:

```text
unit config
  -> gait/action controllers
  -> deterministic phase + planted contacts
  -> character-space joint targets
  -> pose filtering
  -> two-bone IK + rest-pose bone binding
  -> active skinned GLB + equipment sockets

current rendered pose -> Jolt bodies/constraints on ragdoll edge -> same skinned GLB
```

The gym and game both construct
[`ProceduralUnitRuntime`](../../apps/game/src/three/characters/procedural-unit-runtime.ts). The gym is an isolated
caller, not a second animation implementation. In the game, `ArmyModel` owns the authoritative root transform;
procedural animation only poses the local skeleton. Presentation collisions may add a bounded visual offset. Jolt is
created lazily for ragdolls and never decides movement, damage, or death.

Three identifiers have different jobs:

- `kind` selects behavior: archer, knight, crossbowman, horse, mounted Paladin, Sky Dragon, or naval ship;
- `tier` selects the T1/T2/T3 upgrade appearance;
- `appearanceId` selects a coexisting body/art family;
- `rigAdapterId` selects the skeleton convention that translates canonical joints into model bones.

Do not add a new `kind` for a visual-only variation or a fourth `tier` for an alternate art family.

## Ownership map

| Concern                                                    | Source of truth                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appearance/tier model and material selection               | [`procedural-character-appearance.ts`](../../apps/game/src/three/characters/procedural-character-appearance.ts)                                                                                                                                                                                                                                                                                                              |
| Shared template loading and actor-local model replacement  | [`procedural-character-assets.ts`](../../apps/game/src/three/characters/procedural-character-assets.ts), [`quaternius-character-assets.ts`](../../apps/game/src/three/characters/quaternius-character-assets.ts)                                                                                                                                                                                                             |
| Canonical skeleton contract and adapters                   | [`humanoid-rig-adapter.ts`](../../apps/game/src/three/characters/humanoid-rig-adapter.ts), [`quaternius-humanoid-rig-adapter.ts`](../../apps/game/src/three/characters/quaternius-humanoid-rig-adapter.ts)                                                                                                                                                                                                                   |
| Horse appearance and shared asset templates                | [`procedural-horse-appearance.ts`](../../apps/game/src/three/characters/horse/procedural-horse-appearance.ts), [`procedural-horse-assets.ts`](../../apps/game/src/three/characters/horse/procedural-horse-assets.ts)                                                                                                                                                                                                         |
| Canonical horse rig contract and adapters                  | [`horse-rig-adapter.ts`](../../apps/game/src/three/characters/horse/horse-rig-adapter.ts), [`quaternius-horse-rig-adapter.ts`](../../apps/game/src/three/characters/horse/quaternius-horse-rig-adapter.ts)                                                                                                                                                                                                                   |
| Mounted-creature lifecycle consumed by the rider           | [`procedural-mount-actor.ts`](../../apps/game/src/three/characters/mount/procedural-mount-actor.ts), [`procedural-horse-mount-actor.ts`](../../apps/game/src/three/characters/mount/procedural-horse-mount-actor.ts)                                                                                                                                                                                                         |
| Dragon ground/flight pose, fire breath, and test avatar    | [`procedural-dragon-pose.ts`](../../apps/game/src/three/characters/dragon/procedural-dragon-pose.ts), [`procedural-dragon-fire-cycle.ts`](../../apps/game/src/three/characters/dragon/procedural-dragon-fire-cycle.ts), [`icy-dragon-assets.ts`](../../apps/game/src/three/characters/dragon/icy-dragon-assets.ts), [`procedural-dragon-avatar.ts`](../../apps/game/src/three/characters/dragon/procedural-dragon-avatar.ts) |
| Procedural morphology and Jolt part definitions            | [`procedural-character-rig.ts`](../../apps/game/src/three/characters/procedural-character-rig.ts)                                                                                                                                                                                                                                                                                                                            |
| Gait timing and contact cycles                             | [`procedural-character-gait.ts`](../../apps/game/src/three/characters/procedural-character-gait.ts)                                                                                                                                                                                                                                                                                                                          |
| Joint targets and upper-body composition                   | [`procedural-character-pose.ts`](../../apps/game/src/three/characters/procedural-character-pose.ts)                                                                                                                                                                                                                                                                                                                          |
| Root-aware foot planting and pose filtering                | [`procedural-plant-controller.ts`](../../apps/game/src/three/characters/procedural-plant-controller.ts), [`procedural-character-pose-filter.ts`](../../apps/game/src/three/characters/procedural-character-pose-filter.ts)                                                                                                                                                                                                   |
| Skeleton binding, IK, hands, sockets, and material styling | [`procedural-character-avatar.ts`](../../apps/game/src/three/characters/procedural-character-avatar.ts)                                                                                                                                                                                                                                                                                                                      |
| Humanoid animation/ragdoll lifecycle                       | [`procedural-character-runtime.ts`](../../apps/game/src/three/characters/procedural-character-runtime.ts)                                                                                                                                                                                                                                                                                                                    |
| Unit behavior, equipment, mounts, attacks                  | [`procedural-unit-runtime.ts`](../../apps/game/src/three/characters/procedural-unit-runtime.ts)                                                                                                                                                                                                                                                                                                                              |
| Gym scene and controls                                     | [`procedural-character-gym-renderer.ts`](../../apps/game/src/three/characters/gym/procedural-character-gym-renderer.ts), [`procedural-character-gym-view.tsx`](../../apps/game/src/ui/features/debug/procedural-character-gym-view.tsx)                                                                                                                                                                                      |
| Objective capture/evaluation                               | [`procedural-animation-capture.ts`](../../apps/game/src/three/characters/gym/procedural-animation-capture.ts), [`procedural-animation-evaluation.ts`](../../apps/game/src/three/characters/gym/procedural-animation-evaluation.ts)                                                                                                                                                                                           |
| Troop/tier mapping and production actors                   | [`procedural-army-character-layer.ts`](../../apps/game/src/three/characters/procedural-army-character-layer.ts)                                                                                                                                                                                                                                                                                                              |
| Atomic legacy-to-procedural handoff                        | [`procedural-army-representation.ts`](../../apps/game/src/three/characters/procedural-army-representation.ts)                                                                                                                                                                                                                                                                                                                |

Route a defect to its owner. Sliding belongs to planting; robotic timing to gait/action curves; wrong elbows or feet to
pose/IK binding; wrong grips to hands/sockets/equipment; exploding deaths to the Jolt rig. Avoid compensating for a bad
asset bind pose by distorting every animation.

## Asset contract

The fastest onboarding path is to export the new mesh on the existing humanoid skeleton. A generic T-pose is not enough:
it must be skinned and satisfy one registered `HumanoidRigAdapter`. The avatar itself is skeleton-agnostic.

The runtime GLB must have:

- a skinned mesh with valid inverse bind matrices and normalized weights;
- an upright T-pose, `+Y` up, `+Z` procedural forward, pelvis above both ankles, and applied object scale;
- no authored animation clips;
- every bone mapped by its registered adapter. For `quaternius-universal`, that means `root`, `pelvis`, `spine_01..03`,
  `neck_01`, `Head`, `upperarm_*`, `lowerarm_*`, `hand_*`, `thigh_*`, `calf_*`, `foot_*`, and `ball_*`, where `*` is `l`
  or `r`;
- the adapter's complete thumb, index, middle, ring, and pinky chains. `quaternius-universal` uses `01..03` on both
  hands, for example `index_02_l`;
- embedded runtime textures in WebP and license/provenance beside the model.

The current `quaternius-universal` adapter owns the bone names, parent-to-child segment bindings, diagnostic joints,
palm planes, finger chains/axes, feet, semantic sockets, hand-roll correction, and rest-frame axes. Appearance
definitions independently own material roles, merge eligibility, and crowd mesh policy, so models sharing a skeleton do
not need identical material names. The Quaternius asset pack separately owns its base-head composition: `Eyebrows`,
`Eyes`, and `SuperHero_Male` are attached to outfit templates under `Armature`. Rest-segment orientation is derived from
bind directions, so local axes need not be copied blindly.

Inspect an export before wiring it:

```bash
pnpm --dir apps/game exec gltf-transform inspect ../../public/models/characters/<family>/<model>.glb
```

Completion criterion: the asset is self-contained, licensed, clip-free, skinned, upright, forward-facing, and every
runtime-required bone resolves without an alias or silent fallback.

## Choose one onboarding lane

### Same-skeleton replacement

Use this for a new T1/T2/T3 outfit on the existing body:

1. Add the optimized GLB and provenance under `apps/game/public/models/characters/<family>/`.
2. Add it to `QUATERNIUS_CHARACTER_ASSETS` and map the appropriate tier in `PROCEDURAL_CHARACTER_APPEARANCES`.
3. Extend `quaternius-character-assets.test.ts` for the file, skin, clips, textures, adapter bones, and license.
4. Keep `appearanceId` independent from tier: T1/T2/T3 remain upgrade stages within a family.

No gait, pose, gym renderer, or game renderer should be copied. Selection by `appearanceId + tier` flows through the
shared library and replaces only the actor-local model; decoded geometry and textures remain shared.

### New coexisting character family or skeleton

1. Add the asset templates and provenance to the central library.
2. If the bones match an existing convention, reuse its `rigAdapterId`. Otherwise add one adapter containing every
   canonical part, segment child, diagnostic joint, palm/finger definition, foot/toe, semantic socket, and axis
   correction; register it in `humanoid-rig-adapters.ts`.
3. Add an `appearanceId` and tier-to-asset mapping in `procedural-character-appearance.ts`.
4. Extend adapter, asset, config-normalization, and appearance-resolution tests. Missing mappings or bones must fail at
   load rather than silently falling back.
5. Select it in the gym and capture it with `--appearance-id` and `--tier`.

Completion criterion: both families alternate before and after Jolt ragdoll without reloading decoded assets, leaking
actor-local skeleton/material resources, changing behavior, or introducing family branches in gait/action code.

### New horse appearance or skeleton

1. Add the optimized horse GLB and provenance under `apps/game/public/models/characters/<family>/`, then register one
   `ProceduralHorseAssetDefinition` in the shared template loader.
2. Reuse an existing `HorseRigAdapterId` when the semantic skeleton matches. Otherwise add one adapter containing the
   axial bones, ordered neck and tail chains, all four limb chains, hoof/contact targets, canonical segment roles, and
   saddle derivation; register it in `horse-rig-adapters.ts`.
3. Add an independent appearance id, tier-to-asset mapping, material-role profile, and required adapter in
   `procedural-horse-appearance.ts`.
4. Extend adapter validation, appearance resolution, asset isolation/disposal, config normalization, source-file
   provenance, and GLB bone/skin tests. A missing adapter, asset, bone, invalid scene scale, or adapter mismatch must
   fail before an actor is visible.
5. Keep gait, planting, pose filtering, mounted coupling, and Jolt code unchanged. The runtime replaces only the
   actor-local horse avatar while decoded geometry remains shared.

Completion criterion: two horse appearances can alternate by `appearanceId + tier`, preserve the same procedural pose
and saddle contract, survive mounted Jolt handoff/reset, and report their actual appearance, asset, and rig adapter ids.

### New dragon appearance or skeleton

Keep dragon behavior in `dragon/`: ground gait, flight phase, fire-breath cycle, collision reaction, and socket output
are asset-independent. The current visible surface is the CC BY 4.0 Icy Dragon glTF. Its authored clip is discarded
immediately after validation; idle, walk, flight, leg planting, wings, neck, tail, jaw, and fire timing are driven by
the procedural pose pipeline. The adapter maps its opaque 88-joint source skeleton into the shared body, neck, head,
jaw, bilateral wing, four-limb, tail, saddle, and mouth contract. The seven supplied textures are delivered at 1024 ×
1024, and the source attribution plus Eternum's modifications live beside the model under
`apps/game/public/models/characters/icy-dragon/`.

Icy Dragon actor meshes never cast real-time shadows. Six skinned meshes and roughly 134,000 triangles make an animated
shadow pass too expensive for the crowd path; use a cheap contact/blob shadow and introduce a lower-detail geometry LOD
before increasing the number of simultaneous production dragons.

In production presentation, a tier-three Paladin uses the Sky Dragon mount form. The authoritative army movement flag
requests flight: the procedural runtime takes off, remains airborne along the existing map path, and lands when movement
ends. Stationary and walking review poses align the lowest semantic stance foot to sampled terrain; overall mesh bounds
must not decide ground contact.

Completion criterion: the replacement passes walk, flight, fire-breath, collision, drop/reset, capture, and crowd
simulation tests while the rider-facing mount and unit interfaces remain unchanged.

Add a new `ProceduralUnitKind` only when the unit has different behavior. In that case, also wire its controller and
equipment in `ProceduralUnitRuntime`, its control in `PROCEDURAL_UNIT_KINDS`, and its deterministic capture sequence.

## Gym integration and evaluation loop

Start the client and open `https://127.0.0.1:4174/debug/procedural-characters`:

```bash
pnpm --dir apps/game dev --host 127.0.0.1 --port 4174 --mode appchain.blitz
```

In the gym, prove idle, walk, run, the applicable attack/carry pose, Drop, Impulse, Reset, tier/appearance switching,
wireframe/joints, and both renderer backends. Fix the adapter until the bind pose and sockets are correct; tune motion
only after the same pose is correct from all five diagnostic views.

Capture spatial and temporal evidence with the same seed and config:

```bash
pnpm --dir apps/game capture:character-animation -- \
  --base-url https://127.0.0.1:4174 \
  --appearance-id <family> --tier 3 \
  --kind knight --motion-mode walk --sequence locomotion-cycle \
  --sampling phase-atlas --overlay diagnostic \
  --output-dir ../../../output/animation-evaluation/<family>-knight-walk-atlas

pnpm --dir apps/game capture:character-animation -- \
  --base-url https://127.0.0.1:4174 \
  --appearance-id <family> --tier 3 \
  --kind knight --motion-mode walk --sequence locomotion-cycle \
  --sampling all-frames --overlay clean \
  --output-dir ../../../output/animation-evaluation/<family>-knight-walk-temporal
```

Repeat for every affected kind, gait, tier, weapon/offhand, and mounted variant. Reports and frames belong under
`output/`, which is ignored. Evaluate them against `animation-evaluation.md`: zero hard-gate failures, every dimension
at least `3.0`, and weighted score at least `3.8`. Record the exact configuration, evidence, scores, and decision in
that document; a passing JSON report does not replace visual review.

Run the gym lifecycle proof after the captures:

```bash
pnpm --dir apps/game smoke:character-gym -- \
  --base-url https://127.0.0.1:4174 --renderer-mode webgpu-force-webgl --headed
```

Repeat without `--renderer-mode` to exercise WebGPU where the browser supports it.

Completion criterion: deterministic atlas and all-frame reruns pass, the action reads at the gameplay camera, Jolt
starts from the rendered pose, and the scored review says `promote`.

## Promote to the game

Production mapping lives only in `resolveUnitConfig()` inside `procedural-army-character-layer.ts`. Today it maps game
tier `T1/T2/T3` to visual tier `1/2/3`, Paladins to the mounted actor, Crossbowman T2 to the crossbow actor, other
Crossbowman tiers to the archer actor, and remaining land troops to the knight actor. Boats stay on their dedicated
legacy model.

To promote a new family:

1. Select its `appearanceId` there from an authoritative presentation fact such as troop category, tier, or resolved
   cosmetic. Keep `renderDetail: "crowd"` in production.
2. Preserve `ArmyManager -> ProceduralArmyCharacterLayer -> ProceduralUnitRuntime`; do not instantiate a second runtime
   in `ArmyManager`.
3. Preserve the atomic fallback handoff: the legacy actor and its owned attachments remain visible until the procedural
   actor is ready.
4. Keep equipment on semantic sockets. Extend cosmetic-to-loadout mapping rather than adding transforms at game call
   sites.
5. Keep combat authoritative: animation release/contact callbacks trigger presentation only; RECS/game events decide
   health, death, and removal.
6. Cover mapping, creation/update/disposal, fallback visibility, selection/raycasting, attacks, defeat, ragdoll, and
   respawn in the army-layer and representation tests.

Then run the production crowd gate:

```bash
pnpm --dir apps/game benchmark:procedural-characters -- \
  --base-url https://127.0.0.1:4174 \
  --appearance-id <family> \
  --renderer-mode webgpu-force-webgl --headed \
  --output output/procedural-character-performance.json

pnpm --dir apps/game smoke:character-benchmark -- \
  --base-url https://127.0.0.1:4174 \
  --renderer-mode webgpu-force-webgl --headed
```

Promotion is complete only when 100 visible walking actors meet the documented 60 FPS gate, the mixed lifecycle smoke
passes, browser errors are empty, and the legacy fallback still covers loading or failure.

## Minimum verification

```bash
pnpm --dir apps/game test \
  src/three/characters/humanoid-rig-adapter.test.ts \
  src/three/characters/procedural-character-appearance.test.ts \
  src/three/characters/quaternius-character-assets.test.ts \
  src/three/characters/procedural-character-rig.test.ts \
  src/three/characters/procedural-army-character-layer.test.ts \
  src/three/characters/procedural-army-representation.test.ts
pnpm --dir apps/game typecheck:character-gym
pnpm run format
pnpm run knip
```

Add the focused tests for every touched gait, action, equipment, adapter, and Jolt file. The change is done when the
asset contract, gym evidence, aesthetic gate, production mapping, lifecycle smoke, and performance gate all agree on the
same character configuration.
