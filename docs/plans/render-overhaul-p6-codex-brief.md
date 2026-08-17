# P6 — army visuals on honest semantics, missing tiles, entry freezes, P5 deletions — Codex brief

Motto: **KISS, always. Systemic fixes over point patches. Success is deletion. Evidence before optimization.**

Context. The P5 measurement gate landed (`a619528b26`) and its capture ruled on every open P5 question — verdicts folded
in below as P6D. But live play on the branch tip surfaced a P0 regression and two standing rendering defects, and the
operator ratified a semantics change that simplifies the army pipeline instead of patching it again. Work lands in
slices, in order. Validation claims come from running the actual commands.

---

## P6A — army movement renders on honest signals (P0)

**Evidence (operator-reported, Aug 17 evening):**

- On the branch tip (`a619528b26`): explore executes on-chain (the destination tile reveals) but **the army model never
  leaves the source hex — always, persists all session**. Selection panel and coords are right; only the model is dead.
- On the deployed client (`8535a502ed`, includes the input-unlock change): movement renders fine. The regression window
  is therefore exactly one commit — the P5 gate — but **verify this bisect first** (checkout `8535a502ed`, move an army,
  then `a619528b26`); the operator's attribution ("the last army change") and their own deployed observation disagree,
  so convict, don't assume. Note the P5 commit contains both DEV-only paths (frame-owner attribution wrappers in the
  ingest scheduler and chunk-work queue) and unconditional changes (prewarm-off, worldmap trigger threading) — localhost
  runs DEV, deployed runs PROD, so a DEV-gated defect matches the observed split.
- Separately, on the deployed build: **explore into an occupied tile rewinds on-chain but the model does not move back**
  — it needs a manual re-sync.

**Ratified semantics (operator decision — this is the fix, not a workaround):**

- **Explore: pre-show intent, move on reveal.** On click, show the existing intent FX (path/ghost/pending indicator).
  The army model and the destination tile update **together when the revealed tile arrives from the authoritative
  stream**. No optimistic model movement onto unrevealed tiles — the destination isn't renderable before the reveal
  anyway, so the optimistic hop was always showing a fiction.
- **Explore chaining gates on the reveal**, naturally: the next explore starts from the newly revealed tile, so input
  for that army re-enables when the reveal lands. This is a data gate, not a timer — the class of "unlock on a
  downstream signal" timers stays dead.
- **The occupied-tile rewind bug disappears by design**: if the reveal shows an occupied tile (or the move rewound), the
  model simply never left the source. Delete whatever rewind-the-model machinery this obsoletes.
- **Travel (already-revealed tiles): unchanged** — optimistic model movement worked there and stays, with the
  hash-unlock input semantics that already landed. If implementation shows travel shares the broken machinery, align
  travel to move-on-authoritative-update too and say so in the PR — do not silently fork the pipeline into two designs.

**Success is deletion.** Implementing move-on-reveal should delete the explore-side provisional coord movement, its
visual handoff, and the rewind handling — not add a new state machine beside them. The stamina overlay, the intent
handle (input lock + reconciliation + tripwire), and the explore freshness guard all stay. The operator's framing to
honor: "we changed the sync and the three.js but haven't looked at the client layer" — treat this slice as the KISS pass
over selection → action paths → submission → visual lifecycle, and list what it deletes.

**Gate:** on the fixed tip — every explore shows intent FX at click, then the model and tile appear together on reveal;
chained explores work reveal-to-reveal without dead clicks; explore-into-occupied leaves the model at the source with no
re-sync needed; travel still animates immediately; the bisected regression cause is named in the PR.

## P6B — live tile writes must reach built terrain pages (P1)

