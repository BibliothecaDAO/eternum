# Realms game client — play only, and fast

Brief for the game-client pass on `apps/game`. Two halves: the **deletions** the L2/L3 split hands the client (the web
app takes the lobby and every L2 action — `realms-webapp-brief.md`), and the **performance classes** measured during the
A.3/A.4 gates (`realms-phase-2-brief.md`, A.3 findings). The client's job after this brief: open `/play?game=<id>`,
resolve the gameplay account from the identity session, connect to herald, render, and submit L3 transactions. Nothing
else.

Rules: the repo `AGENTS.md` and `apps/game/AGENTS.md`; client guardrails (RECS is the one truth; Herald's overlay is the
only shared provisional state; player events apply atomically; no silent defaults; wired or deleted). Every performance
change cites the measurement that motivated it and re-measures after.

## Half one — deletions (after the web app takes the lobby)

- `src/ui/features/landing/**` (the entry modal, worlds summary, game selector, play view),
  `src/runtime/world/ world-directory.ts` consumers that choose a game (the directory read stays only to resolve the
  `game` query into a world profile), spectator entry UI (spectate is a URL: `/play?game=<id>&spectate=1`,
  `utils/spectator-session.ts` stays the one source).
- Every L2 signer path: wallet connectors in the client, `VITE_PUBLIC_IDENTITY_RPC_URL` reads, cosmetics registration
  calldata (`services/blitz/blitz-settlement-calls.ts` cosmetic ids), `hooks/registration-cosmetic-token-ids.ts`.
- `src/ui/features/cosmetics/**` UI (gallery, showcase, chest-opening store, dev preview), `services/amm/**`, the
  prediction-market stubs (`MenuEnum.predictionMarket`, `View.PredictionMarket`, the retired buttons and comments),
  `VITE_PUBLIC_MARKETPLACE_URL`, `accountName` in the account store and the `Player-` fallback
  (`services/identity/ player-name.ts`: the name comes from the identity session).
- Whatever knip reports unused after the above. The three.js cosmetics render path (`three/cosmetics/**`) stays — it
  reads the RECS row.

Gate: `pnpm knip` clean; no `starknet` wallet connector in `apps/game`; the client builds with no L2 URL in its env; a
game plays from `/play?game=<id>` with the name from the session.

## Half two — the measured classes (quiet box, 2026-08-29)

| Measurement                          | Value                 | Bar       |
| ------------------------------------ | --------------------- | --------- |
| boot → bootstrap done                | 1.7 s                 | 1 s       |
| boot → first terrain                 | 5.2 s                 | 2 s       |
| WebGPU probe on a fresh profile      | 15 s timeout          | ≤ 1 s     |
| `createRenderPipeline` on first load | 91 calls / 10.8 s     | ≤ 2 s     |
| explore click → rendered, p50 / p95  | 267 / 302 ms          | p95 250   |
| fog reveal after explore             | late; 0.9 s animation | immediate |
| fog on provision / army creation     | does not clear        | clears    |

Classes and the fix for each (each is one chokepoint, not a set of patches):

1. **Render-pipeline compile on the critical path.** 91 pipelines compiled synchronously before first terrain. Fix: one
   pipeline warm-up list built from the asset manifest, compiled off the critical path (or precompiled per backend), and
   the first-terrain frame drawn with the terrain pipelines only. Evidence: `[FramePerf]` spike sink and the
   `__eternumGameEntryTimeline` `first_terrain` stage.
2. **WebGPU probe.** A 15 s timeout on a probe that answers in milliseconds when it answers at all. Fix: probe with a
   bounded budget (≤ 1 s) and remember the answer per profile; WebGL2 is the lane on this hardware
   (`brave-webgpu-wayland-nvidia` note) and must not pay for a WebGPU attempt every boot.
3. **Fog.** Reveal happens only on a live `TileOpt` change inside the retained render area (`worldmap.tsx` ~1253–1261);
   hydration writes `exploredTiles` without invalidating the fog page, so provision and army creation never clear and
   explore clears late. Fix: one fog invalidation chokepoint fed by every explored-tile write (hydration, diff, own
   action), with the reveal animation starting from the diff, not from a later frame.
4. **Explore latency.** p95 302 vs 250: the stages `submit_guard_released` and `rendered` carry the excess
   (`__clientActionLatencyMeasurements`). Fix: the submit guard releases on `pre_confirmed` from herald's overlay, not
   on the receipt; render-on-arrival for one player event applies the diff in the same frame it is received (guardrail
   3: one action, one visible step).
5. **Bootstrap.** 1.7 s to bootstrap on a quiet box with a 1.3 s herald snapshot; the snapshot is already paged and the
   client waits for all pages before rendering. Fix: render from the first page that contains the player's own
   structures and stream the rest.

Gate: on the quiet lab box, from a fresh profile: first terrain ≤ 2 s, explore p95 ≤ 250 ms across 20 explores, fog
clears in the frame after provision / army creation / explore; the harness explore bar unchanged; every number recorded
in the brief next to the old one.

## Order

Half two, classes 3 and 4 first (they are gameplay-visible and independent of the web app), then 1, 2, 5; half one when
the web app's lobby gate passes. Owner runs the human gate on the quiet box. Codex or a third agent, the owner's call on
capacity; Claude reviews.
