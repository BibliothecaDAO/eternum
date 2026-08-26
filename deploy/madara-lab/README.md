# Madara lab

The Realms game world running on a pinned, self-run [Madara](https://github.com/madara-alliance/madara) sequencer on
one machine. It measures execution, block production, receipt latency, indexer behaviour, and the 96-player Blitz
target against the current Dojo world, including the phase-one registration-cap changes.

Branch: `feat/madara-lab`. Brief: `docs/plans/realms-phase-1-brief.md`. Direction:
`docs/reports/eternum-game-stack-direction-2026-08-21.html`.

## Prerequisites

- Docker with Compose v2 (`docker compose`), ~2 GB free for images and the chain volume.
- `sozo 1.8.7` through asdf (`ASDF_SOZO_VERSION=1.8.7`; the repo's `.tool-versions` pins 1.8.0, which does not
  speak this chain's RPC), `scarb 2.13.1`, `jq`, `bun`, `mkcert`.
- The lab hosts in `/etc/hosts` (once, with sudo):
  `127.0.0.1 realms.test play.realms.test rpc.realms.test torii.realms.test identity-rpc.realms.test`.
- Nothing from Cartridge: no Slot, no Controller, no paymaster, no hosted VRF.

## Bring the chain up

```bash
cd deploy/madara-lab
scripts/issue-certs.sh                      # once: wildcard *.realms.test certificate into .lab/certs/
docker compose up -d --wait                 # madara + caddy
curl -s -X POST -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' https://rpc.realms.test
# {"result":"0x57505f5245414c4d535f4d41444152415f4c4142"}  == WP_REALMS_MADARA_LAB
```

Endpoints (all bound to localhost only):

| Port | What                                                                                   |
| ---- | -------------------------------------------------------------------------------------- |
| 443  | Caddy: TLS for every browser-facing `*.realms.test` host (see below)                    |
| 5060 | Starknet JSON-RPC. `/` is v0.10.2; `/rpc/v0_9_0`, `/rpc/v0_8_1`, `/rpc/v0_10_0` are pinned routes |
| 5061 | Madara admin RPC (`madara_*`). Never expose.                                            |
| 5062 | Feeder gateway + gateway                                                               |
| 8090 | Torii canary (profile `torii`, see below)                                              |
| 5432 | Postgres for `apps/web` (profile `web`, see below)                                     |

### HTTPS: Caddy in front of everything a browser touches

Browsers are the only TLS clients. `sozo`, the deployer, the harness and the probe stay on plain HTTP to
`127.0.0.1:5060` / `:8090`. Caddy (`Caddyfile`) terminates TLS on `127.0.0.1:443` with one wildcard certificate:

| Host                        | Upstream                                                           |
| --------------------------- | ------------------------------------------------------------------ |
| `realms.test`               | `apps/web` dev server on the host, `http://localhost:3000`         |
| `play.realms.test`          | `apps/game` dev server on the host, `https://localhost:5173`       |
| `rpc.realms.test`           | `madara:9944` (paths pass through: `/rpc/v0_9_0` works)            |
| `torii.realms.test`         | `torii:8080` over h2c, so native gRPC and gRPC-web both pass       |
| `identity-rpc.realms.test`  | `IDENTITY_RPC_UPSTREAM` (default `https://rpc.starknet.lava.build`, a public Starknet mainnet node) |

The certificate is issued by `scripts/issue-certs.sh` from the mkcert root the game's Vite plugin keeps in
`~/.vite-plugin-mkcert`, so the lab has one CA. That root is trusted by the system store and, through Fedora's
p11-kit NSS bridge, by Brave/Chrome; if a browser still warns, run `CAROOT=~/.vite-plugin-mkcert mkcert -install`
once. Certificates live in `.lab/certs/` (gitignored) and are valid for 27 months.

Because the dev servers sit behind the proxy, each Vite config needs `server.allowedHosts` with its `*.realms.test`
name and `server.hmr.clientPort: 443` — otherwise Vite refuses the Host header and its HMR socket dials the raw port.

Server-side code (the SIWS verifier in `apps/web`) must call the public mainnet node directly, not
`https://identity-rpc.realms.test`: Bun ships its own root store and would not trust the lab certificate. The Caddy
host exists for the browser.

Genesis is deterministic: the devnet predeploys 10 funded OpenZeppelin accounts and the Universal Deployer at the
standard address. Account #1 — used by `dojo_madara.toml` — is
`0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d` (key
`0x077e56c6dc32d40a67f6f7e6625c8dc5e570abe49c0a24e9202e4ae906abcc07`). `docker logs madara-lab | grep -A20 PREDEPLOYED`
prints all ten. These keys are public devnet material; they exist only on this chain.

State lives in the `madara-data` volume. `docker compose down -v` wipes the chain; `down` without `-v` keeps it, and
Madara reopens the same database on the next `up` (migrations are automatic and checkpointed).

## Deploy the game world

From the repository root, the full idempotent path is:

```bash
pnpm contract:start:madara
```

It starts Madara and Caddy first, deploys the world, then starts Torii after its generated config exists and bootstraps
the gameplay contracts and preset. The equivalent individual commands are below.

```bash
deploy/madara-lab/scripts/deploy-world.sh              # sozo build (~40 s) + migrate (measured 22 m 40 s)
deploy/madara-lab/scripts/deploy-world.sh --migrate-only
cat deploy/madara-lab/.lab/world-address

# Declare RealmsPlayerAccount, deploy PlayerRegistry, bootstrap ChainConfig,
# and register the fee-free 96-player preset.
deploy/madara-lab/scripts/bootstrap-game.sh

# The second run must report that ChainConfig and preset 1 already exist.
deploy/madara-lab/scripts/bootstrap-game.sh
```

The world script writes `contracts/game/manifest_madara.json` (gitignored, like the spike manifest), records the world
address under `.lab/`, and renders `.lab/torii.toml` for the canary. The bootstrap script writes the gameplay contract
class hashes and registry address to `.lab/gameplay-contracts.json`.

Create a game after Torii is running:

```bash
RPC_URL=http://127.0.0.1:5060/rpc/v0_9_0 \
TORII_SQL_URL=http://127.0.0.1:8090/sql \
DOJO_ACCOUNT_ADDRESS=0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d \
DOJO_PRIVATE_KEY=0x077e56c6dc32d40a67f6f7e6625c8dc5e570abe49c0a24e9202e4ae906abcc07 \
bun config/deployer/clean/cli/launch-step.ts \
  --launch-kind game --step create-world --environment madara.blitz \
  --game madara-phase1-96 --start-time 2026-08-25T19:00:00Z
```

### Why these flags

Two things make Madara different from Katana for `sozo`, and both are encoded in the script and in
`contracts/game/dojo_madara.toml`:

1. **`--use-blake2s-casm-class-hash` is mandatory.** The chain runs Starknet protocol 0.14.2, which hashes compiled
   (CASM) classes with blake2s. `sozo 1.8.7` only turns blake2s on by itself when the RPC URL contains `sepolia` or
   `testnet`; everywhere else it uses poseidon and the world declare fails with `CompiledClassHashMismatch`. Verified
   both ways on 2026-08-24: three migrations without the flag failed identically (default route, `/rpc/v0_9_0`, and a
   chain rebuilt at protocol 0.14.0); the first run with the flag deployed the world.
2. **Use the `/rpc/v0_9_0` route.** `sozo 1.8.7` is built against RPC 0.9.0 and prints a "version mismatch, continuing
   anyway" warning against the default 0.10.2 route. The versioned route removes the warning so a real failure is not
   hidden behind an expected one.

Migration is slow by construction, not by Madara: sozo declares 160 classes sequentially and waits for each receipt.
Measured on 2026-08-24 (VM execution, this laptop): **22 m 40 s** for 161 declares + 156 deploys + 43 permission
syncs + 43 initializations, 189 transactions, 0 reverts. Madara's side of that is small — block close p50 2.2 ms — and
the 1.7–2.0 s `block_production` spikes are the node compiling each declared Sierra class to CASM. Everything else is
sozo's declare → wait-for-receipt → next-class cycle (~8 s per class). The lab config closes a block every 2 s and updates
the pre-confirmed block every 250 ms so that wait is as short as it can be; on the upstream devnet preset (20–30 s
blocks) the same migration takes over an hour.

## Gameplay accounts

Fees are off (`--no-charge-fee`), so a player's browser key deploys its own `deploy_account` transaction without
any funding step — no faucet, no master account. `scripts/probe-deploy-account.ts` proves it and times it:

```bash
pnpm lab:probe-account      # OpenZeppelin devnet account class, one JSON line
```

Measured 2026-08-25 on this laptop, fresh random key, zero balance, default fee estimate, `tip: 0`: submit 22 ms,
pre-confirmed 74 ms, accepted on L2 0.8–1.9 s (the next 2 s block).

The binding authority (the key that rotates gameplay-account keys and writes the `PlayerRegistry`) is devnet
account #2, public devnet material that exists only on this chain — put it in `apps/web/.env`:

```
BINDING_AUTHORITY_ADDRESS=0x008a1719e7ca19f3d91e8ef50a48fc456575f645497a1d55f30e3781f786afe4
BINDING_AUTHORITY_PRIVATE_KEY=0x0514977443078cf1e0c36bc88b89ada9a46061a5cf728f40274caea21d76f174
```

The bootstrap writes these values to `.lab/gameplay-contracts.json`:

```
GAMEPLAY_ACCOUNT_CLASS_HASH=0x04bb0716b7161e8a439dcc39864a40cc243a29908bb8b2d9b361a4b4fa0f72c4
PLAYER_REGISTRY_ADDRESS=0x00c06bcc011cc146b724f6237d62ab88a35ca94e0bce682cb9ab795aaaa22abb
```

The values are deterministic for the current source and binding authority. Re-run the bootstrap after changing either
contract. It rejects a registry address that contains a different class.

## Session store for `apps/web`

```bash
docker compose --profile web up -d --wait postgres
# apps/web/.env
DATABASE_URL=postgres://realms:realms@127.0.0.1:5432/realms
```

State lives in the `postgres-data` volume; `down -v` wipes sessions along with the chain.

## Torii compatibility canary

Torii is end-of-life and not a destination dependency. It runs here only so the current client stays playable on the
lab chain while the owned data plane is built. Stock `ghcr.io/dojoengine/torii:v1.8.16`, single world, no patches.

```bash
docker compose --profile torii up -d          # after deploy-world.sh; reads .lab/torii.toml
curl -s 'https://torii.realms.test/sql?query=SELECT%20count(*)%20FROM%20entities'
```

Findings so far (2026-08-24, torii v1.8.16 against alpha.9):

- Madara rejects `starknet_getEvents` pages of 1024 with `PageSizeTooBig`, and Torii does not shrink its page on that
  error — it retries five times and the engine stops. `torii.toml.template` sets `events_chunk_size = 100`, which
  Madara accepts. Torii then indexes the world from genesis and follows the tip (`head` in `contracts` == the chain's
  block number).
- Torii "supports v0.9.0" and warns on Madara's default 0.10.2 route; the template points it at `/rpc/v0_9_0`.

If Torii stops following Madara (pre-confirmed semantics, RPC shape), that is a finding, not a blocker: record it here
and move on — the client's live path is being replaced anyway.

## Measure

Madara logs one structured `close_block_complete` line per block. That log is the measurement source for the lab; the
script aggregates it:

```bash
deploy/madara-lab/scripts/block-stats.sh          # since container start
deploy/madara-lab/scripts/block-stats.sh --since 10m
deploy/madara-lab/scripts/block-stats.sh --since 2026-08-26T10:00:00Z --until 2026-08-26T10:10:00Z --json
```

It reports blocks, executed/reverted/rejected transactions, classes declared, L2 gas, transactions per busy block,
and p50/p95/max of `block_production_ms`, `close_block_total_ms`, `merklization_ms`, `db_write_ms`. The harness passes
its exact workload start and end timestamps to this script and stores the parsed result in the run manifest. It also
stores `host-state.sh` output as `hostStateStart` and `hostStateEnd`; those snapshots carry the host load, governor,
memory and swap pressure, Madara image and native state, native-class cache size, and the measurement-sensitive chain
config.

### 96-player harness

The harness creates a fresh dev-mode game, deploys 96 guest gameplay accounts, settles and provisions each player,
then rotates actions across the three realm explorers each settlement receives. Run the acceptance workload from the
repository root:

```bash
pnpm lab:harness -- --bots 96 --minutes 10
# equivalent: bun deploy/madara-lab/harness/run.ts --bots 96 --minutes 10
```

Every transaction records hash submission, the first observed `PRE_CONFIRMED` status, `ACCEPTED_ON_L2`, and the first
observation of that hash in both Torii's `transactions` and `events` tables. Receipt status is polled every 50 ms, and
the interval is stored in the report. Pre-confirmed latency is therefore quantized at the poll boundary; it is an
observed upper bound, not Madara's internal execution time. Every action also records the call count and summed wall
time for fee estimation, `getBlock`, and status polling. Produce completes only after Torii shows a labor or wood
production-output delta.

The JSON report is written under `deploy/madara-lab/.lab/runs/`. It includes the source revision, image digest, exact
requested and completed action mixes, latency percentiles, RPC load, host-state snapshots, threshold results, and
block statistics restricted to the workload window.

The corrected acceptance run passed on 2026-08-26 UTC. Its report is
`.lab/runs/20260826T070408628Z.json` (generated evidence, intentionally gitignored):

| Result | Value | Bar |
| --- | ---: | ---: |
| Completed actions | 3,840 / 3,840 | at least 3,500 |
| Reverts / failures / indexing loss | 0 / 0 / 0 | all zero |
| p95 submit → observed `PRE_CONFIRMED` | 105 ms | at most 1 s |
| p95 submit → `ACCEPTED_ON_L2` | 1.980 s | at most 4 s |
| p95 submit → indexed | 1.078 s | at most 6 s |

The requested and completed counts matched: 1,920 move, 1,152 explore, and 768 produce. All 768 Produce records carry
non-zero labor and wood-output deltas. The exact 10-minute workload window contained 3,840 executed transactions, zero
reverts, zero rejects, and 12 transactions per busy block at p50 and max. Block production was 1.875 s p50, 1.949 s
p95, and 2.186 s max; block close was 154.28 ms p95.

The pre-confirmed histogram is still poll-shaped: 3,229 of 3,840 actions were first observed at 50–52 ms. Read the
105 ms p95 as “observed by this poll boundary,” not “executed in 105 ms.” The workload made 97,552 measured driver RPC
calls, or 25.4 per action: 3,936 fee estimates, 3,840 `getBlock` calls, and 89,776 status polls. Their summed wall times
were 304.17 s, 2.37 s, and 55.43 s respectively; these sums include concurrent calls and are not elapsed run time. The
complete run, including setup and stamina warmup, made 107,021 measured driver RPC calls. Account deployment p95 fell
from the old ten-second polling floor to 2.067 s after setting the deployment receipt retry interval to 50 ms.

The start snapshot recorded the powersave governor, host load 9.51/11.46/10.54, 5,673 MiB swap in use, native
execution enabled, and 63 cached native classes. The cache held 66 classes at run end. Keep those conditions attached
to the latency and block figures when comparing another run.

### Fee-bound comparison

The lab accepts fixed L2 bounds with zero prices and rejects all-zero bounds. Reproduce the probe against a running
game with a free player slot:

```bash
pnpm lab:probe-bounds -- 8
```

On 2026-08-26, `explorer_move` with `l2_gas.max_amount = 1,200,000,000` and every price set to zero reached L2 in
2.013 s (`0x5d998b416174f6894da3ea051882493bb9caa140badd6ed9740a1f89f0db384`). The same call with all three
amounts and prices set to zero was rejected at submission in 7 ms: account validation failed with `Out of gas`.

The accepted policy now lives in `packages/core` and is selected by game chain. The harness and both game-client
provider entry points use it for `madara`; `appchain` keeps fee estimation and its existing headroom. The fixed-bounds
acceptance report is `.lab/runs/20260826T073408330Z.json`:

| Measurement | Estimated bounds | Fixed zero-price bounds |
| --- | ---: | ---: |
| Completed actions | 3,840 / 3,840 | 3,840 / 3,840 |
| Workload fee estimates | 3,936 | 0 |
| Measured driver RPC calls/action | 25.40 | 24.22 |
| Submit-delay p95 | 158 ms | 10 ms |
| Submit → `ACCEPTED_ON_L2` p95 | 1.980 s | 1.983 s |
| Block production p50 / p95 | 1.875 s / 1.949 s | 1.875 s / 1.916 s |
| Transactions per busy block p50 / max | 12 / 12 | 12 / 12 |

The fixed run made 92,993 measured workload RPC calls and 102,403 for setup, warmup, and workload combined. Its exact
window again contained 3,840 executed transactions with zero reverts or rejects; all 768 Produce actions had labor and
wood-output deltas. The bounds change removed an aggregate 304.17 s of concurrent fee-estimate RPC time and the
pre-submit queueing it caused. It did not change L2 inclusion latency. The fixed run started at host load
3.62/2.49/3.74 versus 9.51/11.46/10.54 for the estimated run, so the small block-production difference is not isolated
enough to credit to this change.

The failed runs named the bottlenecks before the pass:

- VM execution with the upstream 600-transaction block ceiling admitted a 120-transaction game block that took 659
  seconds. Native execution plus a 12-transaction ceiling kept block production below 2.1 seconds during the final
  workload.
- One Torii query loop per action overwhelmed the SQL endpoint. One observer now batches up to 64 transaction hashes
  or explorer ids per query; the final run lost no indexed action.
- The first tuned 96-player run completed 3,552 actions but left every explorer behind its exploration frontier for
  ticks 31–33. Move selection now returns an explorer to the frontier first; the 40-tick regression test and final run
  both completed all exploration slots.

Cairo Native is on by default because the VM-only run did not meet the workload. To reproduce the comparison path:

```bash
MADARA_NATIVE=false docker compose up -d --wait madara
```

Compilation is asynchronous with a VM fallback (`--native-compilation-mode=async`); native artifacts are cached under
the data volume (`native_classes/`) and survive restarts. Warm every game class once (a full harness run) before
reading numbers, and compare against a VM run on the same block-stats window.

### Execution and latency (measured 2026-08-26)

- Blockifier optimistic concurrency is **on by default** (`block_production_concurrency` defaults: enabled,
  `n_workers` = all cores). Measured 2.8 cores during a 24-tx burst; blocks #51847–48 executed 12 queued
  transactions in 269–319 ms (~25 ms/tx, native warm). Busy blocks at the 96-bot load close at ~1.87 s because that
  is how long 12 txs take to **arrive** at 6.4 tx/s — arrival-bound, not execution-bound; ~6× execution headroom at
  the current `n_txs: 12` cap.
- The batcher hands the executor up to `execution_batch_size` (4) ready transactions and never waits; pre-confirmed
  state persists after every batch. The value is both flush granularity and intra-batch parallelism cap.
- Pre-confirmed status was first observed at the 50 ms poll boundary in the account probe and most harness actions.
  Treat these values as poll-quantized upper bounds, not internal execution timings.

## Pinning

| Component | Pin | Why |
| --- | --- | --- |
| Madara | `ghcr.io/madara-alliance/madara@sha256:3c931fa515bbd3760fd5cbc0bcdceb557d3edbd44bec0231cdf52dd6abb475f6` (`v0.11.0-alpha.9`) | Exact image used by the passing run; tags are mutable |
| Chain config | Full alpha.9 `devnet` preset, with the lab identity, 2 s blocks, 250 ms pending updates, execution batches of 4, and a 12-transaction block ceiling | Madara rejects partial configs; every measurement variable stays explicit |
| Torii | `ghcr.io/dojoengine/torii:v1.8.16` | Last known-good version with this client |
| sozo | 1.8.7 | Speaks RPC 0.9/0.10 and has the blake2s flag |
| Caddy | `caddy:2-alpine` (2.11.4, `sha256:5f5c8640…`) | TLS front; set `CADDY_IMAGE` to compare another image |
| Postgres | `postgres:17-alpine` (17.11, `sha256:18cfe3ef…`) | Session store; set `POSTGRES_IMAGE` to compare another image |

Set `MADARA_IMAGE` in a `.env` next to the Compose file to compare another build. Use a full digest reference and
record it here before treating the results as comparable.

## What Madara does not give you (as of alpha.9)

- **No WebSocket subscriptions at this pin.** The RPC port accepts the WS upgrade but every `starknet_subscribe*`
  fails immediately (`-32603`). Upstream implemented them on 2026-08-20 (#1012): verified working on
  `nightly-e674321` at `/rpc/v0_10_2` (`subscribeNewHeads`, `subscribeTransactionStatus`, `subscribeEvents`,
  `subscribeNewTransactions`), with the v0.8/v0.9 subscribe methods removed. Until a pin bump is measured, the
  client's live path stays on Torii (canary) and finality is polled.
- **No `dev_predeployedAccounts`.** Player accounts do not need it: each key deploys its own account fee-free
  ("Gameplay accounts" above). The deployer and the binding authority use the deterministic genesis accounts.
- **No embedded VRF, paymaster, or Controller.** The contracts fall back to transaction-hash randomness when the VRF
  provider address is `0x0` and the chain is not mainnet/sepolia (`contracts/game/src/utils/random.cairo:15-18`) —
  fine for the lab, never for a prized game. Fees are disabled with `--no-charge-fee`, so no paymaster is needed.

## Next: settlement-layer (L3) profile

This is the sustainability path and is *not* wired yet. What it needs, from Madara's own docs and the orchestrator's
`.env.example`:

- Madara flags: `--sequencer --settlement-layer starknet --l1-endpoint <Starknet RPC>`, with gas prices in FRI
  (`--l1-gas-price`, `--blob-gas-price`). The chain config's `eth_core_contract_address` then names the **Piltover**
  core contract deployed on the settlement Starknet (`keep-starknet-strange/piltover`), and
  `eth_gps_statement_verifier` the verifier there.
- The [madara-orchestrator](https://github.com/madara-alliance/madara-orchestrator) runs beside the sequencer and
  drives SNOS → proof → state update: `MADARA_ORCHESTRATOR_STARKNET_SETTLEMENT_RPC_URL`,
  `MADARA_ORCHESTRATOR_STARKNET_ACCOUNT_ADDRESS/PRIVATE_KEY`,
  `MADARA_ORCHESTRATOR_STARKNET_CAIRO_CORE_CONTRACT_ADDRESS`, a prover (`MADARA_ORCHESTRATOR_ATLANTIC_*` with
  `ATLANTIC_SETTLEMENT_LAYER=starknet`, or SHARP), and `MADARA_ORCHESTRATOR_RPC_FOR_SNOS`.
- Sequence: deploy Piltover + verifier on Starknet Sepolia → run Madara in sequencer mode against it → run the
  orchestrator with a mock fact registry first (`ATLANTIC_MOCK_FACT_HASH=true`) → real proofs.

Cost and cadence of settlement (blocks per proof, proof latency, STRK per update) are the numbers that decide whether
"sustainable" holds. They are the first thing to measure once the game runs here. Until then this section is a plan,
not a fact.

## Layout

```
deploy/madara-lab/
  docker-compose.yml       madara + caddy (+ torii canary and web/postgres profiles), pinned images, localhost ports
  Caddyfile                TLS front: *.realms.test → dev servers, madara, torii, identity RPC upstream
  chain-config.yaml        full chain config (see Pinning)
  torii.toml.template      rendered to .lab/torii.toml by deploy-world.sh
  harness/                 account factory, workload driver, Torii observer, and JSON report writer
  scripts/issue-certs.sh   wildcard certificate from the shared mkcert root into .lab/certs/
  scripts/deploy-world.sh  sozo build + migrate with the Madara-specific flags
  scripts/bootstrap-game.sh  gameplay contracts + ChainConfig + preset 1
  scripts/deploy-gameplay-contracts.ts  idempotent class declaration and registry deployment
  scripts/probe-deploy-account.ts  fee-free deploy_account proof + timings
  scripts/block-stats.sh   aggregates Madara's per-block JSON log
  scripts/block-stats.py   the aggregation
  .lab/                    generated: world-address, torii.toml, certs/, runs/ (gitignored)
contracts/game/dojo_madara.toml   sozo profile for this chain
contracts/game/Scarb.toml         [profile.madara]
```
