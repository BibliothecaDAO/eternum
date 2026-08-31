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
  `127.0.0.1 realms.test play.realms.test rpc.realms.test herald.realms.test identity-rpc.realms.test`.
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
| 3003 | herald (`pnpm --dir apps/herald start`), fronted as `https://herald.realms.test` — add `herald.realms.test` to the `/etc/hosts` line; set `VITE_PUBLIC_HERALD_URL=https://herald.realms.test` in `apps/game/.env` to make it the game's transport |
| 5050 | Starknet JSON-RPC. `/` is v0.10.2; `/rpc/v0_9_0`, `/rpc/v0_8_1`, `/rpc/v0_10_0` are pinned routes |
| 5051 | Madara admin RPC (`madara_*`). Never expose.                                            |
| 5062 | Feeder gateway + gateway                                                               |
| 5432 | Postgres for `apps/web` (profile `web`, see below)                                     |

### HTTPS: Caddy in front of everything a browser touches

Browsers are the only TLS clients. `sozo`, the deployer, the harness and the probe stay on plain HTTP to
the host services. Caddy (`Caddyfile`) terminates TLS on `127.0.0.1:443` with one wildcard certificate:

| Host                        | Upstream                                                           |
| --------------------------- | ------------------------------------------------------------------ |
| `realms.test`               | `apps/web` dev server on the host, `http://localhost:3000`         |
| `play.realms.test`          | `apps/game` dev server on the host, `https://localhost:5173`       |
| `herald.realms.test`        | `apps/herald` on the host, `http://localhost:3003`                 |
| `rpc.realms.test`           | `madara:9944` (paths pass through: `/rpc/v0_9_0` works)            |
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

It starts Madara and Caddy, deploys the world, then bootstraps the gameplay contracts and preset. The equivalent
individual commands are below.

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

The world script writes `contracts/game/manifest_madara.json` (gitignored, like the spike manifest) and records the
world address under `.lab/`. The bootstrap script writes the gameplay contract class hashes and registry address to
`.lab/gameplay-contracts.json`.

Create a game after Herald is running:

```bash
RPC_URL=http://127.0.0.1:5050/rpc/v0_9_0 \
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
GAMEPLAY_ACCOUNT_CLASS_HASH=0x05085c5c53efdc762c7c0637c92eecaf962aa3d72774b38faf3b8852c1729093
PLAYER_REGISTRY_ADDRESS=0x047d5db2930b9a3270d9cb0e31e3eed2645602c5b51419207f730f3a7f8fafe0
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
then rotates actions across the three realm explorers each settlement receives. The measured window starts when every
bot has enough explorer stamina for one legal action; it does not wait for every explorer to refill. Run the acceptance
workload from the repository root:

```bash
pnpm lab:harness -- --bots 96 --minutes 10
# equivalent: bun deploy/madara-lab/harness/run.ts --bots 96 --minutes 10
```

Every transaction records hash submission, the first observed `PRE_CONFIRMED` status, and `ACCEPTED_ON_L2`. Receipt
status is polled every 50 ms, and the interval is stored in the report. Pre-confirmed latency is therefore quantized at
the poll boundary; it is an observed upper bound, not Madara's internal execution time. Setup and action state reads use
Herald's selective confirmed snapshots; Produce completes only after Herald shows a labor or wood production-output
delta. Every action also records the call count and summed wall time for `getBlock` and status polling.

The JSON report is written under `deploy/madara-lab/.lab/runs/`. It includes the source revision, image digest, exact
requested and completed action mixes, latency percentiles, RPC load, host-state snapshots, threshold results, and
block statistics restricted to the workload window.

For the B.2 value-plane gate, `--ledger` creates a non-dev game, opens the matching mainnet ledger game, funds each bot
from the treasury LORDS float, and registers each owner on mainnet. It deploys persistent owner-bound gameplay
accounts, binds them through `PlayerRegistry`, waits for the operator to relay every `LedgerRegistration`, and only then
settles on the lab. After the workload it submits the complete points-ordered roster, waits for mainnet
`apply_results`, and returns each bot's payout to the treasury. The manifest records funding, registration, binding,
ranking, finalization, and sweep transaction hashes. Before the first treasury transfer it estimates one worst-case
approve-and-register multicall and requires every owner to hold 2.5 times that fee in STRK, covering registration,
sweep, and fee movement. It writes the estimate, required floor, each owner's observed STRK balance, and immutable
LORDS baseline to a `.sweep.json` manifest beside the run reports. Normal finalization and `--sweep-only` both write a
sweep receipt before checking run conservation, so the recovery transaction hashes survive an accounting failure.

The accounts file is a JSON array with exactly `--bots` entries. Keep it outside the repository: it contains mainnet
and gameplay private keys, and the mainnet accounts must already be deployed. The harness derives and enforces the
required STRK balance from the current mainnet fee estimate before it moves treasury LORDS.

```json
[
  {
    "mainnetAddress": "0x...",
    "mainnetPrivateKey": "0x...",
    "gameplayPrivateKey": "0x...",
    "sword": false,
    "shield": false
  }
]
```

With `apps/operator` running and the root `.env` defining `LEDGER_ADDRESS`, `LEDGER_RPC_URL`, `LORDS_ADDRESS`,
`LEDGER_TREASURY_ADDRESS`, `LEDGER_TREASURY_PRIVATE_KEY`, and `BINDING_AUTHORITY_PRIVATE_KEY`:

```bash
pnpm lab:harness -- --ledger --ledger-accounts /secure/path/ledger-bots.json --bots 96 --minutes 10
```

If the run stops after treasury funding, recover every LORDS balance above those recorded baselines without starting a
game or touching the lab:

```bash
pnpm lab:harness -- --sweep-only deploy/madara-lab/.lab/runs/<run>.sweep.json \
  --ledger-accounts /secure/path/ledger-bots.json
