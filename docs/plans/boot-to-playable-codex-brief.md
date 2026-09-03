# Boot to playable — Codex brief

Motto: **KISS, always. Systemic fixes over point patches. Success of systemic work is deletion.**

Context: after the prewarm-barrier fix (`b3bbc2e3a5c`) the owner's live boot on the fixture game converges but takes ~50
s to playable. The log shows the whole first-chunk pipeline racing at once and every wall-clock timer blowing while work
is still progressing: `asset_prewarm` 12 s, the 20 s chunk-transition hard timeout, both critical manager catch-ups at
12 s each, recovery churn, and 130–150 `[FramePerf]` spike frames per 10 s (worst 531 ms `terrain:composite:present`).
The loader meanwhile sits at 92 % for most of that time. This brief is the item queued in `realms-client-brief.md`
("Queued — boot contention", 2026-09-03) plus the loading surface that shows the wait. It replaces the "Phase 1 reliable
entry" and "Phase 2 unified loading journey" proposals: what they asked for is either already built or is the wrong
direction, see item 3.

**Fixture.** One game: the current real game, today `bltz-clash-538` (herald game 13, 84 players, main phase until
2026-09-06 20:00 UTC). A finished game stays spectatable with its final state, so every capture below is replayable
against game 13 after it ends. Herald's directory is `GET https://herald.realms.party/madara/games`; its `status` field
reads `Live` for ended games too, so derive phase from `clock`. Spectate URL:
`/play/madara/bltz-clash-538/map?spectate=true&dev=1`. Recipes: headless Brave 1280×720, `.env.production` copied to
`.env.local`, read `__eternumGameEntryTimeline`, `__eternumGameEntryDurations`, `__eternumSyncMetrics`,
`getWorldmapRenderDiagnostics()` and the `[FramePerf]` digests from the console log; never run typecheck or knip while a
measurement window is open.

**Renderer telemetry prerequisite.** Every boot number recorded here must carry a truthful `renderer_mode`. Today the
backend reports the requested lane, not the initialized one (`webgpu-renderer-backend.ts:124`). Item 0 of
`renderer-lane-webgpu-revisit-codex-brief.md` fixes that in one small commit; land it first so the tables below are
trustworthy.

---

## 0. Measure first — break the 50 s down and name the owners

The timeline already exists: milestones `enter-game-started` → `bootstrap-*` → `initial-sync-*` → `renderer-init-*` →
`worldmap-scene-ready` → `worldmap-terrain-visible` → `world-interactive` (`ui/layouts/game-entry-timeline.ts`), with
durations `initial-sync`, `renderer-init`, `worldmap-first-terrain`, and the recorded worldmap durations. Nothing new is
instrumented until the existing numbers have been read.

**Do:** on the fixture, headless and on the owner's machine (the owner pastes the timeline JSON; add a one-line console
recipe to the record so they can), produce the table: stage, duration, owner of the longest spike inside it. Bisect the
two suspects that added upfront work: the 12 → 16 active-page raise (`e2cfb3e90ae`) and the army-model prewarm (the
item-2 barrier). State what each costs on a slow boot, by measurement, not by reasoning.

**Gate:** the record names the dominant costs with numbers before any code in items 1–3 lands.

## 1. Progress-based deadlines — a timer never means failure while work advances

Every boot timer today is a wall-clock total: critical catch-up (12 s), chunk transition hard timeout (20 s), asset
prewarm (12 s). Chunk recovery already claims a bounded failure signature and waits for a forward-progress mark (record
"WebGL2 prewarm and progress-bounded chunk recovery"); the other timers know nothing about progress.

**Fix:** each of those deadlines fails on "no progress for N s", never on total duration. Progress is the marks that
already exist: pages landed, models compiled, manager batches applied. One generous absolute ceiling remains as the
stall detector, and a deadline that no longer means failure does not `console.error`. Build on the chunk-recovery
progress marks; do not invent a second progress channel. Files: `worldmap-critical-manager-catchup-runtime.ts`, the
chunk presentation and recovery runtimes, `warp-travel-chunk-switch-commit.ts`.

**Gate:** unit tests: progressing work at twice the old timeout is not failed; stalled work is, at the stall ceiling.
The owner's log after this item shows zero `_timeout` errors while the timeline still advances.

## 2. Stage the first boot — playable first, everything else streams

The first chunk loads terrain pages, structure models, army models, catch-ups and labels concurrently, all before
`world-interactive`. Playable means the map plus what the viewer acts on: for a player their own units; for a spectator
the visible window's structures. Everything else can arrive after.

**Fix:** order the first boot terrain pages → critical entity models → the rest, through the existing frame-budget lanes
and `worldmap-content-ladder.ts`. No new queue, no new scheduler. `world-interactive` fires at playable; add one
milestone `world-settled` for the moment everything has streamed, so the two are measured separately.

**Gate:** headless first terrain unchanged or better; time-to-playable before/after in the record; the owner's live boot
on the fixture is the acceptance. The record proposes the time-to-playable bar from the measured floor and the owner
rules on it. Do not set the bar before item 0's numbers exist.

