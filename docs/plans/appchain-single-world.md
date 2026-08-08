# Single-World Blitz — Option A migration (Phase 1 scope)

**Decision (2026-08-08):** stop deploying one Dojo world per Blitz game. Run **one persistent Blitz world** whose models
carry `game_id` as their first key; the factory becomes a game **registrar** inside that world. One chain, one world,
one vanilla single-world torii. Approved after the 2026-08-08 playtest incidents; Eternum follows the same pattern on
its **own appchain** in Phase 3 (see [appchain-phase-3.md](./appchain-phase-3.md)).

## Why

In Dojo the _world_ is the isolation boundary, but every serving layer above the chain treats "which world" as ambient
context: torii's model tables, the JS SDK's query language (1.7 cannot world-scope queries or subscriptions), and the
client's entity store all assume one world. Running N games as N worlds behind one shared torii made every implicit
assumption a bug. All observed 2026-08-08 incidents were this one defect wearing different clothes:

- Ghost settlements: entity sync pulls all worlds; structures from ended games rendered inside live ones.
- Wrong game clock: `WorldConfig` is singleton-keyed, so a second live game's config **overwrote** the first's in the
  client entity store (`blitzlive1` displayed `blitzlive2`'s schedule).
- Unscoped SQL whack-a-mole: six hand-scoped query sites fixed in one day; every future query is a fresh leak.
- Heavy game creation: per-game world deploys (15 × `create_game` batches under katana's measured `max_actions = 20`
  ceiling, ~10 minutes, dozens of nonces burned — which also desynced the shared paymaster account).
- A growing torii fork (multi-world GraphQL/JOIN patches, registry auto-discovery, exclusion lists) that exists only to
  serve the world-per-game model.

Schema-level multi-tenancy removes the entire class **by construction**: `game_id` inside every key means two games can
never share an entity id, every torii table gets a real `game_id` column, key-prefix subscriptions (native in SDK 1.7 —
no upgrade needed) sync exactly one game, and the world's systems are deployed once — so Controller sessions are
approved **once, ever**, instead of once per game.

## Target architecture

- **One world** (fresh namespace, working name `s2_blitz`) on the existing appchain, which becomes the dedicated **Blitz
  chain**.
- **Models:** every per-game model gains `#[key] game_id` as its first key (structures, tiles/occupancy, armies,
  resources, banks, hyperstructures, events). Config singletons become per-game rows (`GameConfig`, tick config,
  registration config). A `GameRegistry` model (game_id, name, preset, phase timestamps, creator, status) replaces
  `wf-WorldDeployed` as the games list.
- **Cross-game state stays global on purpose:** player MMR, trophies/achievements, cosmetics loadouts — keyed by player,
  not game.
- **Registrar instead of factory:** `create_game` assigns a game_id, writes the config rows from a preset (+ calldata
  overrides for start time, duration, dev mode, map/biome seeds), and initializes per-game map/banks state. Target: a
  game exists in **1–2 transactions, < 30 seconds** end to end. The `wf` factory world retires.
- **Torii:** vanilla upstream, single world. The multi-world fork patches, world-registry auto-discovery, exclusion
  lists, and admin hot-add all become unnecessary. Ended games are pruned with a keyed delete after a retention window;
  `GameRegistry` rows plus a summary snapshot keep the "PLAYED" history.
- **Client:** one constant world address and torii URL; `/play/appchain/<game>` resolves game_id via `GameRegistry`;
  sync uses game_id key-prefix subscriptions; every SQL predicate is `game_id = ?` (greppable and testable, unlike
  `internal_id LIKE` scoping). The `withWorldScope`/shared-torii machinery is deleted.

## Milestones

### A0 — Design + audit (1–2 days)

Model-by-model inventory (per-game key vs global vs config-row), system-by-system entrypoint audit (game_id threading;
flag any "iterate all entities" logic), id strategy (global `uuid()` is fine — only _keyed_ lookups need game_id),
decide preset representation (on-chain preset rows written from the existing TS config builders). Deliverable: schema
delta + checklist doc reviewed before any Cairo lands.

Exit: signed-off schema; no unclassified model.

### A1 — Cairo migration (~1–1.5 weeks)

`game_id` keys threaded through models and systems; `GameRegistry` + lifecycle systems (create/start/end); per-game
map/bank/hyperstructure initialization replacing the factory's replayed config batches; guard-rail asserts that a
system's subject entities belong to the caller's game. snforge suite whose core scenario is **two concurrent games with
adversarial cross-game actions** — the exact failure that motivated this plan becomes the acceptance test.

Exit: two games run concurrently in tests with zero cross-reads/writes.

### A2 — Launch pipeline collapse (2–3 days)

`game-launch.yml` steps shrink: create-world → one registrar call; wait-for-factory-index → wait for the `GameRegistry`
row; configure-world → disappears into presets; create-indexer → trivial (world is always indexed). The launch service
and factory-v2 UI keep their contract — only the underlying steps get faster. Config versions become preset data.

Exit: UI-button launch to joinable game in < 30 s; run record still tracks each (now much shorter) step.

### A3 — Torii simplification (1–2 days)

Back to upstream torii (goal: zero fork patches; keep the fork only if something upstream still panics). Single-world
config; pruning job for ended games; `/sql` scoping rule: every `s2_blitz` table query must carry `game_id` — enforced
by a client-side lint/test, no longer by convention.

Exit: stock torii image serving the world; DB size flat across a create/end/prune cycle.

### A4 — Client migration (~1 week, overlaps A1 after schema freeze)

Runtime world profile → game profile (constant endpoints + game_id); sync via key-prefix subscription; dashboard games
list from `GameRegistry`; availability/registration/settlement hooks re-pointed to game_id predicates; delete the
shared-torii scoping helpers; verify one-time session approval flow.

Exit: two concurrent games open in two tabs, fully isolated — clocks, maps, settlements, leaderboards.

### A5 — Cutover + validation (2–3 days)

Deploy the `s2_blitz` world alongside the legacy worlds on the current chain; one full test game; flip the client
default; exclude legacy worlds; plan a clean-genesis chain reset at the Phase-2 hardware cutover. Playtest with two
concurrent games and capture the deferred game-hour metrics (katana CPU/mem, torii p95) for Phase-2 sizing. Update CI
(registrar tests replace factory tests).

Exit: concurrent public games on play.jcndata.com with no isolation defects; metrics baseline captured.

## Interim policy (until A5)

**One live game per torii**, enforced by the torii `world_registry_exclusions` list. Launching a new game while one is
live requires excluding one of them. This is a product cap, not a bug — it is the reason this plan exists.

## Risks

| Risk                                       | Mitigation                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Missed `game_id` guard in a system         | Keys make accidental cross-reads structurally hard; adversarial two-game snforge suite; review checklist from A0 |
| Schema diverges from upstream `s1_eternum` | Isolated `s2_blitz` namespace; mainnet path untouched; pitch upstream with the per-game-torii cost argument      |
| Engine/client single-game assumptions      | A0 audit includes `packages/core` (tick manager, config manager read one config — plumb per-active-game)         |
| Torii table growth over months             | A3 keyed pruning; games are ephemeral by design                                                                  |
| Legacy worlds during transition            | Exclusion list keeps them out of serving; clean-genesis reset scheduled with Phase-2 hardware cutover            |
| Timeline pressure vs live playtests        | Interim one-live-game policy keeps the current setup usable throughout; no migration deadline coupling           |

## Non-goals

Eternum (Phase 3, own chain — see [appchain-phase-3.md](./appchain-phase-3.md)); SDK 1.8 upgrade (obsoleted for Blitz by
this design); settlement/prizes (Phase 2); multi-world torii hardening (retired by this design).
