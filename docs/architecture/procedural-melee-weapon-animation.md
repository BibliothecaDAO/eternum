# Procedural melee weapons and animation

## Outcome

Knights and mounted Paladins use one deterministic melee action pipeline. A loadout selects the visible weapon and
offhand, the weapon selects an attack style, the attack style drives a shared upper-body pose solver, and one contact
edge drives presentation effects. Cairo and RECS remain authoritative for whether an attack is legal and what damage it
causes.

The implementation is available in both development surfaces:

- `/debug/procedural-characters` authors one close-up unit, target, loadout, attack, and ragdoll transition.
- `/debug/procedural-character-benchmark` runs up to 100 mixed units, including scheduled melee attacks, ranged volleys,
  deaths, respawns, and a bounded number of Jolt ragdolls.

## Runtime flow

```text
attack(target)
  -> deterministic action cycle
  -> weapon-specific pose signals
  -> shared grounded or mounted skeleton solver
  -> hand socket transform
  -> selected cosmetic weapon
  -> exactly one contact event
  -> target / pooled world-map flourish

indexed or provisional battle
  -> presentation coordinator
  -> arrow volley or melee impact
  -> optional promoted articulated actor attack

Cairo / RECS battle result -----------------------> gameplay truth
```

Presentation never writes damage, cooldown, troop count, or battle state.

## Attack state machine

| Phase           | Purpose                                                            | Interruptible     | Emits gameplay result |
| --------------- | ------------------------------------------------------------------ | ----------------- | --------------------- |
| `idle`          | Locomotion or mounted gait owns the body                           | Yes               | No                    |
| `acquire`       | Blend gaze, chest, shield, and weapon toward the target            | Yes               | No                    |
| `windup`        | Store readable anticipation and rotate the torso away from contact | Yes               | No                    |
| `strike`        | Accelerate the weapon hand through the selected arc                | Yes               | No                    |
| `contact`       | Hold a very short impact pose and emit one cosmetic edge           | No duplicate edge | No                    |
| `followThrough` | Carry momentum beyond the target                                   | Yes               | No                    |
| `recover`       | Blend back to the current gait instead of a fixed idle pose        | Yes               | No                    |

The controller advances with bounded delta time and can cross multiple short phases in one update without losing or
duplicating contact. `attackGeneration` identifies a swing; `contactCount` is a diagnostic counter, not combat state.

## Weapon and offhand model

Loadouts are data, not actor subclasses.

| Slot    | Built-in fallback               | Registered cosmetics                                            |
| ------- | ------------------------------- | --------------------------------------------------------------- |
| Weapon  | Iron Longsword, Runic Warhammer | Winter Trooper Broadaxe, Winter Rider Battleaxe                 |
| Offhand | None, Round Shield              | Winter Trooper Targe, Winter Rider Shield, Light Cavalry Shield |

The catalog maps each weapon to `slash`, `chop`, or `smash`. Animation code reads the style and physical proportions; it
does not know cosmetic filenames. Registered entries resolve through the existing cosmetic registry and asset cache. If
loading fails, the selected style still renders with a procedural fallback, so a cosmetic outage cannot remove the
combat silhouette.

Loaded GLBs share cached geometry and pooled materials. Each actor owns only a cloned object hierarchy. Equipment
follows the same `handRight` and `handLeft` sockets during locomotion, attack, mounted motion, and the frame before
ragdoll handoff. Swapping a cosmetic replaces only the slot object; it does not rebuild the skeleton or controller.

### New asset contract

A future melee cosmetic needs:

1. A stable cosmetic registry ID and attachment template with slot `weapon` or `offhand`.
2. A GLB whose origin is at the intended grip and whose scale can be normalized from its bounds.
3. A catalog entry declaring label, compatible unit kinds, visible length/diameter, and attack style.
4. A gym pass at windup, contact, follow-through, mounted contact if compatible, and Jolt transition.
5. A 100-unit benchmark pass with close-detail equipment disabled and enabled on a smaller visual sample.

No new actor class or animation clip is required for a cosmetic variation.

## Pose design

The legs continue to use the organic gait and plant solvers. Melee is an upper-body action layer:

- `slash` begins outside the weapon shoulder, crosses the target, and finishes low across the body.
- `chop` begins overhead and drives forward/down through contact.
- `smash` increases the overhead anticipation and torso drive for a heavier silhouette.
- The offhand maintains a forward guard; selecting no offhand relaxes that arm.
- Target yaw and pitch are clamped to prevent anatomical inversions.
- Torso twist, drive, step-through, attack arc, timing, and impact response are authorable independently.

Mounted attacks reuse the same action signals with reduced torso rotation, a lower contact point, and unchanged seated
leg targets. The rider therefore follows the horse suspension while the weapon can strike down beside the mount. The
horse alone has no weapon action; the composed Paladin owns it.

## Fidelity and scaling tiers

High fidelity comes from combining layers, not from adding a shader to a bare skeleton:

1. A rigged, skinned character supplies deformation, anatomy, armor, and material identity.
2. Procedural gait and action solvers pose that rig at runtime.
3. Cosmetic GLBs attach to stable sockets and can evolve with upgrade tier or ownership.
4. Materials, outlines, rune emission, impact arcs, dust, and lighting establish the fantasy rendering style.
5. Jolt replaces animation only when physical reaction or death is requested.

Recommended distance policy:

| Distance          | Representation                                                                    |
| ----------------- | --------------------------------------------------------------------------------- |
| Hero / selected   | Full skinned actor, detailed cosmetic, upper-body IK, socket diagnostics optional |
| Nearby combat     | Skinned actor, procedural fallback or shared cosmetic, scheduled attack layer     |
| Crowd             | Existing instanced army plus pooled two-draw-call attack flourish                 |
| Death / major hit | Promote a bounded number to articulated Jolt ragdolls                             |

This avoids running one hundred detailed GLB attachments and one hundred ragdolls merely to show one hundred combatants.

## Gym controls and acceptance gates

The melee gym exposes weapon, offhand, asset/fallback mode, auto attack, every phase duration, arc, reach, torso drive,
step-through, target position/movement, impact response, socket helpers, pause, fixed-step advance, reset, and Jolt
actions.

A loadout is ready for promotion when:

- windup, contact, and recovery remain finite for both grounded and mounted compatible units;
- the weapon remains attached to the right-hand socket and the offhand to the left-hand socket;
- one swing produces exactly one contact edge, including at low frame rate;
- cancel returns through recovery without snapping;
- the target recoil and arc make contact readable without implying authoritative damage;
- cosmetic load failure produces the correct procedural fallback;
- five reset/attack/ragdoll cycles do not grow bodies, constraints, pooled effects, or listeners;
- the 100-unit benchmark sustains the agreed frame budget in both WebGPU and forced WebGL modes.

## Next fidelity work

- Author per-asset grip rotation/offset metadata after final art review instead of embedding corrections in animation
  code.
- Add optional two-handed constraints for great weapons when the offhand slot is empty.
- Add footwork variants (advance, retreat, lateral cut) once gameplay exposes attack range and facing intent.
- Drive hit reaction selection from indexed battle outcome while retaining entity state as the source of truth.
- Add palette/rune material overrides to cosmetic metadata so tier evolution changes the same asset without duplicating
  it.
