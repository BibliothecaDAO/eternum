# P5 — startup: measure, then delete the vestiges — Codex brief, v2

Motto: **KISS, always. Systemic fixes over point patches. Success is deletion. Evidence before optimization.**

v2 ratifies the pre-implementation review corrections; where they conflict with the slice text below, v2 wins:

- **P5B's stamping diagnosis was wrong.** All 50 embedded cosmetic images carry `eternumContentHash`; the UUID names in
  the GPU log are instrumentation display names, not pool keys. The real defect is the all-registry fan-out:
  `asset-cache.ts:167` eagerly starts all 28 entries, including base army/structure models. Corrected fix: **delete the
  eager preload** and load only equipped/needed cosmetics — no pacing wrapper around work that should not exist.
- **P5D's 1.8s number is contaminated** — it includes asynchronous biome-model waits, and the critical budget is already
  exactly one page (`world-chunk-config.ts:89`). P5D becomes measure-first: split page CPU build, model wait, and commit
  timings; optimize only what the split convicts.
- **P5C needs attribution before collapsing** — catch-up logs must record chunk key, transition token, and trigger
  reason first.
- **P5A's capture must be a genuine prewarm-off cold entry** — existing logs are contaminated because prewarm continues
  in the background after its timeout.
- **P5F names the wrong variable** — chat wrongly consumes `VITE_PUBLIC_REALTIME_URL`, which factory discovery also
  needs; chat moves to `VITE_PUBLIC_CHAT_URL`, omitted in local development.

Execution order: (1) owner attribution + phase-accurate terrain/catch-up logging, (2) chat endpoint correction, (3)
genuine prewarm-off capture — stop at this gate and hand the capture request over, (4) delete prewarm if confirmed, (5)
delete the eager all-cosmetics preload, (6) optimize only the terrain/catch-up phases the new evidence convicts.

Context: with the corrupt KTX2 transcoder fixed deploy-side, a clean dev entry (Aug 17 log) still takes ~20s from wallet
connect to interactive. The sync layer is exonerated — recovery 1.7s, 1,873 entities, support queries <550ms. The
remaining ~17s is scene bring-up, and it decomposes into four owners:

| Phase                     | Cost     | Log evidence                                                                     |
| ------------------------- | -------- | -------------------------------------------------------------------------------- |
| Terrain critical pages    | ~1.8s    | `visual window rebuild took 1821ms (criticalPages=1819ms, pages=16, critical=1)` |
| Model load + prewarm gate | ~10s     | uniform ~50ms frames, then `pipeline prewarm 10008ms (timed out)`                |
| Cosmetics preload         | ~5s      | `1318ms`, `718ms`, `3842ms` single frames; `Preloaded 28 cosmetic assets`        |
| Catch-up re-runs          | overlaps | third convergence at `4808ms`/`4842ms` sliced wall time                          |

Work lands in slices, in order. Each slice cites its measurement in the PR.

---

## P5A — measure, then delete the entry prewarm gate

**Evidence.** Entry awaits the pipeline prewarm: `onInitialSetupComplete` (worldmap.tsx:3834) blocks
`announceWorldmapSceneReady()` on `prewarmPipeline()`, whose `prepare()` first awaits **every** model load settling
(`Promise.allSettled(this.modelLoadPromises)`, hexagon-scene.ts:806), then compiles under a Close warmup view until the
10s budget expires — in the captured entry it burned the full budget and still timed out. The same session proves the
premise is dead: after P4D's material consolidation, the cosmetics burst created **113 render pipelines in 9.4ms of
backend time** (~0.08ms each) and 114 programs in 3.9ms. The prewarm was built for the P3.1 world of 1–2 pipeline
compiles per second; that world no longer exists on this renderer.

**Work.**

1. Measure first: one cold entry with the prewarm disabled, recording compile-on-demand cost (pipeline/program count and
   total backend ms over the first 60s) and any first-interaction hitch. Put the numbers in the PR.
2. If the measurement confirms the log (expectation: tens of ms, spread across frames), **delete** the entry-gating
   prewarm as machinery, not just the await: the `runTimeboxedPipelinePrewarm` runtime, the warmup view lease and warmup
   camera, the model-load barrier, and the hexception/fast-travel background prewarm calls. Scene-ready is announced
   after the critical terrain pass, full stop.
