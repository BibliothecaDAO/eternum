# Phase 2 — One Codebase, Two Worlds: Eternum & Blitz on Self-Hosted Appchains

Status: **RATIFIED 2026-08-10** (design review with owner; scope amended same day — see §0.1). This
document is the umbrella architecture for Phase 2 and supersedes the blitz-only framing of
`appchain-single-world.md` — the A-series work continues as the *Blitz world track* inside this plan.
Motto: KISS.

## 0. Decisions ratified (owner, 2026-08-10)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Eternum tenancy | **Persistent world; each season is a `GameRegistry` row (`game_id`)** — same pattern as blitz games. No per-season deployments. |
| D2 | Mainnet assets at entry | **Operator-attested grants**: pay/lock/own on mainnet, a gateway signs a grant the appchain contracts accept (same trust shape as our VRF provider/paymaster). One primitive serves blitz entry fees AND eternum passes. |
| D3 | "Settling back to mainnet" | **Staged**: idempotent mainnet results/escrow contract + operator worker now; upgrade the verification to proven state later **via Katana's native settlement mode** (`katana init` settlement config → Herodotus Atlantic fact registry → settlement contract). Saya as a standalone orchestrator is NOT part of the plan — settlement/proving is Katana-native now. |
| D4 | Eternum feature scope | **Everything**: trade + banks/AMM, villages + village passes, quests, faith + wonders all carry into the appchain era. "If we want to play eternum on the appchain" — full parity. |

### 0.1 Scope amendments (owner, 2026-08-10, second review)

| # | Amendment | Consequence |
|---|-----------|-------------|
| S1 | **No legacy support in this client.** | The client on this branch is appchain-only. The live mainnet game keeps running on its already-deployed build until cutover; we spend zero effort keeping the legacy arm working here. Legacy code (factory reads, cartridge torii URLs, cross-world market/leaderboard reads, `wf-` tables, realtime-server summary) is *unsupported immediately* and *excised* in a post-MVP cleanup — deletion must never block MVP velocity. |
| S2 | **MVP topology = ONE katana, two worlds, two torii.** | The single-chain dual-world shape is the MVP target, not a contingency. Splitting eternum onto its own chain is a later scaling step (post-MVP W7) that changes only world-directory entries and CDK parameters. |
| S3 | **MVP = milestones W1–W5.** | W6 (gateway, entitlements, ResultsEscrow) and W7 (chain split, prod cutover, legacy excision) are post-MVP. Therefore MVP entry flows stay dev-token/free: blitz keeps the current dev-fee flow, eternum seasons settle in dev/free mode — season-pass gating arrives with the gateway. |
| S4 | **The dev katana is disposable.** | W2 remakes the chain from scratch (fresh state, namespace `s2` from genesis) instead of in-place surgery — the old `s2_blitz` world and any fork-torii remnants simply vanish. Remake again later whenever it is cheaper than migrating state. |

## 1. Why we corrected course

The single-world migration (A1) moved only the blitz-relevant systems to `game_id` keying. The eternum-mode
systems still exist in the Cairo tree but were left behind, not migrated:

- `ITradeSystems` (first param `taker_id`), `IBankSystems`/`ISwapSystems`, `IVillageSystems`,
  `IQuestSystems`, `ISeasonSystems.season_close`, `IFaithSystems` — none take `game_id`, none are in the
  25-contract `manifest_appchain.json`.
- Their models (Market, Liquidity, Trade, Quest*, VillageTroop, SeasonEnded, …) were tagged "s1-only" in
  the client instead of being carried forward.

Left unchecked, that forks the product: Blitz gets the appchain future, Eternum stays chained to the
retiring Cartridge mainnet flow. Phase 2's end state is **each game on its own appchain, settling value
back to mainnet** — so the codebase must be shaped for that now, with a hard requirement that both games
can also run on ONE appchain (two worlds, two torii) if push comes to shove.

The deep A-series machinery survives: the provider takes `{namespace, gameId}`, the SQL layer takes
`(namespace, gameId)`, RECS keys take `(gameId, …)`. The one short-sighted assumption baked on top —
*"appchain" implies the blitz world* — is what this design removes.