## 3. One loading surface, driven by the boot phase — delete the second truth

The "Phase 2" proposal assumed several competing loaders. Inventory: the inline `#boot-shell` in `index.html` (CSS only,
`data-boot-state` booting → react-mounted → app-loading → app-ready, reduced-motion handled at `index.html:332`),
`LoadingScreen` (`ui/modules/loading-screen.tsx`, the Suspense fallback and the pre-ready route views in
`game-route.tsx`), and `GameLoadingOverlay` (`ui/layouts/game-loading-overlay.tsx`). All three render the same
`BootLoaderShell` with the same contour animation; the first frame already needs no Three.js and the game route is lazy
for exactly that reason; Enter and Spectate already share one path (`resolveBootPhase` skips only `await_account` for
spectators). The presentation is unified. What is not unified is the state:

- `useUIStore.showBlankOverlay` (`use-ui-store.ts:57,194`) is a second boolean truth beside the twelve-phase
  `PlayRouteBootPhase` machine (`play-route-boot.ts:67`): set at `play-route-boot.ts:300`, cleared at
  `game-loading-overlay.tsx:151`, read by `GameRouteShell` to gate URL normalization and by `PlayOverlayManager`.
- `GameLoadingOverlay` carries its own `SAFETY_TIMEOUT_MS = 15_000`, `SLOW_THRESHOLD_MS = 8_000` and a 250 ms
  `setInterval` (`:14-16`, `:69-77`, `:177-186`). The safety timer only changes a sentence; the phase machine already
  has `error` and `reconnect_required`.
- `resolveBootProgress` clamps `wait_worldmap_ready` to ≥ 92 and `handoff_scene` to 97 (`play-route-boot.ts:208-227`):
  the bar reads 92 % for forty seconds of a fifty-second boot.
- The swap from the route's `LoadingScreen` to `GameLoadingOverlay` when `ReadyApp` mounts remounts the shell and
  restarts the contour animation: that is the flash the proposal anticipated.

**Fix:** one React surface for the play route, mounted once, visible while `PlayRouteBootPhase !== "ready"`, its content
derived from the phase and the task list. Delete `showBlankOverlay` and its setter (the `GameRouteShell` normalization
gate reads the phase instead); delete the safety timer, the slow threshold and the tick (elapsed time comes from the
timeline snapshot `BootDebugPanel` already subscribes to); delete the 92/97 clamps and the percent, show the tasks (the
bracket loader is indeterminate until tasks complete, then segments = tasks done). Add reduced-motion handling to
`ContourMapAnimation` and `SegmentedBracketLoader` to match `index.html`. `LoadingScreen` stays only as the Suspense
fallback for lazy chunks and renders the same component, so nothing remounts across the handoff.

Leave `isLoadingScreenEnabled` / `LoadingOroborus` alone: that is the in-game scene transition fade
(`transition-manager.tsx`, `use-navigate.ts`), a different class, not a boot surface.

**Not in scope, by ruling:** no 3D loader tableau, no terrain relief on the production renderer, no second renderer, no
fake percentages, no timer-driven copy. Item 0's log says the GPU and main thread are saturated during the exact window
a tableau would render into; the loader's job is to get out of the way faster.

**Gate:** `loading-surface.source.test.ts` asserts no `showBlankOverlay`, no `SAFETY_TIMEOUT_MS`, no `setInterval` in
the overlay, no numeric progress clamp; overlay tests cover each phase's content; headless captures at 0.5 s, 2 s and at
the handoff show one continuous surface (pin with a stable `data-boot-surface` element identity across the captures, or
a mount-count test); the debug panel still shows the running task label.

## 4. Cleanup

`WorldLoading` (`ui/shared`) shows "Gathering Merchants / Counting Gold …" from `loadingStates`. Find its producers; if
none fires in a blitz spectate on the fixture, delete it (wired or deleted). Not blocking.

## Validation

- Focused suites: play-route-boot, game-loading-overlay, boot-loader, chunk presentation / recovery / catch-up, content
  ladder; then the full `apps/game` suite via `pnpm test` (known contention flakes:
  `instanced-model.material-semantics`, `game-entry-preload`, `play-asset-manifest`; the documented pre-existing red:
  `worldmap-initial-refresh.source.test.ts`); typecheck, `pnpm run format`, `pnpm run knip`.
- Live gates on the fixture: item 0's table; zero timeout errors while the timeline advances; time-to-playable before
  and after; one continuous loading surface from click to world.
- Records: append one record per item to this brief (conviction, fix, deletions, gate numbers), one commit per item,
  explicit paths only. Another agent shares the worktree; never stage the whole index.

## Non-goals

WebGPU (its own brief), player identity (its own brief), the chunk/terrain streaming reshape (not scoped by the
decomposition close-out ruling; it returns only as its own brief if item 0 convicts it).

## Risks and open decisions

- The 16-page raise may be the dominant cost. If so, 12 vs 16 is a tuning decision the far-band biome underlay makes
  cheap; record both numbers and let the owner rule.
- The time-to-playable bar is set from item 0's floor, not before.
