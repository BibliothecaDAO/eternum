# Procedural longbow archer and projectile pipeline

Status: research and implementation proposal  
Date: 2026-08-22  
Scope: Three.js procedural animation, Jolt WASM collision/reaction, world-map presentation, gym tooling, and the
existing Dojo/RECS authority model. No production code is changed by this document.

## Executive decision

Build a **longbow archer as a new visual `ProceduralUnitKind`**, but **do not add a new onchain `TroopType`**.

The protocol already defines `TroopType.Crossbowman` as the ranged family with attack range 2, while the client already
names its T1 member “Archer,” T2 “Crossbowman,” and T3 “Beast Hunter”
([troop.cairo](../../contracts/game/src/models/troop.cairo), [army.ts](../../packages/core/src/utils/army.ts)).
Production presentation should therefore resolve the family by tier:

- `Crossbowman + T1 -> archer` (longbow shot cycle)
- `Crossbowman + T2 -> crossbowman` (trigger/reload cycle)
- `Crossbowman + T3 -> archer` initially (heavy beast bow), with the exact weapon remaining an art-direction choice

This preserves every existing combat rule and transaction shape while giving the renderer the distinct behavior it
needs. A fourth protocol troop category would require contract, resource, balance, UI, indexer, and migration work with
no gameplay requirement to justify it. The contract currently grants only Crossbowmen range 2 and applies special
range-2 damage, stamina, counter-damage, and cooldown semantics
([troop.cairo](../../contracts/game/src/models/troop.cairo),
[troop_battle.cairo](../../contracts/game/src/systems/combat/contracts/troop_battle.cairo)).

The system should have three deliberately separate responsibilities:

1. **`ProceduralArcherController`** owns shot state and close-LOD upper-body pose.
2. **`ArrowProjectileSystem`** owns bounded, pooled, instanced visual arrows and swept collision.
3. **`RangedCombatPresentationCoordinator`** converts provisional attack intent, indexed battle events, and
   authoritative RECS changes into idempotent presentation commands.