## 2. Design principles

1. **Mode is per-game config; the world is the unit of deployment; topology is an ops choice.**
   `blitz_mode_on` (per `game_id`, via preset) decides how a game plays. A *world* is one deployed world
   contract + its torii. Which chain hosts which world is decided by config, never by a code branch.
2. **One Cairo build → N worlds.** The full contract set deploys to both worlds; empty models are
   harmless. Two dojo profiles differing only in `[world] seed` produce two worlds from one build.
3. **One client build → N worlds** via a *world directory* — each entry is
   `(chain endpoints, world address, namespace, torii URL, manifest)`.
4. **Every per-game row keys by `game_id`** — uniform for 2-month seasons and 1-hour blitz games.
5. **Value lives on mainnet; appchains hold game state.** All crossings go through one *Gateway*
   primitive: inbound entitlement grants, outbound outcome settlement. Operator-run first, provable later.
6. **KISS infrastructure:** no factories, no forked torii, no multi-world torii. Vanilla components, one
   torii per world.

## 3. Target architecture

```
                    ┌────────────────────────  MAINNET (value)  ────────────────────────┐
                    │  $LORDS · Season/Village Passes · Realms NFTs · Collectibles · MMR │
                    │  ResultsEscrow (new, idempotent payouts)                           │
                    └───────────────▲───────────────────────────────▲───────────────────┘
                          grants    │                               │   payouts / mints
                    ┌───────────────┴───────  GATEWAY (operator service)  ──────────────┐
                    │  inbound: verify mainnet facts → sign grants                       │
                    │  outbound: watch GameRegistry Settled → execute escrow payouts     │
                    │  upgrade path: operator signatures → Katana-proven state facts     │
                    └───────▲───────────────────────────────────────▲───────────────────┘
                            │                                       │
        ┌───────────────────┴─────────┐             ┌───────────────┴─────────────┐
        │   BLITZ APPCHAIN (katana)   │             │  ETERNUM APPCHAIN (katana)  │
        │  world: s2 (blitz games)    │             │  world: s2 (seasons)        │
        │  registrar → GameRegistry   │             │  registrar → GameRegistry   │
        │  torii-blitz ─→ client      │             │  torii-eternum ─→ client    │
        └─────────────────────────────┘             └─────────────────────────────┘

        Contingency (push-comes-to-shove): ONE katana hosting BOTH worlds, each with its
        own torii. Same artifacts, same client — only the world directory entries change.
```

The launch pipeline (Lambda → `game-launch.yml` → registrar) targets a world, not a chain; environment ids
`appchain.blitz` / `appchain.eternum` already exist and map 1:1 onto world entries.

## 4. Contracts plan

### 4.1 Namespace: ONE neutral namespace, shared by both worlds

Rename `s2_blitz` → **`s2`**. Rationale: namespaces are per-world registries — two separate world
contracts never collide, and each torii indexes exactly one world into its own DB. Distinct namespaces per
world would buy only a label, at the cost of a feature-gated `DEFAULT_NS()` and two builds. A blitz-named
namespace on the eternum world's tables (`s2_blitz-Structure` holding season realms) is a permanent
landmine; `s2` is mode-neutral and version-tagged. Rename recipe = the A1 `s1_eternum→s2_blitz` recipe
(Cairo constants, profile toml `[namespace]`/`[writers]`/`lib_versions`, client `game-scope`, SQL
transform target, bindings namespace, torii service config). Do it **before** more content accumulates —
the dev world redeploys, which is acceptable pre-launch.

### 4.2 One build, two profiles

- `dojo_appchain_blitz.toml` — `[world] seed = "s2_blitz_1"` (fresh seed on the remade chain)
- `dojo_appchain_eternum.toml` — `[world] seed = "s2_eternum_1"`
- Identical `[namespace]`/`[writers]` blocks; same class hashes; `sozo migrate` per profile produces
  `manifest_appchain_blitz.json` / `manifest_appchain_eternum.json`.

