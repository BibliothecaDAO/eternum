# Instanced-buffer replacement freezes GPU state (ghost armies) — fix brief

Owner-reproduced 2026-08-19 (dev, `INITIAL_INSTANCE_CAPACITY` temporarily 2 + Debug Army Spawner): after a mid-session
instanced-buffer resize, army models freeze at their last GPU-visible position while labels keep tracking the entity,
new instances render white/garbage, and nothing recovers until a page reload. This is the "ghost armies" bug — the #1
item on the triage backlog.

## Root cause (verified, ours + three's)

GPU instanced buffers are fixed-size; the code "grows" them by **replacing the attribute objects**:

- `client/apps/game/src/three/managers/army-model.ts` — meshes created at `INITIAL_INSTANCE_CAPACITY = 64` (line ~141);
  `ensureModelCapacity` (~498-563) swaps in `mesh.instanceMatrix = new InstancedBufferAttribute(...)`, same for
  `instanceColor` and the contact-shadow matrix.
- Slot indices are **global across all armies**, and `setVisibleSlots` (~2490, ~2502) ensures capacity to the global
  draw count on **every** model — so crossing ~64 concurrent armies resizes every army model in one pass.
- The client renders through three r184's WebGPU renderer (both `webgpu` and `webgpu-force-webgl` modes use the **nodes
  pipeline** — the classic `WebGLRenderer`, which tolerates attribute replacement, is never used). `InstancedMeshNode`
  captures `{ instanceMatrix, instanceColor }` **once at node construction**
  (`three/src/nodes/accessors/InstancedMeshNode.js:25-27`), wraps the original arrays, and syncs GPU uploads from the
  _captured_ attribute's `version`/`updateRanges` every frame (`InstanceNode.js:223-251`). Nothing cache-keys attribute
  identity.
- After the swap, all `setMatrixAt`/`setColorAt` writes go to the new arrays the node never reads → the GPU draws
  resize-time state forever. Slots beyond the stale buffer sample undefined data (the white models).
- A resize **before a mesh's first draw is harmless** (the node captures post-resize attributes) — which is why fresh
  sessions work at any army count and only mid-session power-of-two crossings break the world.
- The P9 render auditor is blind to this by construction: `getDrawnSlotPosition` reads `mesh.getMatrixAt` from the new
  CPU array, which is _correct_. The staleness exists only on the GPU.

## Full census of the class (all must be fixed)

Poisonous post-creation replacements
(`grep -rn "\.instanceMatrix = \|\.instanceColor = \|\.morphTexture = " client/apps/game/src/three`):

1. `managers/army-model.ts:515,522,556` — armies (the reproduced bug).
2. `managers/instanced-model.tsx:599,606,632` — same resize copy at `DEFAULT_INITIAL_CAPACITY = 32` — structures and
   every other InstancedModel consumer carry the identical latent bug.
3. `managers/morph-texture-resize.ts:59` — replaces **and disposes** `mesh.morphTexture` (both managers call it); same
   captured-object class for morph/animation data.
4. `scenes/worldmap.tsx:6529` — lazy `instanceColor` creation on an existing mesh: verify it can only run before the
   mesh's first render; if it can run after, fix the same way (allocate at creation).

Already correct (the target pattern): `managers/highlight-hex-manager.ts:60` — fixed capacity allocated at creation,
never touched again.

## Fix

**One invariant: no instanced mesh's `instanceMatrix`, `instanceColor`, or `morphTexture` is ever reassigned after mesh
creation.** Growth ceases to exist; capacity is fixed at creation, sized to that mesh class's real maximum.

1. **Armies** (`army-model.ts`): replace `INITIAL_INSTANCE_CAPACITY = 64` with a single `ARMY_INSTANCE_CAPACITY = 1024`
   (comfortably above the army cap; ~64KB matrix + 12KB color per mesh — the memory the doubling "saved" is
   meaningless). Allocate matrix, color, contact-shadow, and morph rows (`setupMeshAnimation`) at full capacity at
   creation. **Delete** `ensureModelCapacity`'s resize body (attribute replacement, copy loops, grown-slot zeroing) and
   the contact-shadow variant. In its place, one loud guard: if a required slot ever exceeds capacity, `console.error` +
   increment a worldmap render counter + clamp — never resize, never silently drop.
2. **InstancedModel** (`instanced-model.tsx`): same treatment. Size each consumer's capacity from its real documented
   maximum (audit call sites for the largest `initialCapacity` passed / instance counts reached) and fix it at creation
   with the same loud guard. Delete its resize body.
3. **Delete `morph-texture-resize.ts` entirely** (both callers are gone once 1–2 land) along with its test. Success of
   this brief is measured in deleted code.
4. **Enforce the invariant with a source test** (the repo already uses source tests for rules like this): fail if
   `.instanceMatrix =`, `.instanceColor =`, or `.morphTexture =` appears in `src/three` outside the allowlisted creation
   functions.
5. **While in `army-manager.ts`, land the sibling one-liner from the same backlog card:** `removeVisibleArmy`
   (~1241-1281) must call `this.pathRenderer.removePath(numericEntityId)` (mirrors `removeArmy:1871`) — evicting a
   mid-move army currently strands its red path line forever. Also delete `armyModel.cancelMovement` (zero callers,
   wired-or-deleted). Note: `onMovementVisualCancel` is NOT dead — `worldmap.tsx` subscribes it for travel-FX and
   arrival-ghost cleanup on eviction; keep that plumbing.

## Non-goals

- No renderer/backend changes, no three.js fork/patch, no auditor redesign (tracked separately on the backlog).
- No new config knobs: the capacity is a constant, not a setting.
- Do not "fix" by bumping 64 to a bigger number while keeping the resize — the resize path itself is the bug.

## Gates

1. **Repro flip:** in dev (`?dev` → lil-gui → Debug Army Spawner), spawn 100 armies mid-session, then move a real army.
   Before: model freezes while its label moves, spawned armies render white/garbage. After: everything moves and tints
   correctly. (To make thresholds dense pre-fix, temporarily set the capacity constant to 2.)
2. **Stale lines:** after the `removePath` fix, pan away from moving armies repeatedly — zero orphaned red lines at
   session end.
3. `cd client/apps/game && pnpm test`, `tsc`, and repo-root `pnpm run format` + `pnpm run knip` green. Note the three
   load-sensitive test files carry their own 30s timeouts — verify in isolation before blaming the change.
4. PR body: census table of every replacement site and what happened to it (fixed / deleted / verified-benign).