Arrows are cosmetic witnesses of combat, not combat entities. The Cairo system decides range, damage, stamina, winner,
and state changes; the client may predict and replay a volley but must never apply damage from a local arrow hit. This
follows this repository's entity/event guardrail: current facts come from RECS entities, while events accelerate
transient flourishes ([repository AGENTS.md](../../AGENTS.md),
[model-manifest.ts](../../packages/core/src/sync/model-manifest.ts)). It also follows the proven networking division
described by Valve and GDC production talks: responsive local weapon presentation can be predicted while the authority
remains responsible for gameplay state
([Bernier, _Latency Compensating Methods in Client/Server In-game Protocol Design_](https://media.gdcvault.com/GD_Mag_Archives/GDM_June_2001.pdf),
[Reed, _Networking Scripted Weapons and Abilities in Overwatch_](https://gdcvault.com/play/1024653/Networking-Scripted-Weapons-and-Abilities)).

## What exists in Eternum now

### Character and physics seams

The shared procedural runtime currently supports `knight`, `crossbowman`, `horse`, and `paladin`; a foot unit is a
procedural humanoid plus lightweight equipment
([procedural-unit-config.ts](../../client/apps/game/src/three/characters/procedural-unit-config.ts),
[procedural-unit-runtime.ts](../../client/apps/game/src/three/characters/procedural-unit-runtime.ts)). The existing
Crossbowman:

- receives the same walk/idle procedural body pose as other foot units, with reduced arm swing;
- gets a crude procedural crossbow positioned between `hand_l` and `hand_r`;
- has no shot controller, target, bow/string state, socket API, arrow, or projectile lifecycle.

Those facts are visible in
[procedural-unit-runtime.ts](../../client/apps/game/src/three/characters/procedural-unit-runtime.ts) and
[procedural-unit-equipment.ts](../../client/apps/game/src/three/characters/procedural-unit-equipment.ts).

The humanoid asset is capable of a substantially better archer pose. It contains `spine_01`, `spine_02`, `spine_03`,
`neck_01`, left/right upper arms, lower arms, hands, and finger bones
([quaternius-character-assets.ts](../../client/apps/game/src/three/characters/quaternius-character-assets.ts)). The
current abstract rig, however, exposes one chest segment and two arm segments per side, and the avatar reapplies a fixed
hand-roll correction after every pose
([procedural-character-rig.ts](../../client/apps/game/src/three/characters/procedural-character-rig.ts),
[procedural-character-avatar.ts](../../client/apps/game/src/three/characters/procedural-character-avatar.ts)). A
convincing draw therefore requires an explicit hand-orientation/socket seam and distributed spine aim, not only new
scalar parameters.

Jolt is currently one shared fixed-step world containing a static ground body and ragdoll bodies. It exposes ragdoll
creation, center-of-mass impulses, transforms, and statistics, but no public ray/shape query, body-to-entity metadata,
or impulse-at-contact API ([jolt-ragdoll-world.ts](../../client/apps/game/src/three/characters/jolt-ragdoll-world.ts)).
The installed `jolt-physics` package is the official Emscripten port and exposes `NarrowPhaseQuery`, ray collectors,
shape-cast collectors, contact listeners, and `EMotionQuality_LinearCast`; the port explicitly says its interface
mirrors the C++ API and that Emscripten allocations require manual destruction
([JoltPhysics.js README](https://github.com/jrouwe/JoltPhysics.js/),
[JoltJS bindings](https://github.com/jrouwe/JoltPhysics.js/blob/main/JoltJS.h)).

### The art assets already support an archer

The cosmetics registry already assigns a Hunter's Bow and Hunter's Quiver to the `TroopType.Crossbowman` family
([registry.ts](../../client/apps/game/src/three/cosmetics/registry.ts),
[cosmetics.data.ts](../../client/apps/game/src/ui/features/cosmetics/config/cosmetics.data.ts)). The checked-in files
are:

- `client/public/models/cosmetics/low-res/0x205010901.glb` — Hunter's Bow
- `client/public/models/cosmetics/low-res/0x206010a01.glb` — Hunter's Quiver

The bow is one static mesh node with no skin or animation, and the quiver is also static. Consequently, the bow can be
used immediately for silhouette/material fidelity, but its limbs cannot be animated by rotating child nodes. A close-LOD
deformation pass needs either an authored bow with separate riser/limb/tip sockets, a controlled vertex deformation, or
a segmented procedural replacement. The clean path is:

1. use the existing Hunter's Bow and quiver in production from the first slice;
2. use a generated segmented bow as the gym fallback and for validating mechanics;
3. later reauthor the production bow with `grip`, `upper_tip`, `lower_tip`, and `arrow_rest` sockets instead of
   hard-coding bounds-derived points.

### Combat presentation and authority seams

There is no projectile entity or projectile system in the client or contracts. The closest existing seam is the
provisional world-map attack FX:

- Quick Attack and Battle Lab create a provisional intent and call
  `startWorldmapProvisionalFx({ kind: "attack", attackerHex, targetHex }, intent)` before submitting the transaction
  ([quick-attack-preview.tsx](../../client/apps/game/src/ui/features/military/battle/quick-attack-preview.tsx),
  [battle-lab.tsx](../../client/apps/game/src/ui/features/military/battle/battle-lab/battle-lab.tsx)).
- `Worldmap.startWorldmapProvisionalFx` currently creates attack/defense ground icons and removes them when the intent
  settles ([worldmap-provisional-fx.ts](../../client/apps/game/src/three/scenes/worldmap-provisional-fx.ts),
  [worldmap.tsx](../../client/apps/game/src/three/scenes/worldmap.tsx)).
- `BattleEvent` contains attacker/defender IDs and owners, winner, coordinate, reward, and timestamp in Cairo; the core
  parser currently omits the coordinate and exposes no damage/category/weapon data
  ([troop_battle.cairo](../../contracts/game/src/systems/combat/contracts/troop_battle.cairo),
  [world-update-listener.ts](../../packages/core/src/systems/world-update-listener.ts),
  [types.ts](../../packages/core/src/systems/types.ts)).
- Worldmap consumes the indexed event for combat relationships, direction indicators, camera follow, and notifications,
  not damage ([worldmap.tsx](../../client/apps/game/src/three/scenes/worldmap.tsx)).
- The authoritative `ExplorerTroops` entity update changes troop counts. `ArmyManager` derives the count delta from the
  RECS component and plays floating damage/heal FX; removing a zero-count army drives defeat FX
  ([army-manager.ts](../../client/apps/game/src/three/managers/army-manager.ts)).

This is already the correct truth hierarchy. The projectile work should extend the provisional and event-driven
presentation paths, not invent a parallel combat store.

## The target architecture

```text
                    gameplay authority
  user attack ───────────────► Cairo combat system
       │                               │
       │ provisional intent            │ indexed echo
       ▼                               ▼
 RangedCombatPresentationCoordinator ◄── BattleEvent
       │                               │
       ├── close actor action          └── dedupe / remote replay
       │   (pose + nock socket)
       ▼
 ArrowProjectileSystem ───────► impact / trail / stick / deflect FX
       │                                      │
       ├── logical swept hit proxies          └── optional Jolt impulse
       └── optional Jolt narrow-phase query

 ExplorerTroops / Structure RECS entity updates ─► authoritative counts,
 positions, removal, defeat, and reconciliation (never written by arrows)
```

The world-level projectile system must not depend on having a promoted articulated actor. Most armies remain ordinary
instances; they still need to fire a volley from a computed world muzzle. If a close actor exists, it supplies a live
`arrowNock` socket and plays the full shot cycle. This keeps the promoted character layer optional, as designed in
[procedural-army-character-layer.ts](../../client/apps/game/src/three/characters/procedural-army-character-layer.ts).

Recommended command boundary:

```ts
interface RangedVolleyPresentation {
  presentationId: string;
  sourceEntityId: ID;
  targetEntityId: ID;
  sourcePosition: Vector3;
  targetPosition: Vector3;
  style: ArrowStyle;
  seed: number;
  count: number;
  authority: "provisional" | "indexed-replay";
}
```

The coordinator resolves source/target positions and visual style once, then passes an immutable snapshot to the pose
and projectile systems. The projectile system never reaches into RECS and never calls gameplay actions.

## A believable longbow shot cycle

### One correction to the requested state order

For a grounded production shot, nock the arrow before raising the bow. World Archery's official beginner sequence places
arrow loading and string grip before body pre-position, bow raising, and pre-draw; it also describes synchronized hand
raising, a stable draw-hand anchor at the face, force alignment, aiming, release, and continued follow-through
([World Archery Level 1 course specification](https://extranet.worldarchery.sport/documents/index.php/?doc=6113),
[World Archery Beginner Manual](https://extranet.worldarchery.sport/documents/index.php/documents/?doc=825)).
Motion-capture research likewise separates set-up, draw, aim, release, and follow-through, with draw ending when the
string reaches the face and follow-through ending when an arm is first lowered
([Denardi et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10606362/)).

Most instrumented biomechanics research cited here studies modern recurve technique. Its phase structure, stabilization,
anticipation, and follow-through findings transfer to an animated longbow, but its clicker timing, exact anchor, and
loading must not be copied literally. World Archery's style-specific longbow module says the loose point is normally
reached with little or no hold and describes relaxed/straightening fingers that let the string pull free
([World Archery/FITA Level 2 Coaching Manual](https://documents.worldarchery.org/Coaches/Accreditation/Coaching_Levels/Coaching_Manual_Level2.pdf)).
That supports a brief, still-expanding longbow aim rather than a long rigid recurve hold.

Use this canonical graph:

```text
idle -> track -> nock -> raise -> draw -> anchor -> aim
                                               ├-> release -> followThrough -> recover -> track/idle
                                               └-> cancel  -> recover -> idle
any pre-release state + ragdoll/death -> abort -> ragdoll
```

If art direction insists on `raise -> nock`, treat those as an overlapping stylized `raiseNock` section: the arrow may
come out of the quiver while the bow begins to rise, but it must visibly contact the rest and string before draw starts.

### State responsibilities and initial tuning values

The values below are **gym starting points**, not measured universal human timings. Expose them as data and preserve
event boundaries even when durations are compressed.

| State           | Initial duration | Pose and ownership invariant                                                                                                         |
| --------------- | ---------------: | ------------------------------------------------------------------------------------------------------------------------------------ |
| `idle`          |        unbounded | Locomotion/breathing remains active; no live projectile.                                                                             |
| `track`         |      0.10–0.25 s | Actor/root turns toward target; upper-body aim weight rises only after feet are stable.                                              |
| `nock`          |      0.14–0.24 s | A preview arrow moves from quiver/hand to the bow rest; it belongs to the actor, not the projectile pool.                            |
| `raise`         |      0.18–0.32 s | Bow and draw hands rise together; shoulders stay visually down; target direction begins driving chest/head.                          |
| `draw`          |      0.36–0.70 s | Bow hand pushes toward the grip target; draw hand/string move continuously toward the face anchor; bow bend and draw weight ease in. |
| `anchor`        |      0.08–0.18 s | Draw hand converges to jaw/cheek socket; elbow and shoulder settle without freezing all secondary motion.                            |
| `aim`           |      0.25–0.90 s | Small bounded aim drift, breathing, and final expansion; no large pose noise.                                                        |
| `release`       |      0.04–0.08 s | Emit exactly one `release` edge, detach the arrow, snap the nock point forward, open draw fingers.                                   |
| `followThrough` |      0.22–0.45 s | Bow arm remains directed; draw hand continues back along the draw line; bow/string oscillation decays.                               |
| `recover`       |      0.25–0.50 s | Lower weapon and blend back to locomotion; do not teleport the arms.                                                                 |

Research supports the qualitative shape of this cycle: draw-arm and bow-arm muscles have distinct jobs during draw, with
bow-arm elbow extension and shoulder abduction stabilizing the bow while the draw side pulls the string
([Nedergaard et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10426064/)); elite archers exhibit anticipatory
postural adjustments before release and less variable bow motion
([Ko et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11235681/)); wrist, elbow, bow-arm, and draw-shoulder muscle
activity changes can begin before the arrow leaves the string
([Hennessy and Parker 1990](https://pubmed.ncbi.nlm.nih.gov/2303006/)). A short “final pull” during aim is also observed
in skilled recurve archers ([Edelmann-Nusser et al. 2006](https://doi.org/10.1080/17461390601012579)). Therefore,
release should be a prepared loss of string constraint followed by continuation of the existing force line—not an
isolated recoil keyframe.

The visible organic motion should be correlated, not random per bone. A biomechanical final push-pull study separated
low-frequency 0–5 Hz corrections from an 8–12 Hz tremor component
([Leroyer et al. 1993](https://doi.org/10.1080/02640419308729965)). Use filtered low-frequency correction shared by bow
hand, draw hand, chest, and center of mass; reserve extremely small 8–12 Hz tremor for close-camera/high-tension detail.
Independent broad noise on each effector will break the string constraint and read as nervous machinery.

### State-machine requirements

- Advance with a fixed logical step and normalized state time; render can interpolate between previous/current pose
  samples.
- Fire `onNock`, `onRelease`, and `onRecover` on state edges, never by checking a broad time interval each frame.
- Give every cycle an incrementing `shotGeneration`; only `(actorId, shotGeneration)` may release its preview arrow
  once.
- Cache the target snapshot at release. A non-homing arrow must not steer because the target later moves.
- If the target disappears before release, cancel into recover. If it disappears after release, continue toward the
  cached target point and let reconciliation determine the persistent outcome.
- Entering ragdoll before release returns the preview arrow; entering ragdoll after release does not destroy the world
  projectile.
- Permit an `aimHold` loop for the gym, but cap it in the live presentation so a provisional actor cannot stay
  permanently drawn when an intent fails.

### Longbow is not a renamed crossbow

Share targeting, projectile pooling, collision, impact, and authority reconciliation, but keep weapon action controllers
distinct:

| Concern       | Longbow archer                                                                       | Crossbowman                                                                               |
| ------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Energy cue    | Archer continuously bends limbs by pulling the live string                           | Weapon is already cocked/latches the string; firing hand uses a trigger                   |
| Upper body    | Wide asymmetric push-pull chain, draw hand anchored by face, draw elbow behind arrow | Stock shouldered/across torso, both hands support stock/trigger, much smaller hand travel |
| Release       | Fingers/string separate; draw hand continues backward; bow arm holds                 | Trigger edge, short stock recoil, no draw-hand follow-through                             |
| Between shots | Nock, raise, draw, brief loose point                                                 | Lower/brace, cock/reload bolt, reacquire; visibly longer mechanical reload                |
| Projectile    | Long arrow, more readable arc and possible shaft oscillation                         | Short bolt, flatter/faster-looking presentation                                           |

The current procedural crossbow can be retained as a placeholder silhouette, but it should eventually receive
`ProceduralCrossbowController`; it should not run the longbow arm solver with another mesh. Both controllers emit the
same `ArrowSpawnRequest` shape with a style discriminant (`arrow` versus `bolt`).

## Bow, hand, spine, and gaze solving

### Solve goals, not arm angles

The existing gait pipeline should remain responsible for feet, planted pelvis, and locomotion. The archer layer
contributes an upper-body action pose with these effectors:

- `bowGrip`: position and orientation for the bow hand;
- `drawHand`: position and orientation at the nock/anchor;
- `drawElbowPole`: bend hemisphere behind and slightly above the arrow line;
- `bowElbowPole`: bend hemisphere slightly outward, preventing elbow inversion;
- `headAim`: bounded head/gaze direction;
- `nock`: arrow/string point, equal to the draw-hand string point while drawing;
- `upperTip`, `lowerTip`, `arrowRest`: bow equipment sockets.

FABRIK is appropriate for the two three-joint arm chains because it solves end-effector positions iteratively without
matrix inversion and supports joint constraints, but its authors explicitly note that unconstrained IK can produce
unrealistic poses; pole hemispheres and anatomical limits remain required
([Aristidou and Lasenby 2011](https://doi.org/10.1016/j.gmod.2011.05.003),
[Aristidou et al. 2018](https://doi.org/10.1111/cgf.13310)). Eternum already uses constrained two-bone/FABRIK-style limb
construction for procedural characters and horses, so this extends rather than replaces the pipeline
([procedural-character-pose.ts](../../client/apps/game/src/three/characters/procedural-character-pose.ts),
[procedural-horse-pose.ts](../../client/apps/game/src/three/characters/horse/procedural-horse-pose.ts)).

For a right-handed archer:

1. Keep the left hand on the bow grip and the right hand on the string.
2. Rotate actor root toward target while stationary; clamp upper-body-only tracking when locomoting.
3. Distribute residual yaw/pitch over `spine_01`, `spine_02`, `spine_03`, and neck rather than rotating one chest block.
4. Define the anchor relative to the head/jaw socket, not world space, so head stabilization cannot pull the hand away
   from the face.
5. Solve the bow arm to the grip and the draw arm to the interpolated nock/anchor.
6. Recompute the actual arrow axis from nock through arrow rest, measure angular error to launch velocity, and run one
   correction iteration.
7. Solve hand rotations last: bow palm wraps the grip; draw fingers curl around the string during draw and open over the
   release interval.

Starting designer clamps should be deliberately conservative and visible in the gym: upper-body yaw ±50°, aim pitch −20°
to +45°, and a soft reach clamp at 98% of arm-chain length. These are art controls, not asserted anatomical limits. When
a target exceeds them, turn the root before increasing spine twist. That avoids the common “turret torso” look.

### Required avatar seam

Do not make equipment search and mutate arbitrary bones independently each frame. Add one socket/binding API owned by
the avatar:

```ts
type CharacterSocketId = "handLeft" | "handRight" | "jawAnchor" | "quiver" | "projectileOrigin";

interface CharacterSocketSnapshot {
  position: Vector3;
  quaternion: Quaternion;
}
```

`ProceduralCharacterAvatar` should resolve bones once when a model is prepared, expose allocation-free world transforms,
and accept optional hand/finger rotations from the action pose. This removes the current conflict in which
`applyHandRollCorrections()` overwrites an archer's hand orientation
([procedural-character-avatar.ts](../../client/apps/game/src/three/characters/procedural-character-avatar.ts)). It also
gives swords, crossbows, future spellcasting, and projectiles one systemic attachment seam.

### Blend with locomotion

Use semantic layers rather than separate whole-body poses:

- **Base:** idle/walk/run contact-driven pose.
- **Aim:** pelvis/root turn plus distributed spine/head target alignment.
- **Hands:** absolute bow-grip and draw-hand IK.
- **Secondary:** breathing, quiver motion, bow recoil, draw-hand follow-through.

Blend weights follow the shot state, but IK effectors are re-solved after blending. Linear interpolation of two
already-solved arm poses will generally break the hand-to-bow constraint; re-solving preserves contact. The same rule is
already implicit in Eternum's foot/hoof plant controller: world contacts must win over decorative motion
([procedural-plant-controller.ts](../../client/apps/game/src/three/characters/procedural-plant-controller.ts)).

## Bow, string, and arrow socketing

### Equipment hierarchy

```text
bowRoot (attached to bow hand)
├── visual / riser
├── upperLimb -> upperTip
├── lowerLimb -> lowerTip
├── arrowRest
├── stringUpper (upperTip -> nock)
└── stringLower (nock -> lowerTip)

previewArrow
├── shaft
├── head
└── fletching
```

At rest, the nock point lies near the arrow rest. During draw it follows the draw-hand string socket; the limb tips bend
toward it. The arrow is constrained by both the rest direction and nock point until the release edge, at which point its
world transform is copied into an `ArrowSpawnRequest` and it leaves the actor hierarchy.

Bow/arrow interaction is physically coupled: the drawn bow stores deformation energy, and during discharge the string,
arrow, grip/rest, and elastic limbs interact; real arrows also flex around the bow during launch
([Kooi 1991](https://doi.org/10.1007/BF00369887), [Kooi and Sparenberg 1997](https://doi.org/10.1023/A:1004262424363),
[Kooi 1998](https://pubmed.ncbi.nlm.nih.gov/10189077/)). A game does not need that full finite-difference model.
Preserve the cues players can see:

- draw amount bends both limbs and moves the center string point;
- release detaches the arrow at one exact edge;
- string and limbs overshoot and decay for roughly a few visible frames;
- a close arrow may receive a small decaying lateral shaft oscillation, but its center-of-mass trajectory remains the
  projectile path.

Make `drawFraction` the one source for hand separation, string nock position, limb bend, and launch energy. A gym-only
force/draw curve may compute stored energy and launch speed as

```text
E(d) = integral from 0 to d of F(x) dx
v0 = sqrt(2 efficiency E(d) / arrowMass)
```

This is the energy relationship used in mathematical bow-performance work
([Kooi and Bergman 1997](https://doi.org/10.1017/S0003598X00084611)). For the first live slice, every shot can use an
authored full-draw launch speed; the important invariant is that a half-drawn visual cannot emit a full-speed arrow. The
force/draw lookup remains a gym research control until gameplay calls for partial shots.

Do not rebuild `TubeGeometry` every frame. Three.js says geometry constructor parameters are not live, while dynamic
`BufferAttribute` values are intended to be updated and uploaded through `needsUpdate`/update ranges
([TubeGeometry](https://threejs.org/docs/pages/TubeGeometry.html),
[BufferAttribute](https://threejs.org/docs/pages/BufferAttribute.html)). Two practical options are:

- close LOD: two thin cylinders/instanced line segments from each tip to nock, which gives stable world-space thickness
  in WebGL2 and WebGPU;
- debug LOD: one three-point dynamic `BufferGeometry` line.

Plain line width is not a portable thickness control—Three.js documents that WebGL and WebGPU ignore `linewidth` and
render line primitives one pixel wide ([ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html)).
`Line2`/`LineGeometry` is available as an addon if screen-space thick debug lines are preferable
([LineGeometry](https://threejs.org/docs/pages/LineGeometry.html)).

### Existing asset strategy

The existing Hunter's Bow is the correct production visual starting point, but because it is a single static mesh, v1
should keep it rigid and animate the string; a small rigid bow with a convincing arm draw reads better than a visibly
broken deformation. The gym's generated bow can use three to seven transformable limb segments to expose draw/bend
controls. The art-ready asset contract should later require:

- separate riser and limb nodes or skin weights;
- `grip`, `arrow_rest`, `upper_tip`, `lower_tip` sockets;
- a consistent forward/up convention;
- a rest string/nock point;
- authored bounds and unit scale.

## Projectile flight

### Use a visual integrator, not one Jolt body per arrow

The optimal default is a compact kinematic projectile simulation with swept collision queries. It is cheaper to pool and
instance, easy to seed/replay, and does not require adding hundreds of short-lived bodies to the same Jolt world as
ragdolls. Jolt remains valuable for precise shape casts against bodies that actually exist in Jolt and for applying
impact impulses.

Use this state per live arrow in structure-of-arrays storage:

```ts
(position,
  previousPosition,
  velocity,
  age,
  maxAge,
  style,
  ownerEntityId,
  targetEntityId,
  presentationId,
  radius,
  state,
  seed,
  impactMode);
```

For no drag, integrate constant gravity exactly for a step:

```text
p(t + dt) = p(t) + v(t) dt + 0.5 g dt²
v(t + dt) = v(t) + g dt
```

For optional drag and wind, use relative air velocity `u = v - wind` and quadratic drag:

```text
a = g - k |u| u
k = rho Cd A / (2m)
```

Evaluate that acceleration with midpoint/RK2, then sweep from the previous to next position. Peer-reviewed flight
measurements model arrow drag as proportional to velocity squared and show that point, vane, oscillation, Reynolds
number, and boundary-layer state materially change measured drag; one elite-recurve test reported approximately 58 m/s
for its specific arrow ([French and Kirk 2007](https://doi.org/10.1016/j.ymssp.2005.08.018),
[Miyazaki et al. 2011](https://doi.org/10.1016/j.proeng.2011.05.083),
[Okawa et al. 2013](https://doi.org/10.1016/j.proeng.2013.07.017),
[Park 2011](https://doi.org/10.1177/1754337111407124)). Those data justify the model, not literal Eternum defaults:
world units, hex spacing, and readable flight time should determine presentation speed.

Recommended shipping modes:

1. **Readable/guaranteed arc (default):** no drag, tuned gravity, deterministic time of flight, endpoint constructed to
   meet the cached target.
2. **Physical research mode (gym):** gravity + quadratic drag + wind, numerical intercept/shooting method, measured miss
   error.
3. **Fantasy mode:** default arc plus bounded shader/trail behavior; gameplay still follows the same cached endpoint.

### Launch and lead solving

For a chosen flight time `T`, target position `q`, target velocity `w`, source `p`, and constant gravity `g`, a launch
velocity that reaches the linearly predicted target is:

```text
v0 = (q + wT - p - 0.5 gT²) / T
```

This is the best world-map presentation control because range is only one or two hexes and the outcome is already known.
Choose `T` from distance and a style-specific readable speed, clamp it, calculate `v0`, and expose the resulting
apex/speed in the gym. If a fixed launch speed is required, solve `|v0(T)| - speed = 0` for positive `T`, select the
lower or higher arc, and handle the no-solution case. Moving ballistic interception has no universal one-line solution
once drag and constraints are added; production projectile work uses predictive linear/ballistic solves, explicit
no-solution handling, and designer knobs
([Stark, _Math for Game Programmers: Predictable Projectiles_](https://www.gdcvault.com/play/1024368/Math-for-Game-Programmers-Predictable)).

Aim direction for the procedural pose comes from `normalize(v0)`, not directly from `normalize(target - source)`. The
arrow mesh should align its shaft axis to velocity every update and may add independent axial spin. Never bend a
non-homing arrow's velocity toward a moving live target after release.

### Fixed step and determinism

Start the gym reference at 120 Hz and measure convergence against 60 Hz; ship at 60 Hz if endpoint and apex error stay
inside acceptance limits. Swept collision removes the usual need to substep solely to prevent tunneling. Cap accumulated
work after a stall and fast-forward/fade old event replays rather than simulating unbounded history.

Seed volley spread, target offsets, and style variation from the immutable `presentationId`. Identical input should
reproduce the same visual path in one client build, but no gameplay code should rely on cross-machine bit identity.
Jolt's own documentation says determinism requires identical mutation order/binary, cross-platform determinism needs a
special build option, query callback ordering can vary, and callers may need to sort results
([Jolt determinism notes](https://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md)). The npm binary's
build flags are not a contract of Eternum gameplay. Onchain Cairo/RECS state remains the only outcome authority.

## Continuous collision and hit queries

### Why discrete point checks are insufficient

A small fast arrow can move completely through a thin collider between frames. One peer-reviewed test measured a mean 45
m/s for its longbow/arrow combination, which is 0.75 m in one 60 Hz tick before game scaling
([Karger et al. 1998](https://pubmed.ncbi.nlm.nih.gov/9751539/)). Jolt calls this tunneling and provides `LinearCast`
motion quality for dynamic bodies plus explicit `NarrowPhaseQuery.CastRay` and `CastShape` APIs; shape casts sweep a
volume and report hits along the path
([Jolt continuous collision detection](https://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md#continuous-collision-detection),
[NarrowPhaseQuery](https://jrouwe.github.io/JoltPhysics/class_narrow_phase_query.html),
[Jolt collision detection overview](https://jrouwe.github.io/JoltPhysicsDocs/5.5.0/index.html#autotoc_md137)). Jolt also
warns that a fast rotating long `LinearCast` body can rotate through a collider before its translational cast and miss
it. That is another reason to sweep a short arrow-tip point/sphere while keeping the long shaft visual.

For each fixed step, query the segment/swept radius from `previousPosition` to `position` and select the smallest hit
fraction across eligible sources. A sphere sweep is sufficient for a visual arrow; a short capsule aligned to velocity
is more faithful but costs more. Keep the arrow's visible shaft out of the collision thickness calculation unless
broadhead behavior demands it.

### Eternum needs two hit-query backends

Ordinary instanced armies are not Jolt bodies, and the current Jolt world contains only ground plus activated ragdolls.
Therefore, Jolt alone cannot answer “did this visual arrow hit army X?” The shared `ProjectileHitQuery` should compose:

1. **Logical world proxies:** target entity sphere/capsule/box derived from `ArmyManager`, structures, and flat terrain.
2. **Jolt narrow phase:** optional swept query against active ragdoll/static bodies, with projectile/shooter filtering.
3. **Ground/terrain:** current Worldmap uses flat `y = 0` hex positions, so a plane intersection is the production v1
   terrain query ([utils.ts](../../client/apps/game/src/three/utils/utils.ts)); a later height sampler or static Jolt
   terrain can replace it behind the interface.

Recommended target API:

```ts
interface ProjectileHitTarget {
  entityId: ID;
  kind: "army" | "structure" | "terrain" | "ragdoll-part";
  center: Vector3;
  shape: Readonly<Sphere | Capsule | Box3>;
  material: "flesh" | "wood" | "stone" | "metal" | "ground";
  partId?: CharacterPartId;
}
```

The live combat visual should normally query the selected target and terrain, not every unrelated unit. Incidental
client-only hits must not imply friendly fire or body blocking that the contract does not implement. The gym can expose
“all proxies” collision mode for stress testing.

Extend `JoltRagdollWorld` only at a generic physics boundary:

- allocation-safe `castRay` and `castSphere`/`castShape` methods;
- collision layer/body filters;
- body user data mapped to `{ entityId, partId }`;
- `applyImpulseAtPoint(partId, impulse, worldPoint)`.

Jolt documents center-of-mass and world-point impulse variants on `BodyInterface`
([BodyInterface](https://jrouwe.github.io/JoltPhysicsDocs/5.5.0/class_body_interface.html)). A world-point impulse
supplies the rotational response an arrow strike needs; the current center-only wrapper cannot.

### Hit response policy

Resolve visual response from authoritative context plus material/incidence:

- **Stick:** stop at the earliest hit, preserve the incoming shaft direction, offset the head slightly into the surface,
  retain in a bounded stuck-arrow pool, then fade. Do not rotate the shaft onto the surface normal; that produces
  visibly impossible right-angle impacts.
- **Deflect:** at shallow incidence or armored style, reflect the normal component with low restitution, retain tangent
  velocity, permit at most one visual bounce, then fade/debris.
- **Penetrate FX:** spawn decal/particles but do not continue into another gameplay target unless a future rule supports
  piercing.
- **Reaction:** play a procedural flinch on a live animated actor or apply a bounded impulse-at-point to an actor
  already transitioning to ragdoll.
- **Death:** trigger only when authoritative RECS removal/count-zero says the represented army is defeated; a locally
  detected arrow hit must not start a gameplay death.

For a promoted ragdoll, attach a stuck arrow to the corresponding rigid part transform. For an animated skinned target,
attach to a known bone/part proxy rather than a raw skinned triangle; Three.js skinning applies multiple bone weights
per vertex, so a static triangle-local attachment will not automatically follow the deformed surface
([SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html)). For an ordinary moving instance, prefer a short-lived
world-space stick/fade rather than pretending to own a bone.

## Pooling, instancing, LOD, and 100-unit cost

### Renderer design

Use one fixed-capacity `ArrowProjectileSystem` with structure-of-arrays typed storage, a free list, and swap-remove
active slots. No `new Vector3`, `Mesh`, material, geometry, or closure should occur in the steady-state update. A
projectile style bucket owns:

- one merged low-poly arrow `BufferGeometry`;
- one shared material/atlas;
- one `InstancedMesh` for flying arrows;
- optionally one instanced ribbon/stretched quad for trails;
- one bounded pool/bucket for stuck arrows.

Three.js explicitly recommends `InstancedMesh` for many objects sharing geometry/material because it reduces draw calls;
modified matrices/colors require marking their attributes for update
([InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)). Use `DynamicDrawUsage` and update ranges for
per-frame instance data ([BufferAttribute](https://threejs.org/docs/pages/BufferAttribute.html)). Reuse the repository's
existing dirty-range helper rather than writing a second upload convention
([instanced-attribute-update-range.ts](../../client/apps/game/src/three/utils/instanced-attribute-update-range.ts)).

Do not spawn one visual arrow per onchain troop. One army model represents an aggregate, so render a seeded volley of
roughly 3–9 arrows depending on camera distance, effect quality, and damage magnitude availability. That is a
presentation choice, not a simulation claim. Keep capacity explicit (starting proposal: 512 flying + 256 stuck arrows)
and define overflow as “drop oldest/farthest cosmetic arrow,” never dynamic growth.

### LOD policy

| LOD                  | Archer                                                                   | Projectile                                                            |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Close/promoted       | Full shot state, spine/arm/hand IK, preview arrow, string and bow recoil | Mesh + trail, logical sweep + Jolt ragdoll query, stick/deflect       |
| Mid/visible instance | No skeleton promotion solely to shoot; optional cheap model-phase cue    | Instanced arrow volley from computed muzzle, target proxy sweep       |
| Far                  | No individual draw; optional flash/ribbon at army anchor                 | One arc ribbon or impact burst, or no flight if below pixel threshold |
| Offscreen/old replay | State advances logically without pose                                    | Skip/fast-forward to bounded impact FX                                |

Three.js `LOD` supports distance thresholds and hysteresis, but the project should use the existing scene
visibility/camera policy as the authority and keep archer LOD decisions in one coordinator
([Three.js LOD](https://threejs.org/docs/pages/LOD.html),
[procedural-army-character-layer.ts](../../client/apps/game/src/three/characters/procedural-army-character-layer.ts)).

The existing benchmark caps at 100 actors and steps its crowd simulation at 30 Hz
([procedural-character-benchmark-config.ts](../../client/apps/game/src/three/characters/benchmark/procedural-character-benchmark-config.ts),
[procedural-character-benchmark-simulation.ts](../../client/apps/game/src/three/characters/benchmark/procedural-character-benchmark-simulation.ts)).
Add an “archer volley” workload rather than a separate benchmark. Measure against the checked-in baseline on the same
machine/render backend; do not claim optimization from intuition.

Quantitative gates for the first production slice:

- 100-unit benchmark p95 frame time increases by no more than 2 ms and median FPS regresses by no more than 10% versus
  its same-build no-volley baseline.
- 512 active visual arrows update and upload in at most 1 ms p95 on the benchmark machine.
- No steady-state heap allocation after warm-up; pool capacity and dropped-spawn count are visible.
- At most one draw call per ordinary arrow style and one per enabled trail style; active style bucket count is visible
  through renderer metrics.
- A 100 units/s arrow crossing a 0.02-unit target at 30 Hz still reports the earliest swept hit.
- Repeated 10,000-shot smoke returns live/stuck counts to zero/cap and shows no monotonic WASM or JS heap growth.

These are acceptance targets to test, not predictions.

## Multiplayer/onchain reconciliation in detail

### Local optimistic shot

Extend `WorldmapProvisionalFxSpec` for `kind: "attack"` with the identifiers/context the renderer currently lacks:

```ts
{
  kind: "attack";
  attackerId: ID;
  targetId: ID;
  attackerType: ActorType;
  attackerHex: HexPosition;
  targetHex: HexPosition;
  troopType?: TroopType;
  troopTier?: TroopTier;
}
```

Prefer IDs plus a resolver over passing mutable model objects. At the call site, starting the provisional intent
immediately commands the local draw/volley. Bind cleanup to intent outcome:

- failure before release: cancel shot and recover;
- failure after release: mark arrows rejected, turn them into a miss/dissolve, and suppress gameplay-like impact;
- settled: retain a short dedupe record awaiting indexed echo.

### Indexed event replay

On `BattleEvent`:

1. resolve/cached-read attacker category and tier from RECS/army presentation;
2. if the attacker is a ranged-family army or guard, build a replay command;
3. match it to a recent provisional `(attackerId, targetId)` command and consume without duplicating the volley;
4. otherwise launch a remote volley seeded from an event identity;
5. if the event is older than the maximum flight window, fast-forward to impact or play only a bounded impact flourish.

The current `BattleEventSystemUpdate.entityId` is resolved as the winning entity rather than a stable event identity,
and the parser omits Cairo's `coord`
([world-update-listener.ts](../../packages/core/src/systems/world-update-listener.ts)). Before relying on event replay,
expose a stable event key/hashed entity or transaction identity and the coordinate. A temporary key of
`attackerId:defenderId:timestamp` is usable but may collide for repeated same-timestamp combat; document and bound that
risk rather than pretending it is unique.

`BattleEvent` has no troop category, tier, damage amount, projectile count, or exact source/target transforms. Resolve
those from current/cached RECS presentations; if they are unavailable, skip the arrow and retain generic battle FX.
Never fabricate a ranged weapon for an unresolved event.

### Snapshot fallback

Event delivery is an accelerator, not required for correctness. If `ExplorerTroops` count decreases, existing floating
damage FX still plays; if it reaches zero, existing removal/defeat presentation still plays
([army-manager.ts](../../client/apps/game/src/three/managers/army-manager.ts)). The client may not know which missed
event caused a late snapshot delta, so the fallback should not synthesize an attacker-specific arrow. Persistent state
stays correct and the transient volley may be absent—exactly the intended entity/event hierarchy.

### What not to synchronize

- no arrow model in Cairo;
- no projectile rows in RECS;
- no per-frame position replication;
- no Jolt state hash used for combat;
- no client-side hit report submitted as damage;
- no random volley spread without a stable presentation seed.

## Fantasy progression without fragmenting the runtime

Keep mechanics shared and style data-driven:

| Tier            | Silhouette and material                                                             | Projectile/readability                                                                        |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| T1 Archer       | Existing Hunter's Bow + quiver, warm wood, cloth wrap, simple feather fletching     | 3–5 restrained arrows, faint dust impact                                                      |
| T2 Crossbowman  | Existing crossbow behavior, reinforced stock/limbs, steel accents                   | Shorter bolt, flatter arc, sharper release, longer reload                                     |
| T3 Beast Hunter | Oversized horn/carapace bow, asymmetrical limb guards, runes tied to heraldry color | 5–9 heavy/spectral arrows, emissive string pulse, bounded afterimage and armor deflect sparks |

Use `primaryColor`, `tier`, `runeGlow`, metalness, and roughness already present in `ProceduralCharacterConfig` rather
than a parallel upgrade schema
([procedural-character-config.ts](../../client/apps/game/src/three/characters/procedural-character-config.ts)). Instance
color/emissive strength should carry most variation so arrows remain in a few shared geometry/material buckets. A unique
material per actor destroys batching.

Shaders are an appearance multiplier, not the source of the pose. The bow must read through silhouette, draw constraint,
string, arrow, release timing, and follow-through before adding glow/trails. For renderer parity, prefer the project's
cross-backend material approach/TSL for new shader work; Three.js documents TSL instancing and dynamic instanced buffers
across its renderer abstraction ([Three.js TSL](https://threejs.org/docs/pages/TSL.html)). Keep a non-emissive WebGL2
fallback and test both backends.

## Gym specification

The existing gym should remain the single promotion gate. Add `Archer` to the unit selector and show an
archer/projectile panel only for ranged kinds.

### Scenario controls

- Fire once, auto-fire, cancel shot, reset, pause, single fixed step.
- Target type: static dummy, moving dummy, armored dummy, structure proxy, ragdoll.
- Target position/height/radius and linear velocity.
- Archer handedness, locomotion mode, root tracking, target-switch timing.
- Camera presets: front, bow side, draw side, over-shoulder, trajectory, impact close-up.
- Actor count/volley count and close/mid/far forced LOD.

### Shot controls

- Per-state duration and transition easing.
- Draw length, bow bend, bow cant, anchor offset, final expansion.
- Aim yaw/pitch clamps, root-turn threshold, spine weight distribution.
- Bow/draw elbow pole offsets, reach soft limit, IK iterations/tolerance.
- Aim drift amplitude/frequency and breathing contribution.
- Follow-through distance, bow-arm hold, string/limb damping.

### Projectile controls

- Launch speed or time-of-flight mode, gravity, drag coefficient, arrow mass/area abstraction, wind.
- Low/high arc, lead enabled, target velocity, forced no-solution case.
- Fixed step, max substeps, sweep radius, ray versus sphere cast, hit layer/filter.
- Volley count, spread cone, seed, target-offset radius.
- Stick/deflect mode, incidence threshold, restitution, stuck lifetime, impact impulse.
- Pool capacities, overflow policy, trails, arrow style/tier.

### Debug visualization

- Skeleton, sockets, hand targets, elbow poles, spine axes, joint clamp violations.
- Bow tips, rest, nock, draw length, string segments, preview-arrow ownership.
- Desired launch vector versus actual arrow-rest vector.
- Predicted intercept, target lead point, no-drag parabola, integrated path, apex.
- Previous-to-next collision segment/swept radius, target proxies, hit fraction/normal/material.
- Pool indices, active/stuck/dropped arrows, LOD and style bucket.

### Live diagnostics

- shot state, normalized state time, shot generation, releases emitted;
- bow-grip and draw-hand positional/orientation error;
- desired-versus-actual aim angle and endpoint miss distance;
- draw length and string continuity error;
- flight time, apex, impact speed/incidence, hit source;
- arrows spawned/active/stuck/dropped, hits/misses/deflections;
- archer pose ms, projectile simulation ms, query ms, matrix upload ms;
- renderer draw calls/triangles and Jolt body/query/heap metrics;
- provisional/indexed/deduped/rejected presentation counts.

### Smoke scenarios

1. Static target: complete every state, emit exactly one arrow, hit within radius, recover.
2. Moving target: predicted lead hits; disabling lead produces a measurable miss in the expected direction.
3. Cancellation: intent failure before release produces no projectile; after release produces a rejected miss/dissolve.
4. Tunneling: fast arrow crosses a thin proxy in one 30 Hz frame and still hits.
5. Ragdoll: authoritative reaction switches actor to ragdoll, impact-at-point remains finite, stuck arrow follows a
   part.
6. Pool stress: 100 archers/512 arrows/10,000 total shots, bounded counts and memory.
7. Renderer parity: WebGPU-auto and forced WebGL2 produce finite transforms, visible arrows, and zero console errors.
8. Replay: a local provisional volley plus matching indexed event renders once; a remote event renders once; a duplicate
   event renders zero additional volleys.

## Staged implementation plan

### Stage 1 — pure shot, aim, and ballistic domain

Add:

- `client/apps/game/src/three/characters/archer/procedural-archer-config.ts`
- `client/apps/game/src/three/characters/archer/procedural-archer-shot-cycle.ts`
- `client/apps/game/src/three/characters/archer/procedural-archer-aim.ts`
- `client/apps/game/src/three/characters/archer/procedural-archer-pose.ts`
- `client/apps/game/src/three/projectiles/arrow-ballistics.ts`
- matching focused tests beside each file

Change:

- [procedural-unit-config.ts](../../client/apps/game/src/three/characters/procedural-unit-config.ts): add visual kind
  `archer`.
- [procedural-character-pose.ts](../../client/apps/game/src/three/characters/procedural-character-pose.ts): allow an
  upper-body action layer or delegate it cleanly to the archer pose resolver.

Gate: deterministic state-edge tests, finite constrained arm solves, static/moving/no-solution ballistic tests. No
rendering or Jolt required.

### Stage 2 — sockets, bow, string, and preview arrow in the gym

Add:

- `client/apps/game/src/three/characters/procedural-character-sockets.ts`
- `client/apps/game/src/three/characters/archer/procedural-bow-equipment.ts`
- `client/apps/game/src/three/characters/archer/procedural-archer-runtime.ts`

Change:

- [procedural-character-avatar.ts](../../client/apps/game/src/three/characters/procedural-character-avatar.ts): cached
  sockets, optional hand/finger pose, distributed spine bindings.
- [procedural-unit-equipment.ts](../../client/apps/game/src/three/characters/procedural-unit-equipment.ts): delegate
  ranged weapons to bow/crossbow equipment runtimes rather than one static midpoint placement.
- [procedural-unit-runtime.ts](../../client/apps/game/src/three/characters/procedural-unit-runtime.ts): compose the
  archer action controller.
- gym renderer/controls/view and smoke files under `characters/gym` and `ui/features/debug`.

Reuse the registered Hunter's Bow/quiver; use generated segmented fallback if asset load/sockets are unavailable. Gate:
the preview arrow stays on rest/string through draw, detaches exactly once, hand errors remain below the normalized gym
tolerance, and no hand orientation is overwritten.

### Stage 3 — pooled projectile and continuous hit-query system

Add:

- `client/apps/game/src/three/projectiles/arrow-projectile-config.ts`
- `client/apps/game/src/three/projectiles/arrow-projectile-pool.ts`
- `client/apps/game/src/three/projectiles/arrow-projectile-renderer.ts`
- `client/apps/game/src/three/projectiles/arrow-projectile-system.ts`
- `client/apps/game/src/three/projectiles/projectile-hit-query.ts`
- unit/performance/source-guard tests

Change:

- [jolt-ragdoll-world.ts](../../client/apps/game/src/three/characters/jolt-ragdoll-world.ts): generic filtered shape
  query, body metadata, impulse at point.
- [instanced-attribute-update-range.ts](../../client/apps/game/src/three/utils/instanced-attribute-update-range.ts):
  reuse only; extend only if a measured missing primitive exists.

Gate: swept-hit, earliest-hit, pool lifecycle, no-allocation, WASM cleanup, and 512-arrow benchmark targets.

### Stage 4 — one world-level presentation coordinator

Add:

- `client/apps/game/src/three/combat/ranged-combat-presentation-coordinator.ts`
- coordinator tests for provisional, failure, remote replay, dedupe, old replay, and snapshot fallback

Change:

- [worldmap-provisional-fx.ts](../../client/apps/game/src/three/scenes/worldmap-provisional-fx.ts): add IDs/actor
  context to attack specs.
- Quick Attack and Battle Lab call sites: pass the context they already own.
- [worldmap.tsx](../../client/apps/game/src/three/scenes/worldmap.tsx): own/update/dispose the coordinator and route
  `BattleEvent` to it.
- [types.ts](../../packages/core/src/systems/types.ts) and
  [world-update-listener.ts](../../packages/core/src/systems/world-update-listener.ts): expose stable event identity and
  Cairo coordinate.
- [army-manager.ts](../../client/apps/game/src/three/managers/army-manager.ts): allocation-free source/target
  presentation snapshots, not a second state store.
- [procedural-army-character-layer.ts](../../client/apps/game/src/three/characters/procedural-army-character-layer.ts):
  optional action command and live socket snapshot for promoted actors.

Gate: local attacks feel immediate; indexed echoes do not double-fire; remote ranged attacks replay; missing events do
not affect persistent damage/removal truth.

### Stage 5 — reaction fidelity and fantasy tiers

- Add target material/part resolution, procedural flinch, stick/deflect, and impulse-at-point.
- Route T1/T2/T3 ranged-family visuals to Archer/Crossbowman/Beast Hunter styles without changing `TroopType`.
- Add bounded trails/emissive string/runes with WebGPU and WebGL2 parity.
- Promote art-ready bow sockets when available; delete the generated production fallback when the asset seam is
  trustworthy.

Gate: no client hit can trigger authoritative death; visual reactions reconcile cleanly with count-zero/removal; style
buckets remain bounded.

### Stage 6 — extend the existing 100-unit benchmark

Change:

- `client/apps/game/src/three/characters/benchmark/procedural-character-benchmark-config.ts`
- `client/apps/game/src/three/characters/benchmark/procedural-character-benchmark-simulation.ts`
- `client/apps/game/src/three/characters/benchmark/procedural-character-benchmark-renderer.ts`
- `client/apps/game/src/ui/features/debug/procedural-character-benchmark-view.tsx`
- browser smoke scripts

Add workload presets: `archer-volley`, `ranged-mix`, `512-arrows`, and `impact-ragdolls`. Record baseline and candidate
metrics in the same run. Ship only when the quantitative gates above pass in WebGPU-auto and forced WebGL2.

## Test inventory

Minimum focused tests:

- `procedural-archer-shot-cycle.test.ts`: transition order, edge events once, cancel, retarget, ragdoll abort,
  pause/step.
- `procedural-archer-aim.test.ts`: static/moving lead, high/low arc, no solution, root-turn fallback, finite clamped
  output.
- `procedural-archer-pose.test.ts`: hand errors, elbow hemispheres, spine distribution, handedness mirror, draw
  continuity.
- `procedural-bow-equipment.test.ts`: sockets, string endpoints, preview ownership, release detach, recoil decay.
- `arrow-ballistics.test.ts`: analytic no-drag result, gravity sign, drag dissipates speed relative to air, wind
  direction, 60/120 Hz convergence.
- `projectile-hit-query.test.ts`: fast thin target, earliest fraction, shooter filter, ground, ragdoll metadata.
- `arrow-projectile-pool.test.ts`: capacity, overflow, swap-remove, style bucket, reset/dispose, no stale owner IDs.
- `ranged-combat-presentation-coordinator.test.ts`: provisional, rejection, indexed remote replay, dedupe, old replay,
  missing category, no RECS writes.
- extended gym smoke: one complete shot plus Jolt reaction.
- extended 100-unit benchmark smoke: bounded projectiles, physics health, renderer health, performance telemetry.

Source-level guards should assert the architecture, not implementation trivia: one coordinator owns live arrows;
projectile code does not import gameplay transaction writers or mutate RECS; Worldmap disposes the coordinator; all
Emscripten query temporaries/collectors are destroyed.

## Risks and explicit non-goals

- **Not merely parameters:** cadence and secondary-motion parameters can polish the result, but hand sockets, shot
  state, bow constraint, string ownership, and projectile lifecycle are missing abstractions. Treating this as only an
  `armSwing` tweak will produce a robotic mime.
- **No exact bow finite-element simulation:** peer-reviewed bow/arrow mechanics are useful reference, but a full elastic
  beam/string/arrow solver adds cost without improving world-map readability.
- **No client gameplay ballistics:** local collision never determines damage, range, stamina, or victory.
- **No Jolt body per ordinary arrow:** query-based flight is the default; dynamic bodies are reserved for measured needs
  such as a rare post-deflection prop.
- **No automatic promotion of every firing army:** the world projectile system works from instanced anchors; only
  close/selected actors pay for skeletal IK.
- **No one-mesh bow deformation guess in production:** use the static Hunter's Bow first, then an authored
  socket/deformation contract.
- **No event-only truth:** dropped/late `BattleEvent` may omit a volley, but RECS count/removal still yields correct
  state and fallback FX.

## Recommended first playable slice

Implement Stages 1–4 with a narrow scope:

1. T1 Crossbowman-family presentations resolve to visual `archer`.
2. The gym exposes one static and one moving target, full shot cycle, generated/socketed string, no-drag guaranteed arc,
   sphere sweep, and one stick response.
3. One pooled instanced arrow style supports 256 arrows; no trails or drag in live mode.
4. Provisional local attack fires immediately; matching `BattleEvent` dedupes; remote T1 archer events replay when
   category can be resolved.
5. RECS count diffs/removal remain unchanged.
6. The 100-unit benchmark adds a 25-archer volley scenario before any fantasy shader pass.

That slice proves the hard boundaries—pose, ownership, continuous hit presentation, authority, pooling, and performance.
Drag/wind, deflection, elemental trails, and more elaborate bow deformation can then be promoted independently from the
gym without changing the combat contract.

## Primary-source index

### Archery biomechanics and mechanics

- World Archery,
  [Level 1 coaching course specification](https://extranet.worldarchery.sport/documents/index.php/?doc=6113),
  [Beginner Manual](https://extranet.worldarchery.sport/documents/index.php/documents/?doc=825), and
  [Level 2 Coaching Manual with longbow module](https://documents.worldarchery.org/Coaches/Accreditation/Coaching_Levels/Coaching_Manual_Level2.pdf).
- Denardi et al.,
  [“Dynamical Analyses Show That Professional Archers Exhibit Tighter, Finer and More Fluid Dynamical Control Than Neophytes”](https://pmc.ncbi.nlm.nih.gov/articles/PMC10606362/), 2023.
- Ko et al.,
  [“Anticipatory postural adjustments during an archery performance”](https://pmc.ncbi.nlm.nih.gov/articles/PMC11235681/), 2024.
- Hennessy and Parker, [“Electromyography of arrow release in archery”](https://pubmed.ncbi.nlm.nih.gov/2303006/), 1990.
- Nedergaard et al.,
  [“Archery's signature: an electromyographic analysis of the upper limb”](https://pmc.ncbi.nlm.nih.gov/articles/PMC10426064/), 2023.
- Edelmann-Nusser et al.,
  [“On-target trajectories and the final pull in archery”](https://doi.org/10.1080/17461390601012579), 2006.
- Leroyer et al.,
  [“Biomechanical study of the final push-pull in archery”](https://doi.org/10.1080/02640419308729965), 1993.
- Kooi, [“On the mechanics of the modern working-recurve bow”](https://doi.org/10.1007/BF00369887), 1991.
- Kooi and Bergman,
  [“An approach to the study of ancient archery using mathematical modelling”](https://doi.org/10.1017/S0003598X00084611), 1997.
- Kooi and Sparenberg,
  [“On the mechanics of the arrow: Archer's paradox”](https://doi.org/10.1023/A:1004262424363), 1997.
- Kooi, [“Bow-arrow interaction in archery”](https://pubmed.ncbi.nlm.nih.gov/10189077/), 1998.
- French and Kirk,
  [“Measuring the flight of an arrow using the Acoustic Doppler Shift”](https://doi.org/10.1016/j.ymssp.2005.08.018), 2007.
- Miyazaki et al.,
  [“Aerodynamic properties of an arrow: Influence of point shape on the boundary layer transition”](https://doi.org/10.1016/j.proeng.2011.05.083), 2011.
- Okawa et al.,
  [“Free flight and wind tunnel measurements of the drag exerted on an archery arrow”](https://doi.org/10.1016/j.proeng.2013.07.017), 2013.
- Park, [“The aerodynamic drag and axial rotation of an arrow”](https://doi.org/10.1177/1754337111407124), 2011.
- Karger et al.,
  [“Experimental arrow wounds: ballistics and traumatology”](https://pubmed.ncbi.nlm.nih.gov/9751539/), 1998.

### Animation, rendering, physics, and networking

- Aristidou and Lasenby,
  [“FABRIK: A fast, iterative solver for the Inverse Kinematics problem”](https://doi.org/10.1016/j.gmod.2011.05.003), 2011.
- Aristidou et al.,
  [“Inverse Kinematics Techniques in Computer Graphics: A Survey”](https://doi.org/10.1111/cgf.13310), 2018.
- Three.js official docs: [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html),
  [BufferAttribute](https://threejs.org/docs/pages/BufferAttribute.html),
  [SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html), [LOD](https://threejs.org/docs/pages/LOD.html),
  [TSL](https://threejs.org/docs/pages/TSL.html).
- Jolt official docs/source:
  [architecture and determinism](https://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md),
  [continuous collision](https://jrouwe.github.io/JoltPhysicsDocs/5.1.0/),
  [NarrowPhaseQuery](https://jrouwe.github.io/JoltPhysics/class_narrow_phase_query.html),
  [BodyInterface](https://jrouwe.github.io/JoltPhysicsDocs/5.5.0/class_body_interface.html),
  [JoltPhysics.js](https://github.com/jrouwe/JoltPhysics.js/).
- Chris Stark / Robot Entertainment,
  [“Math for Game Programmers: Predictable Projectiles”](https://www.gdcvault.com/play/1024368/Math-for-Game-Programmers-Predictable),
  GDC 2017.
- Dan Reed / Blizzard,
  [“Networking Scripted Weapons and Abilities in Overwatch”](https://gdcvault.com/play/1024653/Networking-Scripted-Weapons-and-Abilities),
  GDC 2017.
- Yahn Bernier / Valve,
  [“Latency Compensating Methods in Client/Server In-game Protocol Design”](https://media.gdcvault.com/GD_Mag_Archives/GDM_June_2001.pdf), 2001.