**Evidence:** screenshot + operator answers — tiles around newly created hyperstructures (own **and other players'**)
are in RECS (the biome panel names the biome for a visually empty hex) but do not render; **panning or zooming makes
them appear**. So the data pipeline is fine and the visual terrain window is stale: live tile writes landing inside an
already-built visual page do not invalidate or patch that page; a forced rebuild (pan/zoom) picks them up.

**Work:** one invalidation path — when an authoritative tile write lands on a hex inside a currently-built visual page,
that page patches or rebuilds through the existing page pipeline. No special-casing hyperstructures; they are just the
loudest producer of live tile bursts (foundation reveals a ring at once). Check the existing
`terrain_shell_stale_dropped` / live-append guard paths first — this may be a dropped-update bug in machinery that
already exists rather than missing machinery.

**Gate:** create or witness a hyperstructure mid-session → its surrounding tiles render without any camera movement;
explore reveals keep working; no per-frame cost added to the ambient path (attribute with the owner instrumentation).

## P6C — first max-zoom-in and first world→local swap freeze (P1)

**Evidence:** operator reports both freezes on **both** localhost (prewarm off) and deployed (prewarm on, hexception
background prewarm active), similar duration. Two conclusions: the freeze predates and survives prewarm, further
evidence for P6D's deletion; and nothing currently names the stall.

**Work:** instrument first — the frame-owner attribution now exists, so extend markers over the hexception scene setup
and the zoom-band asset path, capture one freeze of each kind, and convict the owner. Fix only what the capture names.
No assumptions: plausible candidates (first-use model loads, LOD/zoom asset decode, scene-switch synchronous setup) are
hypotheses, not findings.

**Gate:** a capture names the freeze owner; after the fix, first max-zoom and first scene swap stay under ~500ms of
blocked frames on the reference machine, measured with the same instrumentation.

## P6D — execute the P5 capture verdicts (deletions)

The Aug 17 prewarm-off capture ruled:

- **Prewarm: delete.** ~130 pipelines compiled on demand for ~20ms total backend time, spread invisibly across normal
  frames. Delete the timebox runtime, warmup view/camera, model-load barrier, background scene prewarms, per-object
  prewarm path, and the `PIPELINE_PREWARM_DISABLED_FOR_P5_MEASUREMENT` flag. Net-negative LOC.
- **Eager cosmetics preload: delete.** The 5.6s window before `Preloaded 28 cosmetic assets` is seven-plus 1024×1024
  texture uploads at ~8–10ms each, and it starved catch-up transition=3 (`direct:default`, 5618ms sliced). Load only
  equipped/needed cosmetics on demand.
- **Terrain: closed.** `cpuBuild=5ms commit=3ms modelWait=1245ms queueAndYield=399ms` — 8ms of real main-thread work. No
  optimization; keep the phase log.
- **Catch-up: re-measure after the cosmetics deletion** before touching its logic, and thread a real trigger reason
  through the call path that currently falls back to `direct:default`.
- **Watch item (not this slice):** a single `updateTexture` of 1218ms (`decedious_texture-opacity`, 768×768) stalled the
  backend during model loads — on the record, driver-side, revisit if it recurs in captures.

**Gate:** prewarm and eager-preload machinery gone; cold entry re-captured with the same instrumentation and compared
line-for-line against the Aug 17 capture in the PR; catch-up `direct:default` no longer appears.

---

## Order and rules

P6A first — it is the P0 and the operator is waiting on it; do not start P6D's deletions in the same change as P6A so
the bisect stays clean. Then P6B, P6C, P6D in separate slices. The deployed client stays on `8535a502ed` until P6A lands
(operator declined a rollback); nothing deploys from the tip while the army regression is on it.

## Validation

- Every slice: focused tests, typecheck, format, knip, run from the actual commands — claims that don't come from a
  command run are not claims. Full client suite before any deploy-bound consolidation; known load-timeout flakes
  (`instanced-model.material-semantics`, `game-entry-preload`, `play-asset-manifest`, and the three newer timeouts from
  the P5 run) must be green in isolation.
- P6A and P6B additionally require the live gates above, verified in a real session, with the console lines or a capture
  cited in the PR.