```

Sweep-only requires `LEDGER_RPC_URL`, `LORDS_ADDRESS`, and `LEDGER_TREASURY_ADDRESS`. It validates the manifest and
owner roster, refuses a non-mainnet RPC or a balance below baseline, writes a machine-readable receipt next to the
manifest, and never reads the gameplay contracts.

The default mainnet registration window is 900 seconds. Use `--ledger-start-delay-seconds` only when the RPC or account
roster needs a larger window. The ordinary command above this section remains dev mode and never requires a ledger.

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

### Headroom: player cadence and concurrent games

The 2026-08-27 headroom sequence removed both configured ceilings from the expected load: `n_txs` was 256 and the
Sierra-gas allowance was 100,000,000,000 per block. Native execution, fixed zero-price bounds, 2 s blocks, 250 ms
pending updates, and execution batches of 4 stayed unchanged. Every report below embeds those values plus host state
at workload start and end.

#### Shape (a): fastest game-legal per-bot cadence

One-minute probes searched downward from one action per bot per second. Longer probes resolved the stamina boundary;
the first full ten-minute zero-failure cadence, to whole-second resolution, was one action per bot every 16 seconds:

| Cadence | Window | Completed / planned | Failure class | Pre-confirmed p95 | Block production p95 | Report |
| ---: | ---: | ---: | --- | ---: | ---: | --- |
| 1 s | 1 min | 3,012 / 5,760 | 2,664 game rule; 84 pathing | 2.840 s | 2.734 s | `.lab/runs/20260827T102445308Z.json` |
| 2 s | 1 min | 1,937 / 2,880 | 865 game rule; 78 pathing | 1.918 s | 3.005 s | `.lab/runs/20260827T102948597Z.json` |
| 4 s | 1 min | 1,173 / 1,440 | 231 game rule; 36 pathing | 2.080 s | 2.645 s | `.lab/runs/20260827T103416639Z.json` |
| 8 s | 1 min | 755 / 768 | 13 game rule | 101 ms | 2.034 s | `.lab/runs/20260827T103811840Z.json` |
| 10 s | 1 min | 575 / 576 | 1 game rule | 102 ms | 2.071 s | `.lab/runs/20260827T104308478Z.json` |
| 12 s | 2 min | 956 / 960 | 4 game rule | 52 ms | 2.038 s | `.lab/runs/20260827T104807463Z.json` |
| 13 s | 10 min | 4,476 / 4,512 | 36 game rule | 52 ms | 2.059 s | `.lab/runs/20260827T110821126Z.json` |
| 14 s | 3 min | 1,245 / 1,248 | 3 game rule | 101 ms | 2.070 s | `.lab/runs/20260827T111511255Z.json` |
| 15 s | 10 min | 3,835 / 3,840 | 5 game rule | 107 ms | 2.073 s | `.lab/runs/20260827T120112651Z.json` |
| **16 s** | **10 min** | **3,648 / 3,648** | **none** | **52 ms** | **2.032 s** | `.lab/runs/20260827T122319748Z.json` |

A short 13-second probe passed, but the full run exposed 36 stamina misses; the full duration is the gate. The
15-second failures occurred before a late unrelated host job appeared, so they are game-rule failures rather than a
load attribution. The clean 16-second run had zero failures, reverts, or indexing loss. Its busiest blocks held 13
transactions at most; the slowest, block 84026, carried 12 transactions and 3.699 B Sierra gas. Block production was
2.087 s, including 158 ms to close, 149 ms of merklization, and 2.24 ms of DB write. The workload starts after one
action's stamina per bot; this replaced a full-refill hold that cost about four minutes in the closing match.

#### Shape (b): concurrent 96-player games

One process scheduled every game at one action per bot per 15 seconds. `N=1`, `N=2`, `N=4`, and `N=8` were run
back-to-back with no parallel heavy job and no container restart:

| Games | Offered rate | Completed / planned | Game / path / chain failures | Pre-confirmed p95 | Submit-delay p95 | Block production p95 / max | Busy-block tx p50 / max | Report |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 6.4 tx/s | 3,837 / 3,840 | 3 / 0 / 0 | 52 ms | 9 ms | 2.046 / 2.146 s | 13 / 13 | `.lab/runs/20260827T131912211Z.json` |
| 2 | 12.8 tx/s | 7,678 / 7,680 | 2 / 0 / 0 | 101 ms | 9 ms | 2.080 / 2.169 s | 26 / 26 | `.lab/runs/20260827T133614317Z.json` |
| **4** | **25.6 tx/s** | **9,042 / 15,360** | **0 / 2,707 / 3,611** | **7.855 s** | **439.193 s** | **5.514 / 13.279 s** | **52 / 219** | `.lab/runs/20260827T141017762Z.json` |
| 8 | 51.2 tx/s | 273 / 30,720 | 1 / 14,662 / 15,784 | 1.644 s[^n8-tail] | 522.777 s | 23.763 / 84.629 s | 7 / 632[^attempts] | `.lab/runs/20260827T155113802Z.json` |

The first reading of this table judged `block_production_ms` against a 2.000 s bar and found no passing point; that
bar was mis-specified — production includes the 2 s block clock, so an idle chain reads ~2.0 s. The brief's corrected
bar (D.4.1, 2026-08-27) is **close cost, `closeBlockMs` p95 ≤ 300 ms**, which the manifests already carry: shape (a)
at 16 s 121 ms, `N=1` 125 ms, `N=2` 249 ms — pass; `N=4` 849 ms — fail. `N=1` and `N=2` also kept client-visible
pre-confirmation ≈ 100 ms with zero chain/driver failures. The clear execution/RPC capacity wall is **N=4**: pre-confirmed p95 rose to 7.855 s, L2 p95 to
8.669 s, indexed p95 to 32.735 s, and 2,626 submitted transactions were not observed by both Torii sources before
their timeout. The configured ceilings did not bind there: the busiest logged block attempted 219 transactions and
used at most 23.728 B of the 100 B Sierra allowance.

The N=4 wall evidence line is block 87154: `block_production` 13.279 s, of which the pre-close portion was about
11.472 s; 174 attempted transactions, 2 execution batches, 23.728 B Sierra gas, 1.807 s close, 1.676 s
merklization, and 24.7 ms DB write. Alpha.9 emitted no parseable mempool samples in this window. At N=8 the backlog
later appears to contact the configured transaction ceiling: block 89709 reported 256 attempted transactions and
38.460 B Sierra gas;
`block_production` was 84.629 s, close 7.724 s, merklization 7.253 s, and DB write 97.4 ms. That cap contact is a
consequence of collapse, not the N=4 wall.

[^n8-tail]: Only 273 actions completed at N=8, so its completed-action latency percentile is selection-biased and
    must not be read as an improvement over N=4.
[^attempts]: The block-stat transaction count uses Madara's attempted/executed count, including rejected attempts;
    2,213 attempts were rejected at N=8, so this figure can exceed the 256 transactions added to one block.

The N=8 start snapshot already carried the sequence's heat: load 7.70/3.84/3.32 and 8,172 MiB swap used; its end
snapshot was 1.60/23.20/31.52 with swap full. Those facts travel with the result. During the first N=8 attempt, an
action-time `getBlock` socket failure escaped the per-action boundary and prevented report creation. The action
chokepoint now records that class as `driver_failed / chain_or_driver`; the regression test proves `runWorkload`
resolves and the committed rerun produced all 30,720 requested records.

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
  transactions in 269–319 ms (~25 ms/tx, native warm). The new `N=1` and `N=2` points remain arrival-bound around the
  2 s clock; `N=4` is the first clear execution/RPC wall. The current `n_txs: 256` and 100 B Sierra-gas ceilings both
  sat above the N=4 load. N=8 contacted the transaction cap only after a several-minute submit backlog formed.
- The batcher hands the executor up to `execution_batch_size` (4) ready transactions and never waits; pre-confirmed
  state persists after every batch. The value is both flush granularity and intra-batch parallelism cap.
- Pre-confirmed status was first observed at the 50 ms poll boundary in the account probe and most harness actions.
  Treat these values as poll-quantized upper bounds, not internal execution timings.

### Phase-1 closing match (D.5) — 2026-08-27

Game 16 `phase1-final-3`, 30 minutes, one human (Controller identity → SIWS → wallet-bound gameplay account
`0x07ef0b…dbf`, settled by hand) plus 95 harness bots (`pnpm lab:harness -- --bots 95 --minutes 22 --game-id 16`,
manifest `.lab/runs/20260827T094010298Z.json`). Lobby full at 11:13:32 (96/96), bots at cadence from 11:17:47,
game ended 11:38:59 with a result: **the human ranked #1 of 96** (1.31 B registered points; best bot 260 M, median
bot 230 M).

| Measured over the 23-minute workload window | |
| --- | --- |
| Actions | 8,326 / 8,360 completed; 34 reverted (0.4 %) |
| Reverts | all `"one of the tiles in path is occupied"` — two actors targeting one tile; contention, not a fault |
| Pre-confirmed p50 / p95 / p99 | 51 / 102 / 153 ms (50 ms poll) |
| Accepted on L2 p95 | 2.03 s |
| Indexed by Torii p95 | 1.89 s |
| Madara, same window | 8,389 txs executed, 34 reverted, 0 rejected; 13 txs per busy block (p50, max 15); `block_production` p50 1.99 s (arrival-bound at cadence); sierra gas per busy block p50 1.5 G, p95 3.6 G, max 4.3 G |

That schema-3 manifest reports `passed: false` because it predates revert classification: the 34 human/bot tile
contention reverts also counted as indexing loss. Schema 4 now classifies the exact occupied-tile reason as
`tile_contention`, excludes reverted transactions from indexing loss, and treats only that reason as non-blocking.
The historical artifact is unchanged; the gate as written in the brief — one human plus 95 bots played to a result on
the lab — is met.

## Pinning

| Component | Pin | Why |
| --- | --- | --- |
| Madara | `ghcr.io/madara-alliance/madara@sha256:ec30298d51ce0780e1ad88cc00e1c17bef31530d0e338fe7fcc1d71d1bad31b2` (`nightly-e674321`, 2026-08-20, index digest) | WebSocket subscriptions; bumped 2026-08-27 (phase-2 A.0, below). Phase 1 was measured on `v0.11.0-alpha.9` = `sha256:3c931fa5…` |
| Chain config | Full alpha.9 `devnet` preset (accepted unchanged by the nightly), with the lab identity, 2 s blocks, 250 ms pending updates, execution batches of 4, 256 transactions, and 100,000,000,000 Sierra gas per block | Madara rejects partial configs; every measurement variable stays explicit |
| Torii | `ghcr.io/dojoengine/torii:v1.8.16` | Last known-good version with this client |
| sozo | 1.8.7 | Speaks RPC 0.9/0.10 and has the blake2s flag |
| Caddy | `caddy:2-alpine` (2.11.4, `sha256:5f5c8640…`) | TLS front; set `CADDY_IMAGE` to compare another image |
| Postgres | `postgres:17-alpine` (17.11, `sha256:18cfe3ef…`) | Session store; set `POSTGRES_IMAGE` to compare another image |

Set `MADARA_IMAGE` in a `.env` next to the Compose file to compare another build. Use a full digest reference and
record it here before treating the results as comparable.

### Pin bump to `nightly-e674321` (phase-2 A.0) — 2026-08-27

Why: WebSocket subscriptions (#1012, merged 2026-08-20) are the read path herald is built on; `alpha.9` stubs every
`starknet_subscribe*` with `-32603`, and as of 2026-08-27 the `nightly` tag is this same build and no `v0.11.0` past
alpha.9 is published. Method: the nightly was booted first against a *copy* of the lab data volume (8 GB, scratch
ports 5070–5072), then the compose pin was swapped and `madara-lab` restarted on its real volume. Facts:

- **No DB migration.** The nightly opened the alpha.9 database as-is and closed its first block within 2 s of start;
  Madara was unreachable for ~10 s during the restart. Stale mempool entries saved by alpha.9 were dropped with
  `Nonce mismatch` warnings — the N=8 backlog leftovers, harmless.
- **All 21 flags in the compose command exist on the nightly**; `--full`, `--gateway-url`, `--backup-dir`,
  `--sequencer` (phase-2 E.2) exist too. `block_production_concurrency` is still `#[serde(default)]` with
  `disable_concurrency: false`, `n_workers` = cores (`chain_config.rs:108-128` at e674321).
