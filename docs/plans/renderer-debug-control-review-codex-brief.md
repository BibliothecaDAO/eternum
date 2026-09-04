# Renderer debug control and bootstrap error screen — review brief for Codex

Motto: **KISS, always. Systemic fixes over point patches. Success of systemic work is deletion.**

Scope: the uncommitted change on `client-scale-96p` (2026-09-04) that splits bootstrap errors from account recovery,
restores anonymous spectating from the active-games bar, and adds a WebGPU/WebGL2 reload control. Reviewed against the
diff and re-run locally: the eight touched test files pass (28 tests), `pnpm run knip` printed no findings. The
classification fix is sound and should land. The debug control is not ready.

---

## Keep as-is

- **Error before reconnect.** `resolveGameRouteView` (`game-route.utils.ts`) returns `error` ahead of every other view;
  the reconnect screen loses the retry it never owned; the retry moves to `PlayRouteBootstrapErrorScreen`. One
  chokepoint decides the view, so a sync failure can no longer render as a sign-in prompt. `game-route.test.tsx` pins
  it.
- **Spectate alias.** `RegisteredActiveGamesBar` passes `onSpectate`, not `onPlayGame` (`play-view.tsx:642`). The
  updated assertion in `play-view.live-dev-games.test.ts` is a source-string grep; that pattern predates this change, do
  not extend it further.
- **`[RendererDebug]` logs.** All five go through `verboseLog`, so they cost nothing unless `?logs=1` is on.

---

## Change before commit

### 1. A debug panel ships to every player, always on

`world.tsx:56` mounts `RendererDebugControl` unconditionally, `absolute bottom-12 right-6 z-50 w-52`, directly above the
version tag (`bottom-4 right-6`) and under the fixed right-side panel that can run `calc(100vh-32px)` tall
(`bottom-right-panel.tsx:901`). The sibling debug overlays on the neighbouring lines are gated on `DEV_MODE_ENABLED`;
this one is not.

A graphics choice already has a home: settings, under the "Video & Graphics" headline that owns the Quality selector
(`settings.tsx:149`). Pick one:

- **Preferred:** move the WebGPU / WebGL2 choice into that settings section, reusing the existing row style. Delete the
  `world.tsx` mount. One surface for graphics settings, no floating third panel.
- **Acceptable:** keep the mount, gate it exactly like `DevSyncOverlay` (`DEV_MODE_ENABLED &&`).

Loading (`BootDebugPanel`, already dev-or-slow gated) and the error screen keep the control as written.

### 2. What's New sells a debug tool as a feature

Drop the "Renderer Debug Switch" entry in `latest-features.ts` once §1 is done; a gated or settings-resident control is
not a player feature. Keep the spectating entry and cut it to one sentence: "Spectate from your active games works again
without signing in, and world-loading failures no longer send you to sign-in."

### 3. The switch silently persists verbose logging

`buildRendererDebugUrl` sets `?logs=1`, and `dev-mode.ts:32` persists that flag per browser until someone passes
`?logs=0`. The caption says logs are on for the reload, not that they stay on. Either say so in the caption, or make the
reload not persist (read the flag from the URL for that boot only). Prefer the second: a diagnostic reload should not
change the browser's default.

### 4. Player copy leaks developer language

`play-route-bootstrap-error-screen.tsx` subtitle: "This route is still valid, and no account recovery is required" is a
commit message, not a screen. Use: "The world could not finish loading. Retry, or return to the dashboard." Keep the
error message block; it is the diagnostic.

### 5. Small things, same pass

- `resolveCurrentHref` guards an SSR path this app does not have. Read `window.location.href` directly.
- The two `<a>` elements carry `role="button"` and `aria-pressed` while navigating like links. Drop the role; keep
  `aria-current` or the pressed styling for the requested lane.
- `RendererDebugControl` reads `snapshotRendererDiagnostics()` once per render with no subscription. Fine for reload
  semantics inside the ticking `BootDebugPanel` and on the error screen; add the one-line comment saying so.

---

## Verification owed

- Re-run the eight touched test files plus `settings` tests if §1 goes the preferred way; `pnpm run format`;
  `pnpm run knip`.
- Canvas smoke: the blocked run hit a `cairoTupleMembers` import that no longer exists anywhere in the tree; it was
  another agent's transient edit in the shared worktree, not this change. Re-run the anonymous spectator URL once the
  sample services are up and record: sign-in never shown, error screen shown on a forced bootstrap failure, the WebGPU
  button reloads with a fresh probe.
- One commit for the route/spectate fix and the screens, explicit paths only. The control's final home decides whether
  the settings module joins that commit.
