# Procedural character pipeline and promotion runbook

Use this guide when replacing a humanoid GLB, adding a rigged character family, changing procedural motion, or promoting
a gym character into the world map. The detailed visual rubric is in [Animation evaluation](./animation-evaluation.md);
the capture controls are in [Procedural animation frame inspector](./procedural-animation-frame-inspector.md); the
100-unit gate is in [Procedural character performance evaluation](./procedural-character-performance-evaluation.md).

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
[`ProceduralUnitRuntime`](../../client/apps/game/src/three/characters/procedural-unit-runtime.ts). The gym is an
isolated caller, not a second animation implementation. In the game, `ArmyModel` owns the authoritative root transform;
procedural animation only poses the local skeleton. Presentation collisions may add a bounded visual offset. Jolt is
created lazily for ragdolls and never decides movement, damage, or death.

Three identifiers have different jobs:

- `kind` selects behavior: archer, knight, crossbowman, horse, or mounted Paladin;
- `tier` selects the T1/T2/T3 upgrade appearance;
- a future `appearanceId` selects a coexisting body/art family. It must remain independent of behavior and tier.

Do not add a new `kind` for a visual-only variation or a fourth `tier` for an alternate art family.

## Ownership map

| Concern                                                    | Source of truth                                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GLB URLs, load/clone/dispose, asset validation             | [`quaternius-character-assets.ts`](../../client/apps/game/src/three/characters/quaternius-character-assets.ts)                                                                                                                                        |
| Procedural morphology and Jolt part definitions            | [`procedural-character-rig.ts`](../../client/apps/game/src/three/characters/procedural-character-rig.ts)                                                                                                                                              |
| Gait timing and contact cycles                             | [`procedural-character-gait.ts`](../../client/apps/game/src/three/characters/procedural-character-gait.ts)                                                                                                                                            |
| Joint targets and upper-body composition                   | [`procedural-character-pose.ts`](../../client/apps/game/src/three/characters/procedural-character-pose.ts)                                                                                                                                            |
| Root-aware foot planting and pose filtering                | [`procedural-plant-controller.ts`](../../client/apps/game/src/three/characters/procedural-plant-controller.ts), [`procedural-character-pose-filter.ts`](../../client/apps/game/src/three/characters/procedural-character-pose-filter.ts)              |
| Skeleton binding, IK, hands, sockets, and material styling | [`procedural-character-avatar.ts`](../../client/apps/game/src/three/characters/procedural-character-avatar.ts)                                                                                                                                        |
| Humanoid animation/ragdoll lifecycle                       | [`procedural-character-runtime.ts`](../../client/apps/game/src/three/characters/procedural-character-runtime.ts)                                                                                                                                      |
| Unit behavior, equipment, mounts, attacks                  | [`procedural-unit-runtime.ts`](../../client/apps/game/src/three/characters/procedural-unit-runtime.ts)                                                                                                                                                |
| Gym scene and controls                                     | [`procedural-character-gym-renderer.ts`](../../client/apps/game/src/three/characters/gym/procedural-character-gym-renderer.ts), [`procedural-character-gym-view.tsx`](../../client/apps/game/src/ui/features/debug/procedural-character-gym-view.tsx) |
| Objective capture/evaluation                               | [`procedural-animation-capture.ts`](../../client/apps/game/src/three/characters/gym/procedural-animation-capture.ts), [`procedural-animation-evaluation.ts`](../../client/apps/game/src/three/characters/gym/procedural-animation-evaluation.ts)      |
| Troop/tier mapping and production actors                   | [`procedural-army-character-layer.ts`](../../client/apps/game/src/three/characters/procedural-army-character-layer.ts)                                                                                                                                |
| Atomic legacy-to-procedural handoff                        | [`procedural-army-representation.ts`](../../client/apps/game/src/three/characters/procedural-army-representation.ts)                                                                                                                                  |

Route a defect to its owner. Sliding belongs to planting; robotic timing to gait/action curves; wrong elbows or feet to
pose/IK binding; wrong grips to hands/sockets/equipment; exploding deaths to the Jolt rig. Avoid compensating for a bad
asset bind pose by distorting every animation.

## Asset contract

The fastest onboarding path is to export the new mesh on the existing humanoid skeleton. A generic T-pose is not enough:
the current avatar is a Quaternius-specific adapter.

The runtime GLB must have:

- a skinned mesh with valid inverse bind matrices and normalized weights;
- an upright T-pose, `+Y` up, `+Z` procedural forward, pelvis above both ankles, and applied object scale;
- no authored animation clips;
- `root`, `pelvis`, `spine_01..03`, `neck_01`, `Head`, `upperarm_*`, `lowerarm_*`, `hand_*`, `thigh_*`, `calf_*`, and
  `foot_*` bones, where `*` is `l` or `r`;
- `thumb`, `index`, `middle`, `ring`, and `pinky` chains numbered `01..03` on both hands, for example `index_02_l`;
- embedded runtime textures in WebP and license/provenance beside the model.

