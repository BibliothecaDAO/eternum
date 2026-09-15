# Eternum icon art direction

The machine-readable generation contract is `resources/manifest.json`. This document explains the visual decisions and
the approval workflow around it.

## Visual language

Eternum icons use an evolved low-poly medieval-fantasy style. Forms are constructed from broad, deliberate planes, then
finished with restrained hand-painted material texture. They should feel tactile and authored without becoming noisy at
small UI sizes.

- one unmistakable subject and silhouette per icon
- orthographic-like three-quarter view rather than dramatic perspective
- warm upper-left key light and subtle cool lower-right fill
- dark umber edge separation instead of a heavy black sticker outline
- aged, physical materials with one controlled resource-specific accent
- no backplate, frame, scenery, ground plane, cast shadow, text or particle cloud
- genuinely transparent canvas with safe space around every edge

Tiered icons keep the same core silhouette within a family. Higher tiers communicate progression through stronger
materials, one additional structural feature and a controlled increase in magical energy. They must remain recognizably
related without being duplicate files.

## Small-size gate

Every icon is reviewed at 16, 24, 32, 48, 64 and 80 pixels. Details that disappear at 24 pixels do not justify more
complexity in the source. The silhouette and primary accent must remain recognizable on charcoal, parchment and
world-map green backgrounds.

## Source and output contract

Approved semantic masters live in `resources/approved/<slug>.png`. The checked-in master is the editable visual source;
numeric files are generated deployment artifacts.

The build normalizes approved masters to a 256 px transparent PNG with a 220 px subject envelope. It stages output under
`.context/icon-generation/build/resources` unless publishing is explicitly requested. Publishing writes the existing
`public/images/resources/<id>.png` compatibility paths.

Never put a raw model output directly into `public/images/resources`. Generated candidates belong under
`.context/icon-generation/<batch>/candidates`; only an approved selection moves into the committed source tree.

## Review sequence

1. Generate one image per semantic prompt.
2. Reject wrong silhouettes, opaque backgrounds, text, frames, detached noise and clipped edges.
3. Compare the family contact sheet at all target sizes.
4. Approve the semantic master.
5. Run the deterministic build and verification scripts.
6. Inspect the resource table, compact transfer UI, hover label, relic reveal and world FX in the game.

The first pilot is Stone, Wood, Mithral, Labor, Knight T1, Knight T3 and the Stamina Relic I/II pair. Do not generate
the remaining catalog until those eight establish the shared visual language.
