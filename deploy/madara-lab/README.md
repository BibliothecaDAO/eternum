# Madara lab

The Realms game world running on a pinned, self-run [Madara](https://github.com/madara-alliance/madara) sequencer on
one machine. This is the measurement bench for the platform migration: execution, block production, receipt latency,
indexer behaviour, and the 96-player Blitz target — with the **current** Dojo contracts, unchanged.

Branch: `feat/madara-lab`. Companion brief: `docs/plans/madara-lab-codex-brief.md`. Direction:
`docs/reports/eternum-game-stack-direction-2026-08-21.html`.

## Prerequisites

- Docker with Compose v2 (`docker compose`), ~2 GB free for images and the chain volume.
- `sozo 1.8.7` through asdf (`ASDF_SOZO_VERSION=1.8.7`; the repo's `.tool-versions` pins 1.8.0, which does not
  speak this chain's RPC), `scarb 2.13.1`, `jq`, `bun`.
- Nothing from Cartridge: no Slot, no Controller, no paymaster, no hosted VRF.

## Bring the chain up

```bash
cd deploy/madara-lab
docker compose up -d --wait madara
curl -s -X POST -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"starknet_chainId","params":[]}' http://127.0.0.1:5060
# {"result":"0x57505f5245414c4d535f4d41444152415f4c4142"}  == WP_REALMS_MADARA_LAB
```

Endpoints (all bound to localhost only):

| Port | What                                                                                   |
| ---- | -------------------------------------------------------------------------------------- |
| 5060 | Starknet JSON-RPC. `/` is v0.10.2; `/rpc/v0_9_0`, `/rpc/v0_8_1`, `/rpc/v0_10_0` are pinned routes |
| 5061 | Madara admin RPC (`madara_*`). Never expose.                                            |
| 5062 | Feeder gateway + gateway                                                               |
| 8090 | Torii canary (profile `torii`, see below)                                              |

Genesis is deterministic: the devnet predeploys 10 funded OpenZeppelin accounts and the Universal Deployer at the
standard address. Account #1 — used by `dojo_madara.toml` — is
`0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d` (key
`0x077e56c6dc32d40a67f6f7e6625c8dc5e570abe49c0a24e9202e4ae906abcc07`). `docker logs madara-lab | grep -A20 PREDEPLOYED`
prints all ten. These keys are public devnet material; they exist only on this chain.

State lives in the `madara-data` volume. `docker compose down -v` wipes the chain; `down` without `-v` keeps it, and
Madara reopens the same database on the next `up` (migrations are automatic and checkpointed).

## Deploy the game world

```bash
deploy/madara-lab/scripts/deploy-world.sh              # sozo build (~40 s) + migrate (measured 22 m 40 s)
deploy/madara-lab/scripts/deploy-world.sh --migrate-only
cat deploy/madara-lab/.lab/world-address
```

The script writes `contracts/game/manifest_madara.json` (gitignored, like the spike manifest), records the world
address under `.lab/`, and renders `.lab/torii.toml` for the canary.

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

## Torii compatibility canary

Torii is end-of-life and not a destination dependency. It runs here only so the current client stays playable on the
lab chain while the owned data plane is built. Stock `ghcr.io/dojoengine/torii:v1.8.16`, single world, no patches.

```bash
docker compose --profile torii up -d          # after deploy-world.sh; reads .lab/torii.toml
curl -s 'http://127.0.0.1:8090/sql?query=SELECT%20count(*)%20FROM%20entities'
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
deploy/madara-lab/scripts/block-stats.sh 10m      # last 10 minutes
```

It reports blocks, executed/reverted/rejected transactions, classes declared, L2 gas, transactions per busy block,
and p50/p95/max of `block_production_ms`, `close_block_total_ms`, `merklization_ms`, `db_write_ms`. Capture it before
and after every harness run and attach the output to the run manifest (`.lab/runs/`, see the brief, item C3).

Cairo Native is off by default. To measure it:

```bash
MADARA_NATIVE=true docker compose up -d --wait madara
```

Compilation is asynchronous with a VM fallback (`--native-compilation-mode=async`); native artifacts are cached under
the data volume (`native_classes/`) and survive restarts. Warm every game class once (a full harness run) before
reading numbers, and compare against a VM run on the same block-stats window.

## Pinning

| Component | Pin                                                              | Why                                                        |
| --------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Madara    | `ghcr.io/madara-alliance/madara:v0.11.0-alpha.9` (amd64 digest `sha256:98e02d4b6557a6048e9540929714f8731ba0ec429add2ac29ddd020d5ff24b9f`) | `latest` is a different, newer build (`sha256:6dc3ae0a…`); results are not comparable across images |
| Chain config | `chain-config.yaml`, copied in full from the alpha.9 `devnet` preset with only `chain_name`, `chain_id`, `block_time`, `pending_block_update_time` changed | Madara rejects partial configs; a silent default would be a silent variable in every measurement |
| Torii     | `ghcr.io/dojoengine/torii:v1.8.16`                               | last known-good with this client                            |
| sozo      | 1.8.7                                                            | speaks RPC 0.9/0.10, has the blake2s flag                   |

Bump `MADARA_TAG` in a `.env` next to the compose file to test another build, and record the digest here.

## What Madara does not give you (as of alpha.9)

- **No WebSocket subscriptions.** Every `starknet_subscribe*` method returns `UnimplementedMethod`. The client's
  live path stays on Torii (canary) until the owned stream exists; do not plan on subscribing to Madara directly.
- **No `dev_predeployedAccounts`.** The client's local-account connector depends on that Katana RPC. Accounts on the
  lab come from the deterministic genesis list (brief item C2).
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
  docker-compose.yml       madara (+ torii canary profile), pinned image, localhost ports
  chain-config.yaml        full chain config (see Pinning)
  torii.toml.template      rendered to .lab/torii.toml by deploy-world.sh
  scripts/deploy-world.sh  sozo build + migrate with the Madara-specific flags
  scripts/block-stats.sh   aggregates Madara's per-block JSON log
  scripts/block-stats.py   the aggregation
  .lab/                    generated: world-address, torii.toml, runs/ (gitignored)
contracts/game/dojo_madara.toml   sozo profile for this chain
contracts/game/Scarb.toml         [profile.madara]
```