Both worlds deploy the FULL contract set. Mode gating already exists at runtime (`blitz_mode_on`
asserts); the blitz world simply never registers an eternum-preset game and vice versa. Revisit per-world
contract exclusion only if torii schema bloat ever hurts.

### 4.3 Eternum system migration (the big Cairo milestone)

Apply the A1 recipe to everything left behind: `game_id` as first param on every entrypoint, `game_id`
as key[0] on every per-game model, config reads via `WorldConfigUtilImpl::get_member(world, game_id, …)`.

- Systems: trade, bank + swap (AMM), village, quest, faith (+ faith prizes), season
  (`season_close` → sets `GameRegistry.status = Ended` + winner), realm season-create, resource bridge.
- Models: exact list = the s1⊖s2 manifest diff, already cataloged in the A0 audit
  (`docs/plans/appchain-single-world-a0/`). Keep `SeasonEnded` as a `game_id`-keyed event (winner
  announcement) alongside the registry status flip.
- The registrar is already mode-agnostic: presets carry the mode; eternum presets get registered next to
  blitz presets 2/3.
- Bindings: the ONE superset `contract-components.ts` extends with the re-migrated models (models absent
  from a world simply never receive data — established P1 pattern).

### 4.4 Entitlement contract (D2)

New `entitlement_systems` per world: `consume_grant(grant, signature)` where
`grant = { chain_id, world, game_id, player, kind, ref_id, expiry, nonce }` and the gateway signer key
lives in `ChainConfig`. Entry flows (blitz settle with real fees, eternum season create / village create)
accept a grant where mainnet value is required. Replay-safe via consumed-nonce storage. Dev chains keep
the current free/dev-token flow — grants are a config, not a fork.

### 4.5 Mainnet ResultsEscrow (D3)

Small mainnet contract holding prize funds per `(world_id, game_id)`:
`payout(game_id, player, amount, rank)` — operator-gated, idempotent via a paid-map, fully evented for
audit. Storage designed so the operator-signature check can be swapped for a fact-registry check (proven
appchain state) without redesign. Collectible mints and MMR updates ride the same worker.

## 5. Client plan

### 5.1 World directory replaces "the appchain torii"

```ts
interface WorldDeployment {
  id: "blitz" | "eternum";       // world key
  chain: Chain;                   // endpoint set (rpc); both worlds share one chain in the MVP
  rpcUrl: string;
  toriiBaseUrl: string;
  namespace: "s2";
  worldAddress: string;
  manifest: Manifest;             // committed per world
}
```

Env-driven list — appchain entries only (S1: no legacy entries, ever). Dev/MVP: two entries on one
chain. The landing games list is the **union of `GameRegistry` rows across directory worlds**; every
summary row carries `(worldId, namespace, toriiBaseUrl, gameId, mode)`; entry, registration and
settlement flows target `(world, gameId)` explicitly.

### 5.2 Seam generalization (small — the seams are already parametric)

- `namespaceForChain(chain)` → `profile.namespace` from the world entry. `GameProfile` already carries
  `toriiBaseUrl`/`rpcUrl`; it gains `namespace` + `worldId`.
- `setGameScope` / `setSqlGameScope` / provider `{namespace, gameId}` / `configManager.setActiveGame` —
  signatures unchanged, callers pass profile values. **P1–P5a survive as-is.**
- Model classification (game-scoped vs chain-global) and the SQL lint derive from **each world's
  manifest** instead of the single appchain manifest.
- "s1-only" annotations become *manifest-capability* checks — eternum queries come back to life on the
  eternum world's namespace.
- Factory-v2 environments `appchain.blitz` / `appchain.eternum` map to world entries; catalog filtered
  per mode.

### 5.3 What survives from the A-series

| A-series work | Fate |
|---|---|
| P1 game profile + bindings superset | Survives; profile gains `namespace`/`worldId` |
| P2 sync boundary (stream clauses, bounded spatial) | Survives unchanged (already `(namespace, gameId)`-parametric) |
| P3 `gameEntityKey` codemod + config scoping | Survives unchanged |
| P4 SQL `{GF}` markers + lint | Survives; lint iterates per-world manifests |
| P5a provider `{namespace, gameId}` chokepoint | Survives unchanged |
| P5b/P5c (stashed WIP) | Resumes on the world-handle shape (W1) |
| A5 blitz cutover | Renamed: **Blitz world cutover** (W7a), criteria unchanged |

