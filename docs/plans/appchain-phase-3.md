# Phase 3 — Eternum appchain (decision record + topology)

**Status: decided 2026-08-08, execution deferred until the Blitz single-world migration
([appchain-single-world.md](./appchain-single-world.md)) has shipped.**

## Decisions

1. **Eternum runs on its own appchain.** Two chains total: the existing chain becomes the dedicated **Blitz chain**;
   Eternum gets a fresh-genesis chain of its own. Same stack, two instances.
2. **Eternum adopts the same single-world schema pattern** as Blitz: one persistent world, `season_id` (the Eternum
   analogue of `game_id`) as a first-class model key, seasons created by a registrar system — no world-per-season
   deploys, vanilla single-world torii.

## Why two chains (not one)

- **Lifecycle mismatch is decisive.** A Blitz chain is a rolling arena: state is disposable, resets/compaction between
  Blitz seasons are cheap and safe. An Eternum season is a months-long stateful commitment where a reset is catastrophic
  and even a katana restart is an event. Those retention/uptime philosophies do not belong on one sequencer.
- **Blast radius.** Blitz is the experimentation-heavy workload (config churn, load spikes, katana tuning, chaos
  drills). None of that should be able to touch a live Eternum season. The 2026-08-08 paymaster-nonce incident is the
  miniature of this lesson: shared substrate, unrelated workloads, one takes the other down.
- **Independent tuning + sizing.** Block cadence, execution limits, and hardware follow the workload: Blitz wants snappy
  blocks and burst headroom; Eternum runs steady and modest. Scale Blitz on game day without touching Eternum.
- **Weak coupling.** No shared on-chain economics in Phases 1–2. Long-term shared value (LORDS, prizes, bridging)
  settles through Starknet mainnet as the hub — both appchains connect _there_, not to each other.
- **The stack is already bilingual.** `appchain.blitz` / `appchain.eternum` exist as distinct environment ids through
  the client catalog, deployer environments, GitHub environments, and the launch service allow-list. Pointing
  `appchain.eternum` at different endpoints is configuration, not refactoring.

Accepted cost: roughly double chain-layer ops (2× katana + paymaster/VRF sidecars, 2× torii, 2× alarms) — ~$50–100/mo
extra on AWS dev, a second box under Phase-2 hardware. Option A makes each chain a single world + vanilla torii, which
is what keeps ×2 affordable.

## Topology

| Layer     | Blitz chain (existing)                     | Eternum chain (new)                      | Shared                                                              |
| --------- | ------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------- |
| Sequencer | katana + paymaster + VRF (burst-sized)     | katana + paymaster + VRF (steady-sized)  | image lineage, CDK constructs                                       |
| Chain id  | rename to `WP_BLITZ` at Phase-2 cutover    | `WP_ETERNUM` at genesis                  | — (Controller sessions scope per chain id; name once, never rename) |
| World     | `s2_blitz`, `game_id`-keyed                | `s2_eternum`, `season_id`-keyed          | schema pattern, registrar design                                    |
| Indexer   | vanilla torii, one world                   | vanilla torii, one world                 | image, dashboards                                                   |
| Serving   | rpc/torii under jcndata.com hosts          | own hosts (e.g. `*.eternum.jcndata.com`) | ALB, Cloudflare zone, WAF                                           |
| Launch    | launch service → `game-launch.yml`         | same service, `appchain.eternum` env     | Lambda, factory-runs store, GH environments                         |
| Accounts  | paymaster / deployer / registrar separated | same separation from day one             | policy: no account shared across chains                             |

## Sequencing

1. Ship Blitz single-world (Phase 1, in progress) — proves the schema pattern and the collapsed launch pipeline.
2. Port the pattern to Eternum (`s2_eternum`, `season_id`): model audit is bigger (long-lived state, villages, seasons
   economy) but follows the A0–A5 template.
3. Stand up the Eternum chain: fresh genesis, hardened operator keys from day one (no dev-seed reuse), own GH
   environment + launch-service env, own torii.
4. Phase-2 hardware: prefer **two smaller boxes** over one metal host — one box hosting both katanas would quietly
   reintroduce the shared-substrate risk this split pays to remove.

## Open questions (to resolve at execution time)

- Season lifecycle on a permanent chain: archive/prune policy for finished seasons vs full history retention.
- Whether Eternum needs the settlement/prize layer (Phase 2 work) live at launch or can start sovereign like Blitz.
- Upstream alignment: is `season_id`-keyed Eternum a candidate for mainnet too (kills per-season torii provisioning), or
  do we carry it as an appchain divergence?
- Client packaging: one client build with two appchain environments vs per-mode deployments (today: per-mode env files
  already exist).
