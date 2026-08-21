# P11 — the Aug 21 freeze convictions: kill the loop, make failure loud, make reconcile converge — Codex brief

Motto: **KISS, always. Systemic fixes over point patches. Success is deletion. Evidence before optimization.**

Context. The P10 perf merge (PR #4901, deployed as `265d3c1c4b` on Aug 20) froze players mid-match in the Aug 21
13:00-Paris blitz (game 28): "the game freezes and I have to exit", two players in the same minute. Production was
rolled back to `37ada08e7a` at 11:49 UTC and stays there. The incident was investigated with torii SQL, the Aug 20
`logs.txt` capture, and a four-way review of the merge; the root cause is **verified in source, not inferred**. Field
evidence: the chain stayed healthy the whole hour; client activity collapsed at 11:38–11:39 UTC immediately after a 3–4×
entity-update storm (4,572 `Resource` updates in six minutes); game 28 shows three earlier dips (minutes 5, 21–23, 31)
consistent with freeze→reload waves; the previous day's same-slot game on the good build ramped smoothly with no dips.
Work lands in slices, in order. **Nothing deploys from `next` until P11A and P11B land.**

---

## P11A — kill the infinite loop (P0, the root cause)

**Evidence (verified by reading the source):** `client/apps/game/src/three/managers/structure-manager.ts:1434`,
introduced by `6788cf54ac` "diff visible managers on chunk crossings":

```ts
while (slots.at(-1) === undefined) {
  slots.pop();
}
```

When a structure model bucket loses its last visible instance in a pass and gains none, its slot array becomes
all-`undefined`; `pop()` drains it to empty, then `[].at(-1)` is `undefined` and `[].pop()` is a no-op — the loop spins
synchronously forever. The `if (slots.length === 0)` cleanup right below proves the empty case was expected;
`removeVisibleStructureInstance` (`:1426`) unconditionally marks the model dirty, so the empty bucket flows straight in.
Triggers are ordinary late-match events shared by every client viewing the structure — a capture/destruction, a realm
level-up (buckets are per-level), a hyperstructure stage change, a one-occupant cosmetic bucket emptying, or the last
structure of a type leaving presentation bounds on a chunk crossing. That shared trigger is why two players froze the
same minute. The existing tests (`structure-manager.lifecycle.test.ts:645-700`) cover entering-only, mixed, and swap
passes but never "leaving all, entering none".

**Work:** guard the loop (`while (slots.length > 0 && slots.at(-1) === undefined)`), and add the missing test: a pass
that removes a bucket's last instance and adds none must terminate, set count 0, and delete the slot/draw-count map
entries. Then treat the class, not the instance: sweep the P10 merge for other compaction/drain loops whose exit
condition can go permanently true on an empty or non-advancing collection, and name the sweep result in the PR (one
known sibling to check: `waitForWorldmapHydratedRefreshQueueIdle` in `worldmap-hydrated-refresh-runtime.ts:113-130`
spins on `setTimeout(0)` with no deadline).

**Gate:** the new test is red on the unguarded code and green on the fix; the class sweep is listed in the PR body. This
slice is the fix and its test only — nothing else rides along, so the bisect stays clean.

## P11B — renderer failure must be loud, not a dead canvas (P0)

Three mechanical defects mean any renderer failure today is silent and permanent — which is why the incident produced
zero telemetry.

**Evidence:**

1. **Device-loss handling is dead code in production.** `webgpu-renderer-backend.ts:118` captures
   `resolveWebGpuRendererDevice(renderer)` before `renderer.init()` is awaited (`:469`). In three r185,
   `WebGPUBackend.device` is `null` until `init()` resolves, so the captured device is always `null`,
   `attachWebGpuDeviceDiagnostics` (`:215-224`) short-circuits to a no-op, and `device.lost` / `uncapturederror` are
   never subscribed. The entire recovery machinery in `game-renderer.ts:181-332` never runs. The unit test passes
   because `webgpu-renderer-backend.test.ts:220-230` injects a fake factory that returns a device shape the real factory
   never produces — the mock encodes the bug.
2. **One thrown frame kills rendering forever.** `renderer-animation-runtime.ts:41-48` calls `requestNextFrame()` after
   `renderFrame()` with no `try/finally`, and `renderer-frame-runtime.ts:60-94` contains no `catch`. Under WebGPU this
   is much hotter than it was under WebGL: `device.queue.writeBuffer` throws synchronously on a bad range where WebGL
   raised a silent GL error.
3. **Recovery, when it runs, can strand itself.** `handleDeviceLossFallbackFailure` (`game-renderer.ts:327-330`) never
   clears `isRendererRecoveryPaused`, so the loop stays stopped; `hasRecoveredFromDeviceLoss` (`:211-213`, latched at
   `:315`) makes a second device loss a silent no-op; and after a successful WebGL fallback there is no context-loss
   handling at all (`attachWebGpuDeviceDiagnostics` bails when `activeMode !== "webgpu"`).

**Work:** resolve the device after the awaited `init()` and attach diagnostics to the real device; route the test
through the real factory path so the fixture can't lie. Wrap the frame body so `requestNextFrame()` always runs and the
error is reported once (diagnostics line + Sentry tag), with a circuit breaker if the same error repeats every frame.
Clear `isRendererRecoveryPaused` on fallback failure. At minimum, every device loss — first, second, post-fallback —
must emit telemetry even where recovery is not attempted.

**Gate:** a test-simulated device loss reaches the handler through the real factory; a thrown frame error surfaces in
diagnostics and rendering continues; the Sentry event exists. State plainly in the PR what failure modes remain
unrecovered (e.g. second loss) — visibility is the P0 here, full recovery is not.

**Implementation notes (reviewer read-through, Aug 21):**

- A second dead consumer of the null device: `markRendererDiagnosticDeviceReady()` is gated on
  `initializedRenderer.device` (`webgpu-renderer-backend.ts:498`), so `deviceStatus` never reads "ready" today either.
  The fix must revive both the loss path and the ready mark.
- Delete the `device` field from `CreatedWebGPURenderer` and from the factory result entirely (wired-or-deleted — it is
  the channel the lying fixture used). Resolve the device once, via
  `resolveWebGpuRendererDevice(createdRenderer.renderer)`, after `waitForRendererInitialization` succeeds inside
  `initialize()` (`:469`), attach diagnostics there, and keep the existing `releaseDeviceDiagnostics` disposal wiring
  (`:440-445`, `:489-490`) intact.
- Reshape the fixture honestly: the mock renderer's `init()` populates `renderer.backend.device` — the r185 timing — so
  the test can only pass if production code reads the device post-init. Removing the field from the type makes
  TypeScript flag every fixture that still passes `device:` directly (currently
  `webgpu-renderer-backend.test.ts:223-231`). This reshaped test is the red→green evidence for the slice.
- The frame guard lives in `runRendererAnimationTick` (`renderer-animation-runtime.ts:41-48`): wrap
  `updateStatsPanel`/`updateControls`/`renderFrame` in `try/catch` with `finally { requestNextFrame() }`, surface the
  error through a new `onFrameError` input so the runtime stays pure, and keep the return value correct on the error
  path. The circuit breaker throttles _reporting_ (report the first occurrence with a diagnostics line + Sentry-visible
  `console.error`, then a summary every N repeats) — it does **not** stop the loop; rendering may self-heal when scene
  state re-dirties (three.js #34053 behaves exactly that way). Existing test homes:
  `renderer-animation-runtime.test.ts`, `renderer-frame-runtime.test.ts`.
- In `game-renderer.ts`: clear `isRendererRecoveryPaused` in `handleDeviceLossFallbackFailure` (`:327-330`), and when
  `shouldStartDeviceLossFallback()` declines because the one-shot latch is spent, record telemetry before returning
  instead of dropping the event silently.
- Scope fence: the prewarm re-arm at `game-renderer.ts:322` belongs to P11F — do not touch it in this slice. Remaining
  gaps to _state in the PR body, not fix_: the one-shot recovery latch, a loss during scene prep (the
  `hasPreparedRendererScenes()` gate at `:321`), and no context-loss handling after a WebGL fallback.

## P11C — reconcile must converge under sustained update load (P1)

**Evidence:** `requestVisibleStructuresRefresh` defaults `refreshExisting: true` (`structure-manager.ts:1074-1077`), and
every RECS subscription funnels into it — so any structure component update tears down and rebuilds **all** visible
structure instances, as **one** unsplittable `scheduleFrameBudgetWork` task (`:1177-1184`; the pre-`6788cf54ac` code
sliced per structure), with an O(N²) `findIndex` bind (`:1394`). Meanwhile the pass fence is invalidated (`:1079`)
before the runner version bumps, so under sustained event rates no pass ever commits; the 12s timeout → recovery → new
transition token loop is the incrementing `transition=1..15` counter in `logs.txt`, and the "critical … catch-up
converged over Xms" line prints even for a timed-out pass (`worldmap-critical-manager-catchup-runtime.ts:87-93`). The
11:32–11:37 Resource storm is what this path was grinding against when clients hit P11A.

**Work:** make targeted updates targeted — `refreshExisting: true` only for the callers that need a full rebuild;
re-slice the commit pass through the frame budget (restore per-structure yielding or commit the diff only); fix the
fence ordering so an in-flight pass can land and the next pass picks up the delta instead of every event killing every
pass; make the convergence log honest (converged vs timed-out). Success is deletion: if the fence and the coalescing
runner both survive this slice unchanged, be suspicious.

**Gate:** a synthetic-burst test (structure component updates arriving faster than one per pass) shows passes committing
and the transition counter flat; the owner instrumentation shows no full-rebuild task on an ordinary troop-guard update.

## P11D — stranded fences (P1)

**Evidence, three independent strands from the same merge:**

- `army-chunk-transition-finalizer.ts:16-18` returns on a losing transition without clearing `isArmyChunkTransitioning`;
  `executeRenderForChunk` sets it unconditionally (`army-manager.ts:1393`). A stranded flag means armies re-queue
  forever (`:1616-1620`), integrity self-heal is disabled (`:2363`), and only a stall recovery with a non-stale token
  clears it.
- `commitOwnedWorldmapPreparedTerrain` (`worldmap-owned-terrain-commit.ts:13-25`, from `3427d18e85`) drops the commit on
  a stale token, leaving `currentChunk` behind the camera — the next decision is `switch_chunk` again, a re-transition
  loop with no convergence criterion.
- `hexception-building-reconciliation.ts:36-42` does `Promise.all` over the append-only `modelLoadPromises`
  (`hexception.tsx:525`), whose entries reject on GLTF failure (`:561-564`). One failed asset poisons every subsequent
  reconcile silently for the session; the rest of the file already uses `allSettled` (`:531`, `:581`).

**Work:** clear the army flag on every finalizer exit path; give the terrain re-transition path a convergence rule
(commit-or-advance, never drop-and-retry-identically); `allSettled` the building reconciliation. Also on the record for
this slice's audit, pre-existing but same class: `frame-budget-work-queue.ts:161` awaits async tasks that reach
`gltfLoader.load` with no timeout (`army-model.ts:228-262`) — one hung fetch parks every lane. Fix or explicitly defer
with a note in the PR.

**Gate:** tests for the losing transition clearing the flag and for a failed model load not poisoning reconciliation;
the terrain rule is stated in the PR.

## P11E — dirty-range uploads: rework or revert (P2)

**Evidence:** `1ef8166600` is a no-op by construction under the WebGPU backend. The renderer clears the _mirror_
attribute (`three/src/nodes/accessors/Instance.js:174-206`), never the source, so `markInstancedAttributeRangeDirty`'s
merged span grows monotonically; most meshes mark the full buffer dirty at construction anyway
(`army-model.ts:503/507/404`, `instanced-biome.tsx:187/200`, `instanced-model.tsx:95`, etc.); and meshes with ≤1024
instances — `ARMY_INSTANCE_CAPACITY = 1024`, exactly the 64KB uniform limit — take a uniform path that ignores app
ranges entirely and rewrites the full 64KB per mesh per frame. The unit test
(`instanced-attribute-update-range.test.ts:30-42`) manually calls `clearUpdateRanges()` to simulate a renderer step the
WebGPU backend never performs — the test encodes the wrong contract.

**Work:** decide with evidence: either make the mechanism real (frame-token clear-and-set on the source attribute,
bounds-clamped — a bad range is now fatal per P11B#2 — with a measured upload-volume delta from `GpuBackendPerf`), or
**revert the helper and its call sites entirely**. A perf commit whose measured effect is zero does not stay because it
looks right. Fix or delete the lying test either way.

**Gate:** a before/after `GpuBackendPerf` capture in the PR showing reduced upload volume, or the helper deleted.

## P11F — texture prewarm hygiene (P2)

**Evidence:** the local-view prewarm (`1c196916b6`) uploads ~200MB that stays resident all session
(`local-view-texture-prewarm.ts`, budget const 512MB at `:6`); its interaction gate (`:146-149`) retries unboundedly so
the burst fires at an arbitrary mid-game 2s mouse pause, contradicting its own "idle load time" framing; it is re-armed
as the first act after a device-loss recovery (`game-renderer.ts:322`) — a 200MB speculative upload into the context
that just survived an OOM; `page_hidden` cancels it and nothing re-arms (`:439-441`); and `isWorldmapActive()` sits
outside the `try` (`:142`), stranding the controller on a throw.

**Work:** never re-arm after device-loss recovery; cap the budget far below 512MB and gate on `renderer.info.memory`;
give the interaction gate a deadline; move the guard inside the `try`. If after P11B's telemetry the prewarm shows no
measured win, the P6D precedent applies: delete it.

**Gate:** prewarm cannot fire post-recovery (test); budget and deadline named in the PR with the numbers that justify
them.

---

## r185 / WebGPU context (advisory, not a slice)

**Ratified (operator decision, Aug 21): the client stays on the latest released three — no downgrade, ever.** r185 is
current; take r186 when it releases (it carries the WebGPU stale-bind-group fixes). Known upstream on exactly our
version, on the record so nobody mistakes these for our bugs: three.js #34053 documents a permanent frozen-canvas state
on 0.185.1 (closed unreproduced, unfixed — its tell is a per-frame "Vertex buffer slot N was not set" flood); #33821
documents 16–36× slower material init on WebGPU (matches our 5s material-attributed frames). If P11A+B do not stabilize
live play, the only fallback lever is the existing `webgpu-force-webgl` build mode — same three version, different
backend — and flipping it is an **operator decision, not a slice**. Separately on the record: the compat shim ships two
copies of the three core to production (`three-webgpu-compat.ts` re-exports `three/webgpu` and `three/src/Three.js` —
pre-existing, not from this merge), and `cosmetic-model-viewer.tsx:83` recreates a WebGL renderer on every hover flip.
Both are follow-up candidates, not P11.

## Order and rules

**Ratified (operator decision, Aug 21): the whole brief ships in one PR.** All remaining slices land on
`fix/p11a-structure-slot-drain` and merge together as PR #4902 — P11A is already on it (`844010df75`). Implement in
order B → C → D → E → F, **one commit per slice**, each commit self-contained with its tests and a real body, so the PR
history stays bisectable even though the merge is atomic. If a later slice forces a change inside an earlier slice's
files, it goes in the later slice's commit with a sentence of justification — never amend a landed slice.

Update the PR body as slices land: per-slice evidence (red→green where a slice has a regression test), the E decision
(rework vs revert) with its justification, and the P11B list of remaining unrecovered failure modes. Production stays on
`37ada08e7a` until this PR merges and the operator deploys. Subject-only commits do not merge.

## Validation

- Every slice: focused tests, typecheck, `pnpm run format`, `pnpm run knip`, run from the actual commands — claims that
  don't come from a command run are not claims. In `client/apps/game` use `pnpm test [files]`; the three load-sensitive
  files (`instanced-model.material-semantics`, `game-entry-preload`, `play-asset-manifest`) must be green in isolation
  before being blamed.
- P11A additionally: the red→green test run pasted in the PR. P11B additionally: the simulated device-loss and
  thrown-frame tests named, plus the honest list of still-unrecovered failure modes.