## 6. Torii & infra plan

- **One vanilla torii per world** (`torii-blitz`, `torii-eternum`), separate DBs. CDK gains a
  `WorldService` construct (torii service + target group + DNS); a `ChainStack` (katana) hosts N
  `WorldService`s. MVP: 1 chain × 2 worlds — dev and first prod shape alike. Post-MVP: split to
  2 chains × 1 world when scale calls for it.
- DNS: `blitz-torii.jcndata.com` / `eternum-torii.jcndata.com`; per-chain RPC endpoints
  (`blitz-katana.` / `eternum-katana.`) once chains split. Current `torii.jcndata.com`/`katana.` stay
  through the transition.
- Per-chain tuning once split: fast blocks for blitz, relaxed cadence + cheaper instance for eternum;
  independent upgrade windows (eternum freezes mid-season, blitz iterates).
- **Chain settlement (D3 later stage):** prod chains initialized with `katana init` settlement
  configuration (settlement account, Atlantic fact registry, settlement contract on Starknet). Dev stays
  sovereign. No standalone Saya anywhere in the plan.

## 7. Gateway & settlement worker (off-chain, one service)

- **Inbound:** verify mainnet facts (pass ownership, $LORDS payment into escrow) → sign entitlement
  grants (D2).
- **Outbound:** watch each world's `GameRegistry` for `Settled` → compute payouts from
  `RankPrize`/points → execute `ResultsEscrow` payouts, collectible mints, MMR updates on mainnet.
  Idempotent and audit-logged.
- Runs beside the launch Lambda (same account/infra). Keys: gateway signer + escrow operator —
  **never the paymaster account** (`0x127f…cfcec`).
- Upgrade path: swap operator signatures for Katana-proven state facts; Katana L2↔L3 messaging is an
  alternative transport if/when it fits.

## 8. Topologies (same artifacts everywhere)

| Topology | Chains | Worlds | Torii | When |
|---|---|---|---|---|
| Dev today | 1 (`WP_REALMS_DEV`) | 1 (blitz, `s2_blitz`) | torii-s2 | now — retired by the W2 chain remake |
| **MVP (W4+)** | 1 (fresh chain) | 2 (blitz + eternum, `s2`) | 2 | **the target** — dev and first prod shape |
| Split (post-MVP) | 2 | 1 each | 1 each | later scaling step |

Moving between topologies changes world-directory entries and CDK parameters only.

## 9. Milestones

Owners per the standing role split: **Codex** executes contracts + pipeline from briefs; **Claude** owns
client, infra, deploys, reviews. **MVP = W1–W5** (S3).

### MVP

- **W1 (client, Claude — immediate):** world-handle generalization (§5.1–5.2), appchain-only per S1
  (landing/entry surfaces list directory worlds exclusively; no legacy entries); resume the stashed
  P5b/P5c on that shape; two-tab blitz isolation acceptance (old P6).
- **W2 (contracts Codex brief + infra Claude):** namespace rename `s2_blitz` → `s2`; two-profile build
  (`appchain_blitz` / `appchain_eternum`); **remake the dev katana from scratch** (S4) and redeploy the
  blitz world + torii on the fresh chain; bindings + client scope constant update; pipeline env update.
- **W3 (contracts, Codex brief):** eternum system + model `game_id` migration (§4.3); full-set manifest;
  eternum presets registered.
- **W4 (infra, Claude):** `WorldService` CDK construct; deploy the eternum world + `torii-eternum` on the
  same chain — the MVP topology is live.
- **W5 (client, Claude):** eternum world entry in the directory; eternum flows re-enabled (queries, entry
  modal season path, villages); dev/free eternum settling (S3 — no pass gating yet). **MVP exit:** a
  blitz game and an eternum season running concurrently on one chain, isolated, both playable end-to-end.

### Post-MVP