- **Routes:** HTTP and WS both serve `/rpc/v0_7_1`, `v0_8_1`, `v0_9_0`, `v0_10_0`, `v0_10_2`; `/` is v0.10.2. WS
  `starknet_subscribeNewHeads` on `/rpc/v0_10_2` (dotted `/rpc/v0.10.2/` also works) delivered the first head 19 ms
  after subscribing on the lab port; `subscribe*` on `v0_9_0` is `-32601 Method not found`. Native execution on, async,
  cached classes reused from `/data/native_classes`.
- **Latency unchanged:** `probe-deploy-account.ts` — scratch: submit 25 / pre-confirmed 77 / L2 1,968 ms; lab after
  cutover: 51 / 104 / 209 ms (50 ms poll; the L2 figure is block-timing luck).
- **Torii 1.8.16 cannot parse the nightly's v0.9 pre-confirmed block when it holds transactions**
  (`data did not match any variant of untagged enum JsonRpcResponse`, 80 ms before block #91621 closed with the
  probe's tx; `Fetching reestablished` once it closed). Torii keeps following the chain head and indexes every
  transaction after the block closes and its retry backs off. **Smoke on the new pin** (`pnpm lab:harness -- --bots 4
  --minutes 1`, `.lab/runs/20260827T165508232Z.json`): 16/16 actions, zero failures or reverts; pre-confirmed p95
  255 ms; L2 p95 1.90 s; **Torii-indexed p50 5.1 s / p95 7.5 s** (1.89 s on alpha.9) — the manifest's only failed
  check. Not investigated: Torii is deleted by phase-2 section A, and herald reads the WS stream this pin exists for.
  Until then, judge harness runs on this pin by pre-confirmed and L2; `indexedP95` is a known cost of the pin.

### Forced pre-confirmed replacement — what a subscriber sees (phase-2 A.0 gate) — 2026-08-27

Tool: `pnpm lab:probe-ws <out.jsonl>` (`scripts/probe-ws-subscriber.mjs`) subscribes to `subscribeNewHeads`,
`subscribeEvents` (`finality_status: PRE_CONFIRMED`) and `subscribeNewTransactions` on `/rpc/v0_10_2` and reconnects
across a restart. Three concurrent `probe-deploy-account.ts` runs filled the pre-confirmed block; the sequencer was
then killed two ways:

- **SIGTERM (`docker compose restart`)** — Madara closes the pre-confirmed block on graceful shutdown: block 92333
  closed 517 ms into its 2 s window with all three transactions; subscribers saw `PRE_CONFIRMED` events, then the
  `ACCEPTED_ON_L2` events with the head, then the socket closed. On reconnect (≈2.4 s later) `subscribeEvents`
  **re-sent block 92333's `ACCEPTED_ON_L2` events** — a repeat.
- **SIGKILL** — Madara saves pre-confirmed blocks to its database by default (`💾 Preconfirmed blocks will be saved to
  database`; `--no-save-preconfirmed` turns it off). After the kill and restart (≈3.8 s gap) the same two transactions
  came back as `PRE_CONFIRMED` at the same height — each event emitted **twice** on the new subscription — and 30 ms
  later the block closed as 92386 with the same hashes; a transaction submitted after the restart landed in 92387.
  **No replacement occurred in either case.** Pre-confirmed events carry `block_number: null`.

Consequences for herald (phase-2 brief, A "State model"): deduplicate by `(transaction_hash, event_index)` — repeats
are the observed behaviour, on subscribe and on reconnect; rebuild the overlay from one `pre_confirmed` read on every
new head — cheap insurance that also covers the one replacement path this lab has not yet exercised, **failover to
the replica** (a pre-confirmed block that never reached the gateway dies with the sequencer; E.2's promotion drill
measures exactly that loss). Every restart also re-logs ~7,600 `Nonce mismatch` warnings: the saved mempool still
holds the N=8 backlog and re-checks it on start — harmless, and it goes when the data volume is rebuilt.

### E.2 redundancy — in progress (2026-08-27)

Compose now carries the three E.2 pieces; drills run only between Codex's harness measurements (one host):

- **Identity gate (proven).** The sequencer's entrypoint refuses to start without `/data/SEQUENCER`; the token is
  seeded on the lab volume and the sequencer restarts fine behind it. `scripts/promote-replica.sh` stops and removes
  the old sequencer, verifies port 5050 is closed, moves the token to the replica's volume, and starts
  `madara-promoted` (the sequencer command on that volume, network alias `madara` so Caddy and herald keep
  resolving). **Not yet drilled end to end** — the drill runs inside a harness game to record RPO/RTO.
- **Replica (proven to sync).** `docker compose --profile replica up -d madara-replica` follows the sequencer's
  feeder gateway: ~540 blocks/s through empty blocks, ~100 blocks/s through game-heavy ones on the Cairo VM
  (native is now enabled for it), so a from-genesis catch-up of the 98k-block lab is a few minutes. RPC on
  127.0.0.1:5055. Stopped while Codex measures.
- **Backups: Madara's `--restore-from-latest-backup` is broken at this pin — do not use it.** A restore copies the
  backup ("restoring latest backup done", 3.7 s for a 6.1 GB backup) and the node then starts from genesis: in
  `RocksDBStorage::open` (`crates/client/db/src/rocksdb/mod.rs` at e674321) `DB::open_cf_descriptors` runs first
  (`:289`, creating an empty database and reading its tip) and `BackupManager::start_if_enabled` restores into the
  same directory afterwards (`:305`), under the open handle. Reproduced twice on a fresh volume. The fix is
  upstream (restore before open); until then the backup layer is **volume snapshots of the stopped replica**
  (consistent, provider-agnostic; restore = untar into a fresh volume and start). The backup flags were removed
  from compose; a 50-block interval had written 6 GB per backup every 100 s during the drill.

## What Madara does not give you (as of the nightly pin)

- **WebSocket subscriptions are version-scoped.** They exist only on `/rpc/v0_10_2`; the v0.8/v0.9 subscribe methods
  are removed. Herald subscribes there; sozo and the harness stay on `/rpc/v0_9_0`.
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

## Server profile (rented box, Cloudflare Tunnel) — prepared 2026-08-29

The same compose on a rented box (first: Latitude `f4.metal.small`, New York, from 2026-08-31 — see "Box and
region" below). Differences from the laptop, all of them deletions of laptop machinery: no mkcert, no `realms.test`, no Caddy — **Cloudflare Tunnel** terminates TLS on the owner's zone
and the box opens no public port but SSH. Herald and `apps/web` run as systemd units on the host (herald is the read
path; `apps/web` holds the binding-authority key, so it must run where the chain is). The game client is served by
Cloudflare Pages and talks to these hosts:

| Host                    | Service                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `rpc.<LAB_DOMAIN>`      | `madara:9944` through the tunnel (paths pass through)               |
| `herald.<LAB_DOMAIN>`   | herald on the host, `:3003` (HTTP + WebSocket)                      |
| `app.<LAB_DOMAIN>`      | `apps/web` on the host, `:3000` (SIWS, binding authority)           |
| identity RPC            | not proxied: the browser calls the public mainnet node directly     |

### Box and region — chosen for action latency (2026-08-30)

An action's latency is network RTT to the origin + serial Cairo execution on one sequencer core + herald's fold and
push. The box and the region are picked for those two terms; nothing else about the profile depends on them.

- **Region: New York (NYC).** One origin for testers in Spain, Brazil, Australia and China; the US East seaboard is
  the best single point for that set (≈80 / 110 / 215 / 230 ms) and a major Cloudflare PoP, so the tunnel's
  edge→origin leg is short (Ashburn was first choice but had no f4 stock on 2026-08-30; NYC is the same Atlantic
  profile). Dallas trades ~25 ms better for the Pacific side against ~30 ms worse for the Atlantic side — move only
  if the per-player `__clientActionLatencySummary` numbers say so.
- **Box: `f4.metal.small`** (EPYC 4484PX: Zen 4, 12c/24t, 4.4 base / 5.7 GHz boost, 128 MB 3D V-Cache; 96 GB DDR5
  ECC; 2×960 GB NVMe; 2×10 Gbps; $0.55/h or $398/mo). The sequencer executes one action's Cairo on one core, so the
  pick is the highest-clocked Zen 4 on the list with the largest cache — not the most cores. `m4.metal.small`
  (4244P, 6c, 5.1 GHz, $296) is the same core slower; `m4.metal.medium` (9124 Genoa, 3.7 GHz, $456) costs more and
  is slower on the serial path. Bigger boxes add cores the chain cannot use.
- **Everything on the one box** (Madara, Postgres, herald, `apps/web`): no cross-host hop anywhere in the action path.
- **Backups to Cloudflare R2** (S3-compatible, zero egress): one bucket, one `s5cmd` sync of the Madara DB snapshot
  and the Postgres dump on a cron, token in the root `.env`. Replaces the laptop-local backup path.
- **Measure both terms separately**: origin-side latency from an SSH session on the box (the client brief's bars, no
  network), and per-player latency from the client summary; the difference is the network and decides the region.

Once, on the owner's machine (needs the Cloudflare account): `cloudflared tunnel login`, `cloudflared tunnel create
realms-lab` (prints the `TUNNEL_ID` and writes `~/.cloudflared/<id>.json`), then one CNAME per host:
`cloudflared tunnel route dns realms-lab rpc.<LAB_DOMAIN>` (and `herald.`, `app.`). Copy the JSON to the box as
`/root/credentials.json`.

On the box, as root, fresh Ubuntu 24.04:

```bash
curl -fsSLO https://raw.githubusercontent.com/BibliothecaDAO/eternum/feat/madara-lab/deploy/madara-lab/scripts/bootstrap-server.sh
LAB_DOMAIN=lab.example.com TUNNEL_ID=<uuid> bash bootstrap-server.sh
```

It installs Docker, node 22 + pnpm, bun and asdf (scarb 2.13.1, sozo 1.8.7) for a `realms` user, checks the repo
out at `/opt/realms/eternum`, renders `.lab/cloudflared/config.yml` from `cloudflared/config.yml.template`, installs
the `herald` and `web` units, and closes every port but SSH (`ufw`). Then, as `realms`:

```bash
cd /opt/realms/eternum
cp .env.example .env            # DATABASE_URL=postgres://realms:realms@127.0.0.1:5432/realms, IDENTITY_RPC_URL=<mainnet rpc>,
                                # BINDING_AUTHORITY_*: the lab authority pair — never a mainnet key
pnpm install && pnpm run build:packages
cd deploy/madara-lab
docker compose --profile server --profile web up -d --wait madara postgres cloudflared   # never caddy here
scripts/deploy-world.sh && scripts/bootstrap-game.sh             # as on the laptop; fresh genesis
sudo systemctl start herald web
curl -s https://herald.<LAB_DOMAIN>/health
```

Redeploys are `git pull && pnpm run build:packages && sudo systemctl restart herald` (and `pnpm --dir apps/web build
&& sudo systemctl restart web`). The harness runs on the box (`pnpm lab:harness`) — driver-on-box for now; the
driver-off-box variant (E.1) is the laptop against `rpc.<LAB_DOMAIN>` and is a separate measurement. Record the
`cloudflared` image digest here at first `up` (pin discipline). Cloudflare's proxy has a 100 s per-request limit and
WebSockets pass through; the herald stream and the RPC are both fine with that.

## Layout

```
deploy/madara-lab/
  docker-compose.yml       madara + caddy (+ web/postgres profile), pinned images, localhost ports
  Caddyfile                TLS front: *.realms.test → dev servers, madara, herald, identity RPC upstream
  chain-config.yaml        full chain config (see Pinning)
  harness/                 account factory, workload driver, Herald observer, and JSON report writer
  scripts/issue-certs.sh   wildcard certificate from the shared mkcert root into .lab/certs/
  scripts/deploy-world.sh  sozo build + migrate with the Madara-specific flags
  scripts/bootstrap-game.sh  gameplay contracts + ChainConfig + preset 1
  scripts/deploy-gameplay-contracts.ts  idempotent class declaration and registry deployment
  scripts/probe-deploy-account.ts  fee-free deploy_account proof + timings
  scripts/block-stats.sh   aggregates Madara's per-block JSON log
  scripts/block-stats.py   the aggregation
  .lab/                    generated: world-address, certs/, runs/ (gitignored)
contracts/game/dojo_madara.toml   sozo profile for this chain
contracts/game/Scarb.toml         [profile.madara]
```