Current outfit assembly also expects base meshes named `Eyebrows`, `Eyes`, and `SuperHero_Male`, an `Armature` object on
outfits, identical skeleton name/order across tiers, Quaternius hand-roll/finger axes, and recognizable material names
for heraldry. Rest-segment orientation itself is derived from each parent-to-child bind direction, so local bone axes
need not be copied blindly.

Inspect an export before wiring it:

```bash
pnpm --dir client/apps/game exec gltf-transform inspect ../../public/models/characters/<family>/<model>.glb
```

Completion criterion: the asset is self-contained, licensed, clip-free, skinned, upright, forward-facing, and every
runtime-required bone resolves without an alias or silent fallback.

## Choose one onboarding lane

### Same-skeleton replacement

Use this for a new T1/T2/T3 outfit on the existing body:

1. Add the optimized GLB and provenance under `client/public/models/characters/<family>/`.
2. Change the relevant entry in `QUATERNIUS_CHARACTER_ASSETS`.
3. Extend `quaternius-character-assets.test.ts` for the file, skin, clips, textures, bones, and license.
4. Keep tier semantics intact: T1, T2, and T3 remain visible upgrade stages.

No gait, pose, gym renderer, or game renderer should be copied. Selection by `config.humanoid.tier` makes the
replacement flow through both callers.

### New coexisting character family

The current config has no family dimension and the avatar is Quaternius-specific. Add the seam before adding the art:

1. Add an `appearanceId` to `ProceduralCharacterConfig`, normalize it, and key loaded models by `appearanceId + tier`
   instead of tier alone.
2. Extract the hard-coded bone map, segment children, hand/finger axes, socket offsets, material roles, and optional
   head composition into one humanoid asset adapter. Keep one adapter per skeleton convention.
3. Make asset validation use that adapter. Replace hard-coded smoke expectations such as Ranger mesh count with the
   selected asset's declared contract.
4. Add an appearance selector to the gym controls and pass it through the existing config update path.
5. Add `--appearance-id` and `--tier` to the capture/smoke scripts so every new variant is reproducible without
   clicking. The current capture script otherwise starts on tier 3.

Completion criterion: both families can alternate in one gym session without reloading assets, leaking GPU resources,
changing behavior, or introducing family-specific branches in gait and action code.

Add a new `ProceduralUnitKind` only when the unit has different behavior. In that case, also wire its controller and
equipment in `ProceduralUnitRuntime`, its control in `PROCEDURAL_UNIT_KINDS`, and its deterministic capture sequence.

## Gym integration and evaluation loop

Start the client and open `https://127.0.0.1:4174/debug/procedural-characters`:

```bash
pnpm --dir client/apps/game dev --host 127.0.0.1 --port 4174 --mode appchain.blitz
```

In the gym, prove idle, walk, run, the applicable attack/carry pose, Drop, Impulse, Reset, tier/appearance switching,
wireframe/joints, and both renderer backends. Fix the adapter until the bind pose and sockets are correct; tune motion
only after the same pose is correct from all five diagnostic views.

Capture spatial and temporal evidence with the same seed and config:

```bash
pnpm --dir client/apps/game capture:character-animation -- \
  --base-url https://127.0.0.1:4174 \
  --kind knight --motion-mode walk --sequence locomotion-cycle \
  --sampling phase-atlas --overlay diagnostic \
  --output-dir ../../../output/animation-evaluation/<family>-knight-walk-atlas

pnpm --dir client/apps/game capture:character-animation -- \
  --base-url https://127.0.0.1:4174 \
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
pnpm --dir client/apps/game smoke:character-gym -- \
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
pnpm --dir client/apps/game benchmark:procedural-characters -- \
  --base-url https://127.0.0.1:4174 \
  --renderer-mode webgpu-force-webgl --headed \
  --output output/procedural-character-performance.json

pnpm --dir client/apps/game smoke:character-benchmark -- \
  --base-url https://127.0.0.1:4174 \
  --renderer-mode webgpu-force-webgl --headed
```

Promotion is complete only when 100 visible walking actors meet the documented 60 FPS gate, the mixed lifecycle smoke
passes, browser errors are empty, and the legacy fallback still covers loading or failure.

## Minimum verification

```bash
pnpm --dir client/apps/game test \
  src/three/characters/quaternius-character-assets.test.ts \
  src/three/characters/procedural-character-rig.test.ts \
  src/three/characters/procedural-army-character-layer.test.ts \
  src/three/characters/procedural-army-representation.test.ts
pnpm --dir client/apps/game typecheck:character-gym
pnpm run format
pnpm run knip
```

Add the focused tests for every touched gait, action, equipment, adapter, and Jolt file. The change is done when the
asset contract, gym evidence, aesthetic gate, production mapping, lifecycle smoke, and performance gate all agree on the
same character configuration.
