# Renderer lane — the WebGPU revisit — Codex brief

Motto: **KISS, always. Systemic fixes over point patches. Evidence before optimization.**

Context: automatic WebGPU was deleted from the boot on 2026-09-03 (`6ca9af0770d`, record "automatic WebGPU deleted from
the boot entirely" in `realms-client-brief.md`) after a playtest where boots were stalling and the owner's conviction
was "with the webgl fallback it was loading instant". The owner now wants WebGPU back. The history is four records in
the client brief: half two class 2 (a 15 s probe on every fresh profile), L5d(e) (adapter-timeout as a soft verdict with
an idle re-probe), "cold profiles never wait for WebGPU" (a 3 s idle qualification that promoted the profile), and the
deletion. Read all four before touching the lane.

**The class of failure.** Every one of those designs coupled the lane decision to the boot's health through timers:

- A promoted profile attempted real WebGPU init under a **15 s** bound (`WEBGPU_BACKEND_STARTUP_TIMEOUT_MS`,
  `webgpu-renderer-backend.ts:166`) during a saturated boot, the one situation the qualification never tested.
- Only a stall fell back: `startRendererLaneWithWebGlFallback` rethrows anything that is not the timeout error
  (`webgpu-renderer-backend.ts:463`). Any other init failure escaped to a hard bootstrap error.
- Telemetry reported the **requested** lane: `createDefaultWebGPURenderer` returns
  `activeMode: forceWebGL ? "webgl2-fallback" : "webgpu"` before `renderer.init()` runs (`:124`). Three 0.185's
  `WebGPURenderer` installs its own silent `getFallback` to `WebGLBackend` when WebGPU is unavailable
  (`three/src/renderers/webgpu/WebGPURenderer.js:57-69`), so a "webgpu" boot may have been running WebGL2 while the
  `[FramePerf]` and Sentry `renderer_mode` tags said webgpu. The truthful resolver exists,
  `resolveWebGpuRendererActiveMode` (`:206`, reads `backend.isWebGPUBackend`), but only the four debug renderers call
  it. **The playtest telemetry therefore cannot say which lane actually ran.** That is why this brief measures before it
  decides.

**Hardware facts to carry.** The owner's machine (Brave, KDE Wayland, RTX 3070 Mobile): on 2026-08-24 no supported
hardware-WebGPU path existed and the ANGLE-Vulkan flags wedged the GPU process; on 2026-09-02 `requestAdapter()` at idle
returned a real adapter (18 features). Whether that adapter is hardware or a software fallback has never been recorded.
A software adapter is a hard `webgl2` verdict, always.

**Fixture.** The current real game, `bltz-clash-538` (herald game 13), as defined in `boot-to-playable-codex-brief.md`.
Both lanes are reachable today through the explicit `?rendererMode=webgpu` and `?rendererMode=webgpu-force-webgl` query
flags.

---

## 0. Truth first — one small commit, lands before anything else

**Fix, three parts in `webgpu-renderer-backend.ts`:**

- `activeMode` is decided after `renderer.init()` by `resolveWebGpuRendererActiveMode(renderer)`; the pre-init flag is
  only the request. A webgpu request that Three downgraded records `activeMode: "webgl2-fallback"`,
  `fallbackReason: "webgpu-silent-fallback"`, and remembers the hard `webgl2` lane. Add the adapter identity to
  `RendererInitDiagnostics` and `__rendererDiagnostics` (vendor, architecture, description, whether the adapter is a
  fallback adapter, from the adapter info API) so a record can say what ran.
- Any init failure falls back once. `startRendererLaneWithWebGlFallback` catches every error except abort, disposes the
  partial renderer (`disposeCreatedRenderer` already exists), starts WebGL2 once, and remembers `webgl2` with the error
  class as the reason. `RendererInitTimeoutError` becomes one reason among others. The boot state is untouched: the
  fallback happens inside `initialize()`, the caller sees one resolved lane.
- The WebGPU init bound stops being a round number. Measured WebGPU inits on this branch are 285–537 ms headless and 317
  ms on a remembered lane; set the bound at roughly 10× the measured p95 and write the derivation in a comment. Anything
  above 5 s is wrong by construction: that is longer than the whole WebGL2 boot to first terrain on the box.

Retarget `renderer-lane-discipline.source.test.ts` on the relocation basis: it keeps banning the capability addon and
the idle-promotion strings; it gains "the WebGPU init bound is ≤ 5 s" and "the fallback branch has no error-class
filter".

**Gate:** backend suite: a mocked backend with `isWebGPUBackend: false` under a webgpu request reports
`webgl2-fallback` + `webgpu-silent-fallback`; a rejecting `init()` (not a timeout) reaches WebGL2 and bootstrap
succeeds; diagnostics carry the adapter identity; existing cases still green. Typecheck. This commit is independent of
the rest and is also the prerequisite for the boot brief's tables.

### Record — item 0 landed (2026-09-03)

**Conviction.** Three chooses the active backend during `renderer.init()`, so the pre-init request could not identify
the lane that ran. The 285 ms and 537 ms measurements cited above came from WebGL2 runs. The remaining 317 ms
remembered-lane observation also predates truthful backend telemetry. It is not a measured WebGPU p95.

**Fix.** `5058903bfb1` derives `activeMode` from the initialized backend, copies adapter identity into renderer
diagnostics, and retries WebGL2 once after any WebGPU initialization failure. A silent fallback inside Three records
`webgpu-silent-fallback` and remembers WebGL2. `6dfd0c06422` applies the provisional 3.2 s ceiling only to WebGPU.
WebGL2 keeps the previous 15 s ceiling because no renderer lane remains behind it. Both values are pinned in the source
test. The unused `AbortError` exception was deleted; the internal abort now carries the lane-specific timeout error.

**Headless fixture smoke.** One fresh-profile load per explicit mode on `bltz-clash-538`, Brave 1280×720:

| Requested mode       | Active mode       | Fallback reason      | Backend total | Three init | Entry ready |
| -------------------- | ----------------- | -------------------- | ------------: | ---------: | ----------: |
| `webgpu-force-webgl` | `webgl2-fallback` | none                 |         23 ms |      19 ms |   12,117 ms |
| `webgpu-auto`        | `webgl2-fallback` | `webgpu-unavailable` |         58 ms |      29 ms |   10,471 ms |

The headless browser exposed no WebGPU adapter, so `adapterInfo` was null. This smoke verifies truthful fallback and
boot completion; it is not the item 1 lane comparison.

**Gate.** The renderer backend, lane-discipline, diagnostics, and backend-v2 suites pass, 33 tests after the review
follow-up. `apps/game` typecheck and scoped Prettier pass. The original item-0 worktree passed `knip`; the follow-up
worktree is currently blocked by an unrelated shared-worktree export, `HyperstructureShare`. The full client run passed
824 files and retained ten unrelated existing suite/file failures.

## 1. Measure before deciding — is WebGPU better on the machines that matter?

Nothing about automatic selection is written until this table exists.

**Do:** with item 0 deployed, spectate the fixture on both lanes via the explicit flags, headless and on the owner's
machine, fresh profile each time: renderer init ms, `createRenderPipeline` count and total ms on first load (the
half-two class-1 number was 91 calls / 10.8 s; item 15's compile-before-first-draw is in place now), first terrain,
time-to-playable, frame p50/p95 at distances 10, 25 and 45, and the adapter identity. Three loads per lane per machine;
report medians.

**Decision gate (owner rules on the numbers):** WebGPU must beat WebGL2 on close-band p95 by a margin the owner names,
with time-to-playable within +10 %, on hardware adapters only. If it does not, the revisit ends here with the table in
the record and WebGL2 stays the lane; that is a successful outcome of this brief, not a failure.

## 2. Qualification off the boot path, on real content — only after item 1 passes

Adapter detection and a bare idle `init()` were rightly ruled insufficient evidence. The evidence that predicts a boot
is the work a boot does.

**Fix:** a fresh profile still boots WebGL2 (unchanged, proven fast). Once `world-interactive` has fired and the frame
budget has been quiet for a few seconds with the tab visible, run one qualification: create a disposable WebGPU renderer
on an offscreen canvas, `init()` under item 0's bound, run the item-15 pipeline compile list against it
(`compilePipelines`), render the live scene for 30 frames to an offscreen target, dispose everything. Record
`webgpu-proven` with the evidence in the reason string (`proven:init=..ms,compile=..ms,p95=..ms`) only if init and
compile fit the bound and the frame p95 is at or below the WebGL2 p95 of the same quiet window. Anything else records
hard `webgl2` with the reason. A software or fallback adapter records hard `webgl2` without qualifying. One attempt per
profile; the explicit `?rendererMode=` flag remains the manual override and re-arms it.

**Constraints:** zero work on any boot path; the disposable renderer never touches `#main-canvas`; no timer other than
the init bound; the qualification aborts if the tab hides or a spike frame lands mid-run.

## 3. The first WebGPU boot is the exam — and it can demote itself

A `webgpu-proven` profile boots WebGPU under item 0's bound with item 0's fallback. That boot records its
time-to-playable on WebGPU next to the profile's remembered WebGL2 time-to-playable. If it fell back, or exceeds the
WebGL2 number by more than the margin the owner named in item 1, the verdict demotes to hard `webgl2` on its own; no
storage clearing, no support instructions.

**Gate:** lane and backend suites; headless: fresh profile boots WebGL2, qualification records proven or the reason it
did not, second load boots webgpu with a truthful `activeMode`, a forced silent-fallback run demotes. The playtest is
the regression test: a CPU-throttled boot (devtools 4× or the headless equivalent) on a proven profile must not exceed
the WebGL2 time-to-playable plus the bound. Owner's machine: the same three loads with the telemetry pasted in the
record.

## 4. Cleanup

Rename `webgpu-unproven` to what it now means; update the `latest-features.ts` renderer entry; append a pointer from the
client brief's "WebGPU parked" record to this brief's record.

## Validation

- `webgpu-lane-probe.test.ts`, `webgpu-renderer-backend.test.ts`, `renderer-lane-discipline.source.test.ts`,
  `game-renderer.backend`, diagnostics suites; full `apps/game` suite via `pnpm test`; typecheck, `pnpm run format`,
  `pnpm run knip`.
- Records appended to this brief per item; item 0 is its own commit; item 1 is a measurement hand-back with no code;
  items 2–3 only after the owner has read item 1's table.

## Non-goals

The native WebGPU post-process runtime stays off (`ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME = false`); no WebGPU-only
visuals; no mobile lane work; no Brave flag advice in the product.

## Risks and open decisions

- The owner's stack may simply have no hardware WebGPU. Item 1 answers that honestly and the revisit ends.
- Two GPU devices coexist in one page during qualification; dispose promptly and abort on `visibilitychange`.
- The margin in item 1 is the owner's call and is written into the record before item 2 starts.
