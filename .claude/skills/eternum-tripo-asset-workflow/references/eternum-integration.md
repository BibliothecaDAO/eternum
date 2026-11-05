# Eternum delivery for the Tripo workflow

This reference owns integration requirements for the current troop/building tests. The original `game-asset-workflow` is
an explicitly selected fallback; maintain it only within user-requested scope. The user's decision to switch workflows
is separate from routine asset integration. Repository instructions remain authoritative for actual code and runtime.

## Resolve the actual game

Identify the active checkout and read its AGENTS.md and client instructions. Locate the real client package, asset
registries, loaders, quality settings, scene camera, lighting, material pipeline and animation interfaces. Newer layouts
may use `apps/game`; older ones may use `client/apps/game`. Inspect the current source rather than relying on old paths.
Keep editable sources outside runtime export folders and preserve unrelated work.

## Deliver from the ideal

Complete assembly/repair/diagnostic rigging, retain the compact working source and derive actual game presets through
[quality-presets.md](quality-presets.md). Keep source-to-export hashes and exact settings. Export only the needed asset
collection, deform skeleton and supported sockets in clip-free runtime exports. Keep diagnostic actions in separate
Blender/offline review artifacts. Verify scale, axes, origin, grounding, bounds, material/texture roles, skin weights,
inverse binds and attachment dimensions. Round-trip final exports through the same loader and compression support used
by Eternum; source-only checks do not prove runtime output.

Reuse validated family controller cores and rig adapters across compatible tiers and skins. Expect versioned skin/mount
motion adjustments where proportions, equipment or mount anatomy require them; use existing performances as references.
Preserve accepted profiles and use a dedicated mount behavior/adapter when locomotion anatomy warrants it, rather than
copying the whole runtime per skin. A current candidate controller is not an approved baseline until its runtime checks
pass. Verify bind pose, then neutral runtime pose, then moving-root gait before microdetail repair or polishing a
captured pose. Use fixed authored palettes. Show ownership through the game's separate mechanism, not by recolouring
model materials. Preserve the shared human/mount/prop scale and requested formations. Inspect all-angle materials/clay
and affected ROM extremes on actual exported files. Blender-only constraints must be represented by supported runtime
data. Baked diagnostic motion is for offline review only; do not claim Blender constraints or clips transfer as runtime
solvers.

## Compare and integrate

Implement the existing comparison page's [ideal/preset section](quality-comparison.md). Keep original concept, approved
raw Tripo and ideal as distinct lineage stages. The shareable game-instance stage uses actual game assets, terrain,
renderer, lighting, camera, loader and existing Three.js procedural motion, with multiple troop and building placements.
A neutral viewer or approximate biome scene proves only what it actually reproduces. When real-game lighting differs
from the workshop, inspect environment reflections and material maps before changing metal, roughness or texture art. A
lighting fallback must still provide reflected illumination to metallic surfaces; key/fill lights alone do not establish
reflection parity. A fallback must avoid the operation that failed (for example, a prefiltered local environment after
PMREM generation failure), reuse one texture per renderer and dispose it with that renderer. Inject the relevant failure
once in a bounded browser check; distinguish native-backend, fallback-backend and real-device evidence. Preserve
authored maps. Verify the actual game/lab's terrain, lighting, renderer, camera, loader, animation and representative
density before describing it as in-game acceptance. Label untested production-manager or target-device behaviour
explicitly.

Use browser inspection to review close/gameplay views, all angles, fixed palettes, formation counts, Paladin A/B/C coat
order and procedural poses. Compare each preset against the ideal and neighbouring game assets. Measure the
representative single-preset scene separately from the extra load of the multi-panel review page. Retain separate
visual, structural and performance results.

When authorized, update the appropriate asset registry/loader paths and run the active repository's required checks and
affected runtime tests. Do not change gameplay values or production asset selection merely to publish an experiment.
Keep experimental and integrated exports labelled. Publish review changes through the selected hosting workflow within
the requested scope; hosting an art comparison is not a production-game release.

## Existing procedural runtime seams

Use [independent troop development](troop-development.md) for family manifests/skin/equipment contracts and
[procedural motion](procedural-animation.md) for controller and reference work. Preserve the existing runtime facade;
move family-specific tuning into Knight, Crossbowman and Paladin profiles/controllers as migration is commissioned. Do
not treat all three as one writable humanoid configuration or copy the entire runtime for each skin. Validate family,
role, implemented action, rig capabilities and item motion class at assembly/swap entrypoints. Armor belongs to the
skin. Read actual code: the framework's required action/count matrix is not evidence that all cells currently work.

Troop integration uses `ProceduralUnitRuntime`, existing humanoid/horse asset libraries and rig adapters, gait/planting,
mounted contacts, equipment catalog, animation gym and physics lifecycle. Register semantic rider/mount bindings and
costed representations through those paths. Verify moving-root horse capture, pose/contact continuity, attachment
removal and resource disposal. Do not introduce an authored gameplay clip library or a new locomotion system. Ship
clip-free runtime exports; retain Blender actions only as offline ROM diagnostics.

In the animation gym, wait for `data-gym-ready="true"` and the requested actor/asset/equipment identities before
capturing. The browser debug bridge can exist while the default actor is still loading. Use the existing capture CLI
readiness checks; bridge existence or elapsed time alone does not identify a valid capture.

For a mounted soldier, calibrate the natural seat and distinct forearm-shield/rein contacts. For a crossbowman, preserve
fixed item dimensions with authored primary/support grip, bolt axis, muzzle/string landmarks and a separate lower-back
bolt-quiver role. Solve the supporting hand to the weapon, rather than scaling the weapon to arm span. Use current
supported gameplay states and existing state timing; do not invent attack/reload rules. A fixture proves an interface,
not approved skin fidelity. Exercise 1–3 mounted and 1–6 foot contracts and actual High/Balanced loader paths where
commissioned.

## Composed-scene placement and acceptance

Finish parent transforms and stable rig-ground alignment before installing terrain samplers or creating world-space
plant anchors. Do not ground from bounds of an already animated/skinned pose. Rebase/reset planting after teleport,
scale or terrain changes. Convert ground samples consistently between world and rig coordinates; equipment inherits
presentation scale and must not cancel it through reciprocal world scaling.

Finite transforms and target-to-mesh agreement can pass a fully straight, unreachable leg. Check original target reach
before clamping, the visible hoof or sole underside and orientation in a common ground frame, clearance extent, stance
drift, joint limits and excursion through a full existing moving-root gait cycle. For mounted units, check shared phase,
independent rider upper-body response and continuous pelvis/seat/stirrup contact. Apply the existing
`docs/architecture/animation-evaluation.md` motion and contact review to the affected scope; issue-free diagnostic
frames alone do not establish natural continuous motion. Compare the same asset in the animation gym and composed scene,
including translated/scaled parents, count changes and add/remove. Use a bounded representative-density packet, not an
exhaustive Cartesian product. Record mobile hardware evidence separately. These checks repair the shared procedural
pipeline; never substitute static or baked gameplay animation to conceal an integration fault.