3. The per-object `requestNewModelPipelinePrewarm` prefetch-lane path is judged by the same measurement — keep only what
   the numbers justify.
4. If the measurement surprises us (a real >1s on-demand compile cliff), stop and report — do not tune the timebox.

**Gate:** cold entry, wallet connect → interactive, ≤7s on the reference machine; no first-interaction hitch above the
current baseline; prewarm machinery deleted (net-negative LOC) or a recorded measurement justifying what remains.

## P5B — pace and stamp cosmetics

**Evidence.** `preloadAllCosmeticAssets` fires immediately after scene-ready and lands as 1.3s/0.7s/3.8s single frames
(guardrail 3: ambient work must be spread). Its textures log as UUID names (`55359965-…(1024×1024)`) — cosmetic assets
carry no `eternumContentHash`, so the material pool keys them `runtime:<uuid>` and shares nothing; cosmetics sit outside
the `compress-models` stamping pipeline entirely.

**Work.**

- Route cosmetic preloading through the existing frame-budget prefetch lane — same lane as model prefetch, no new
  scheduler.
- Extend content stamping to cosmetic assets at their build/packaging step (same sha256-in-extras scheme); if any load
  from sources we do not build, fingerprint at decode instead. P4D pooling must cover them.

**Gate:** no single frame >200ms attributable to cosmetics preload during entry; `[MaterialPool]` stats show cosmetic
sharing with zero `runtime:` keys for cosmetic textures; cosmetic visuals unchanged.

## P5C — one catch-up convergence per entry

**Evidence.** Critical army/structure catch-up converged **three times** in one entry (0.6s → 0.15s → 4.8s sliced wall
time); the third ran concurrently with the cosmetics burst and starved. Same work, re-derived — each entry-time chunk
transition re-triggers a full catch-up.

**Work.** Make entry converge once: find why a single boot produces multiple chunk transitions (URL focus → camera align
→ refresh chain) and collapse them, or make catch-up incremental so a transition after convergence only processes
deltas. Prefer collapsing redundant transitions — fewer triggers beats smarter re-work.

**Gate:** exactly one catch-up convergence per manager in an ordinary boot; total catch-up sliced wall time <1s.

## P5D — critical means critical in the terrain rebuild

**Evidence.** `visual window rebuild took 1821ms (criticalPages=1819ms, …, critical=1, pages=16)` — one page is
critical, yet the blocking pass builds enough to cost 1.8s of main thread before anything else can run (981ms on the
deployed build).

**Work.** The blocking pass builds only the genuinely critical page(s); the rest stream through the ambient lane that
already exists for chunk work. This is guardrail 3 applied to terrain.

**Gate:** blocking portion of the entry rebuild ≤300ms; remaining pages stream without a >100ms frame; the player's
focus hex is visible as early as it is today.

## P5E — name the frame owner

**Evidence.** ~150 consecutive spikes report `no GPU backend hot paths` — the instrumentation exonerates the GPU and
then goes silent. The single largest consumer of entry wall time is currently unnamed; principle 4 forbids optimizing it
blind.

**Work.** Lightweight owner attribution: the schedulers we already own (chunk work queue lanes, ingest slices, catch-up
runs, prewarm while it exists) set a current-owner marker; the spike reporter includes it —
`[GpuBackendPerf] spike 62ms owner=catchup:army …`. One module, ambient markers, no timeline tracing. This can land
first and sharpen every other slice's measurement.

**Gate:** during a cold entry, >80% of spike frames carry an owner; unowned spikes trend to zero as slices land.

## P5F — trivial: dev must not dial production chat

The dev client retry-loops `wss://eternum-production.up.railway.app` during entry. Env-gate the chat endpoint per
guardrail 4: unset in dev means loudly disabled, never a silent retry loop against production.

---

## Validation

- Focused tests per touched module; full client suite (known flake: `instanced-model.material-semantics`, plus one
  load-sensitive renderer-runtime timeout — verify in isolation); typecheck, format, knip. Validation claims come from
  running the actual commands.
- Every slice reports the same headline number before/after on the same machine: cold entry, wallet connect →
  interactive, plus the `[WorldmapPerf]`/`[GpuBackendPerf]` lines that motivated it.
