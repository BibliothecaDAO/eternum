# Independent troop development

Use this route for troop framework, skin, gear or procedural motion work. Read only the selected family:
[Knight](troops/knight.md), [Crossbowman](troops/crossbowman.md), or [Paladin](troops/paladin.md).
[Shared scale/formation requirements](troop-families.md) still apply. Resolve the active repository before following
source paths; the current detailed design is `docs/architecture/troop-asset-animation-framework.md`, with executable
migration work orders at `docs/plans/troop-pipeline/implementation.md` when present.

## Choose the track and preserve its scope

- **Framework maintenance:** inspect real runtime seams, record decisions and executable handoffs. Do not generate art,
  create unused controller shells or claim planned runtime capabilities are implemented.
- **Default/new skin:** concept → approved raw mesh → compact Blender source/rig → runtime representations → family
  adapter → world review. A missing rig can remain pending during geometry selection. Build diagnostic ROM and the
  requested integration; a skin task does not require finishing the family's entire action library.
- **Equipment revision:** identify the active skin, catalog item ID, source and live review first. An archived Tripo
  candidate may differ from the legacy/procedural item actually displayed. Resolve an ambiguous target from available
  context or ask for the intended item/delta before editing. Revise one family/role and its affected contacts/motions.
  Inspect current action/count support; record gaps rather than silently commissioning a runtime migration during a
  cosmetic edit. Do not alter body anatomy or other families to make the item fit.
- **Motion development:** use [procedural animation](procedural-animation.md) with exact source/controller/profile and
  references. A runtime/controller fault is not authorization to regenerate an approved Tripo model.

Each family has its own active asset brief, source/export paths, adapters, controller/profile revisions, references and
evidence under existing repository conventions. Put the current checkpoint, hashes and approval status first; explicitly
mark older SOURCE sections as history so a search hit cannot supersede the active record. One troop's new candidate must
not replace another troop's accepted records. Use one owner for shared files/live resources. Reuse pure math,
bind/loader utilities, capture tooling and reviewed style decisions; keep tuning and mutable actor state separate.
Coordinate shared changes with affected-family regressions rather than rerunning every art-generation stage.

## Skin and equipment contract

Armor, clothing and anatomy belong to the **model skin**. Separate armor objects are an authoring convenience, not
helmet/torso/leg equipment slots. Knight and Paladin have primary weapon + secondary shield; Crossbowman has primary
crossbow + secondary bolt quiver. Items are compatible only within their troop family, including visually similar
swords. Do not infer cross-family compatibility from shared humanoid rigs or matching socket names.

Pin family, skin/binding, controller/profile, item and representation revisions in a delivery. Record actual bone/rest
frames and capabilities, source/world units and already-applied scale. Gear declares family, role, motion class,
attachment frames, dimensions and contact landmarks. Preserve fixed rigid item dimensions; solve contacts using an
approved skin fit profile. A proportion variant may need new calibration or a versioned adapter, not a copied
controller.

Before expensive integration, run the small metadata preflight from the skill directory:

```bash
node scripts/validate-troop-package.mjs /absolute/path/to/package.json
node --test scripts/test-troop-package.mjs
```

Use the deliberately synthetic [Knight](../assets/troop-packages/knight.example.json),
[Crossbowman](../assets/troop-packages/crossbowman.example.json) and
[Paladin](../assets/troop-packages/paladin.example.json) records as shape examples. They are not asset registrations or
proof that all example actions work. The script checks count, family/role, declared attachment capabilities, rig
version, controller motion classes and requested actions. It does not load GLBs, enforce the game's registries, inspect
physical fit or grant production status. Verify declared capabilities/actions against actual code; never add fictional
bones or mark a missing action implemented to pass metadata validation.

At runtime, validate/stage replacements before changing the visible actor, preserve the last valid assembly on failure
and release actor-owned resources. A same-family metadata pass still needs bind/neutral/motion fit. Reuse immutable
geometry/maps; never share a writable skeleton, contact anchor or controller across formation members.

## Placement and promotion

The world owns root movement and terrain frame. Adapters own rig/rest interpretation; controllers own relative pose.
Apply source/formation/world transforms before grounding and contacts. Reset/rebase planting on teleport/scale/terrain
change. Test every supported count: Knight/Crossbowman 1–6, Paladin 1–3. Stable visual member IDs are subordinate to one
army entity/selection; gameplay strength thresholds are not invented by the asset workflow.

Keep model approval, action readiness, metadata/loaded compatibility, all-count review, device performance, publication
and production selection distinct. The current Paladin pilot and stage do not prove production formation expansion.
Default skins use the same contracts as future skins; do not develop an unrequested cosmetic inventory. Preserve
[quality accounting](quality-presets.md) and [compact retention](retention.md) throughout.