- **W6 (gateway, Codex brief + Claude deploy):** entitlement contract, ResultsEscrow, gateway worker;
  first real-value flows (season passes, $LORDS fees, payouts).
- **W7 (ops, Claude):** split eternum onto its own chain when scale calls for it; blitz mainnet cutover
  (old A5: Lambda `DEFAULT_WORKFLOW_REF` flip, retire fork torii + s1 worlds); **legacy excision** — the
  dedicated sweep deleting factory reads, cartridge URLs, cross-world legacy features from the client.

Sequencing: W1 ‖ W2 in parallel (W1 touches the namespace constant's plumbing, not its value). W3 needs
W2. W4 needs W3's manifest. W5 needs W4. W6/W7 whenever after MVP.

## 9.1 W1/W2 execution notes (2026-08-10)

- **W1 shipped** (`481d103f97` + reconciliation `50a4e937b8`): world directory, GameRegistry landing
  union, game-targeted entry flows, factory-v2 catalog on registrar presets, 2-step run plan,
  `artifacts.gameId`. Client tsc + 80 test files green on namespace `s2`.
- **W2 contracts shipped by Codex** (`89c06b471d`), reviewed clean. Note: Scarb rejects underscores
  in profile ids — `sozo migrate --profile appchain-blitz` writes `manifest_appchain-blitz.json`,
  rename to the underscore name after migrating.
- **W2 infra executed — the chain was remade** (S4): katana data dir bumped to `katana-db-v2`;
  `userDataCausesReplacement: true` added after discovering user-data edits are silent stop/starts
  that never re-run (`f43d391be6`); the vCPU quota fits exactly one instance, so remakes must
  terminate the old instance before deploying. **sozo/katana pairing:** the deployed katana
  (1.8.0-rc.9 image) serves RPC 0.10.0 — migrate with sozo **1.8.7** (`ASDF_SOZO_VERSION=1.8.7`);
  sozo 1.8.0 refuses.
- **Fresh-chain state:** blitz world at the committed manifest address
  (`0x78ff85ac450bb559c97966b64666fd5292f4a98756a607349d9f93f4563bdd2`), ChainConfig bootstrapped
  (free-entry dev flow, zeros for entry token/loot chest), presets 2 (Regular Fast) + 3 (Duel)
  registered, torii-s2 reindexed under `s2`. Two dev games launched via
  `launch-step.ts --step create-world` / `wait-for-factory-index` (needs `TORII_URL`,
  `GITHUB_SHA`, `--dev-mode-on true`): `mvptab1` = game 1, `mvptab2` = game 2, both Live.
- **Acceptance:** the client landing (real app run) listed both games from the GameRegistry union
  with independent clocks/status/counts — the W1 data path proven end to end. The in-game 3D
  two-tab session could not run under headless chromium (hard renderer crashes, environmental);
  it hands to a real-browser playtest.

## 10. Open questions (not blocking W1–W3)

1. Eternum entry UX under grants: season pass **burn** vs **lock** on mainnet.
2. Prize funding: escrow pre-funded per game at launch vs post-funded before settlement.
3. Blitz prod at cutover: real $LORDS entry fees via grants from day one, or free entry initially
   (gateway ships in W6 either way)?
4. Final DNS naming for per-world endpoints.
5. MMR token placement — assumed mainnet, gateway-updated; confirm.

## 11. Risks

- **W3 is the largest Cairo change since A1** (every eternum system). Mitigation: the A1 recipe +
  manifest-pinned tests + A0 inventory make it mechanical; Codex executes from a precise brief.
- **Namespace rename invalidates the current dev world** — scheduled first (W2) so nothing accumulates.
- **Operator trust concentration** in the gateway — mitigated by idempotent evented escrow, key
  separation, and the D3 proof upgrade path.
- **Two toriis on one host is now the MVP shape** — RAM/DB sizing on the ECS instance; watch before W4
  and size the instance up if needed (it is one dial).
- **Dead legacy code lingers until the W7 excision** (S1 makes it unsupported, not absent). Contained by
  the rule that nothing new may call into it; the directory abstraction is the only supported entry
  surface.
