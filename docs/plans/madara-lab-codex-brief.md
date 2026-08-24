# Madara lab — Codex brief

Motto: **KISS, always. Evidence before optimization. Wired or deleted.**

Branch: `feat/madara-lab` (worktree `/home/djizus/projects/eternum-madara-lab`, based on `origin/next`). Everything
below lands on that branch. Do not touch `pr-4903` (procedural terrain) from this brief.

## Why this exists

Cartridge is end-of-life — Katana, Torii, Slot, Controller, paymaster and hosted VRF are all going away (public
announcement expected early September 2026) — and Katana/Torii performance is already the ceiling of what we can run.
Madara is the target sequencer. L3 settlement to Starknet is the sustainability model, so Madara's
`--settlement-layer Starknet` mode is a requirement of the destination, not an option.

The capacity target is **96 players per Blitz game** now (the contract cap is 24). 1,000 is the north star and sizes
nothing in this brief.

This brief sets up the lab on the local machine (Ryzen 7 5800H, 8c/16t, 31 GB, Fedora 44, Docker) and gets a real Blitz
game running on Madara end to end with the _current_ Dojo contracts. No indexer rewrite, no account service, no
pure-Cairo work here — this is the measurement bench the platform decisions get made on.

## What Claude already established (2026-08-24)

All of this is on the branch under `deploy/madara-lab/` and verified against the pinned image
`ghcr.io/madara-alliance/madara:v0.11.0-alpha.9` (amd64 digest `sha256:98e02d4b…`; `latest` is a different, newer build
— never use it).

| Fact                                                                                                                                                                                                              | Evidence                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Madara devnet runs in Docker with a full chain config (`chain-config.yaml`), chain id `WP_REALMS_MADARA_LAB`                                                                                                      | `docker compose up -d --wait madara` → healthy; `starknet_chainId` matches                                                                                                      |
| RPC 0.10.2 at `/`, versioned routes `/rpc/v0_9_0`, `/rpc/v0_8_1`, `/rpc/v0_10_0`                                                                                                                                  | `starknet_specVersion` on each route                                                                                                                                            |
| Pre-confirmed blocks exist and are persisted (`starknet_getBlockWithTxHashes("pre_confirmed")`)                                                                                                                   | startup log "Preconfirmed blocks will be saved to database"; RPC returns block                                                                                                  |
| **All `starknet_subscribe*` WebSocket methods are unimplemented** — the client's live path must poll or use an owned stream                                                                                       | upstream README; unchanged in alpha.9                                                                                                                                           |
| Devnet genesis is deterministic: 10 accounts, #1 = `0x055be462…225d` / key `0x077e56c6…cc07`, UDC at the standard address                                                                                         | identical across three fresh containers; `starknet_getClassHashAt(UDC)` non-zero                                                                                                |
| `sozo 1.8.7` migrates the game world **only** with `--use-blake2s-casm-class-hash`                                                                                                                                | without it: `CompiledClassHashMismatch` on the world declare (protocol 0.14.2 hashes CASM with blake2s; sozo auto-selects blake2s only for URLs containing "sepolia"/"testnet") |
| `sozo 1.8.7` is built against RPC 0.9.0 — use `http://127.0.0.1:5060/rpc/v0_9_0`                                                                                                                                  | sozo prints "node reports 0.10.x, sozo was built against 0.9.0"                                                                                                                 |
| sozo waits for full block inclusion per declare — on a 30 s block chain 160 declares take ~80 min; the lab config uses `block_time: 2s`, `pending_block_update_time: 250ms`, `--no-charge-fee`                    | observed on the default preset                                                                                                                                                  |
| The client's local-account connector calls Katana's `dev_predeployedAccounts`; Madara has no such method                                                                                                          | `@dojoengine/predeployed-connector` dist; `starknet-provider.tsx:153`                                                                                                           |
| The client discovers worlds from a static directory + committed manifest, not from Torii (`runtime/world/world-directory.ts:31-58`) and only knows chains `sepolia`, `mainnet`, `local`, `appchain` (`env.ts:59`) | source                                                                                                                                                                          |
| The deployer only knows environments `mainnet.*` and `appchain.*` (`config/deployer/clean/constants.ts:85-130`)                                                                                                   | source                                                                                                                                                                          |
| Madara emits a structured `close_block_complete` JSON line per block with `txs_executed`, `l2_gas_consumed`, `block_production_ms`, `merklization_ms`, `db_write_ms` — the measurement source for this lab        | `docker logs madara-lab`                                                                                                                                                        |

Files on the branch:
`deploy/madara-lab/{docker-compose.yml, chain-config.yaml, torii.toml.template, scripts/deploy-world.sh, README.md}`,
`contracts/game/dojo_madara.toml`, `[profile.madara]` in `contracts/game/Scarb.toml`. The README is the runbook; keep it
true.

---

## Split

**Claude owns:** Madara packaging and chain config, the deploy runbook, the Torii compatibility canary, the measurement
harness (block-log extraction), the L3 settlement-mode profile, and the integration gate at the end.

**Codex owns:** the four items below. Each is independent of the others and of Claude's remaining work; all are
exercised against the running lab chain on `:5060`.

## C1. Raise the Blitz cap to 96 with bounded settlement-pool opening

`validate_registration_capacity` asserts `registration_count_max <= 24`
(`contracts/game/src/systems/registrar/contracts.cairo:330`). Raise the limit to **96** and keep it a named constant,
not a literal. The admin setter `set_blitz_registration_config` (`systems/config/contracts.cairo:920-942`) has no cap at
all — give it the same assertion so the two paths cannot disagree.

Settlement-pool opening: `target_open_settlement_count` (`systems/realm/blitz/contracts.cairo:412-433`) tiers 6 → 9 →
_remaining capacity_ once 15 players have settled, and `fill_open_settlement_pool` (`:451-466`) loops until the pool
reaches the target, one `generate_coords` + `write_model` per iteration. At 24 that jump is at most 1 iteration; at 96
it is up to **81 iterations in one transaction**. Replace the third tier with a bounded increment (e.g. keep the pool
`min(12, remaining)` ahead of demand) so no single call opens more than a fixed number of settlements. Keep the tiered
feel; the fix is the bound, not the policy.

Check the geometry: the deployer's hyperstructure reservation derives ring count from `registration_count_max`
(`config/deployer/clean/blitz/hyperstructure-reservation.ts:22-28`); at 96 that is 4 rings → 61 tiles. Confirm
`generate_coords` and the map presets produce a playable board at 96 and that the reservation batch math
(`BLITZ_HYPERSTRUCTURE_RESERVATION_BATCH_SIZE = 19`) still completes.

**Gate:** Cairo tests for the cap (24 → 96, 97 rejected) and for the bound (no `fill_open_settlement_pool` call writes
more than N positions, for every settled count from 0 to 95). `scarb fmt`. Redeploy onto the lab with
`deploy/madara-lab/scripts/deploy-world.sh` and register 96 accounts (C3's harness) without a single revert.

## C2. Client: a `madara` chain target that needs nothing from Cartridge

Add `madara` to `VITE_PUBLIC_CHAIN` (`client/apps/game/env.ts:59`) and an `.env.madara.blitz.sample` with
`VITE_PUBLIC_NODE_URL=http://127.0.0.1:5060`, `VITE_PUBLIC_TORII=http://127.0.0.1:8090`,
`VITE_PUBLIC_VRF_PROVIDER_ADDRESS=0x0` (the contracts fall back to tx-hash randomness when the provider is zero and the
chain is not mainnet/sepolia — `contracts/game/src/utils/random.cairo:15-18`; that is correct for the lab), and no
`cartridge.gg` URL anywhere.

Then make the client actually run on it:

- **Accounts.** `usePredeployedAccounts` (`hooks/context/starknet-provider.tsx:153`) calls `dev_predeployedAccounts`,
  which Madara does not serve. Add a connector that takes a static account list from env
  (`VITE_PUBLIC_MADARA_ACCOUNTS="addr:key,addr:key"` — the devnet's deterministic accounts), used for `madara` the way
  the predeployed connector is used for `local`. Plain OZ accounts, no Controller, no paymaster, no session policies.
- **World directory.** `runtime/world/world-directory.ts:31-58` only builds appchain worlds from the committed appchain
  manifest. Add the `madara` entry reading `contracts/game/manifest_madara.json` (generated by the deploy script;
  gitignore it like the spike manifest) with the lab RPC and Torii URLs.
- **Torii URL.** `runtime/world/world-torii.ts:14-19` falls back to `api.cartridge.gg` for anything that is not
  `appchain`. Make the fallback loud (throw in dev) and route `madara` to `VITE_PUBLIC_TORII`. Same for
  `runtime/world/factory-endpoints.ts:7` and the hardcoded list the audit found (`chain-rpc.ts:4`, `global-chain.ts:4`,
  `profile-builder.ts:15`, `normalize.ts:36,56`, `landing-leaderboard-service.ts:87-90`): a `madara` chain must never
  resolve a Cartridge host. Don't refactor the world; guard the chain.
- **Live path.** Torii's entity/event subscriptions still work against the Torii canary, so `GameSyncRuntime` needs no
  change for this brief. Do not add a Madara WebSocket path — there is none.

**Gate:** `pnpm dev` with `.env.madara.blitz` shows the landing page with the lab world, a devnet account can create a
Blitz game through the existing registrar UI (or the CLI in C4), register, settle and move an army; the chunk sync and
fog render from Torii data. `pnpm test` for the touched files; `pnpm run format`; `pnpm run knip`.

## C3. 96-player headless harness

There is no bot driver in the repo. `deploy/appchain/scripts/blitz-flow.ts` (retired, A2-era) is the closest thing:
reserve → register → settle → provision with a single account. Build `deploy/madara-lab/harness/` in TypeScript (bun)
that:

- Creates N plain OZ accounts on the lab chain from devnet account #1 (deploy account class already on chain: the class
  hash of account #1 is `0xe2eb8f56…a1d6`), funds are irrelevant with `--no-charge-fee`.
- Drives `register → settle → provision → one action loop` (move, explore, produce — reuse the call builders in
  `client/apps/game/src/services/blitz/*` and `packages/provider` rather than re-encoding calldata) at a configurable
  action interval per bot (default 15 s).
- Records per action: submit time, `PRE_CONFIRMED` receipt time, `ACCEPTED_ON_L2` receipt time, Torii-indexed time (poll
  the SQL endpoint for the model row), and writes a run manifest (`.lab/runs/<timestamp>.json`) with chain id, image
  tag, git rev, bot count, interval, and the aggregate percentiles.
- Scales 10 → 20 → 50 → 96 by a flag. N=96 must finish registration + settlement in one run on the lab chain.

Do not build a general load-test framework. One file for the driver, one for the account factory, one for the report.

**Gate:** `bun deploy/madara-lab/harness/run.ts --bots 96 --minutes 10` completes with 0 reverts and produces a run
manifest; the README documents the command and where the artifacts land.

## C4. Deployer: `madara.blitz` environment and chain bootstrap

`deploy/appchain/scripts/deploy-s2-world.ts` initializes `ChainConfig`, grants roles, and registers the default preset
through the registrar — the lab world needs the same before a game can be created. Add a `madara.blitz` environment to
`DEPLOYMENT_ENVIRONMENTS` (`config/deployer/clean/constants.ts:85-130`): chain `madara`, namespace `s2`, manifest
`contracts/game/manifest_madara.json`, registrar address read from the manifest (never hardcoded), config path reusing
`config/generated/blitz.appchain.json` unless a value must differ (fee token = the devnet STRK at `0x04718f5a…938d`, VRF
= 0x0). Make `deploy-s2-world.ts` accept `--environment madara.blitz` and `RPC_URL`.

Entry token / loot chest: the appchain wires shared collectibles by address. For the lab, deploy the `collectibles`
contracts onto the chain in the same script (they are in the repo) or explicitly stub the grants when the addresses are
absent — but say which in the README, don't silently skip.

**Gate:** `bun deploy/appchain/scripts/deploy-s2-world.ts --environment madara.blitz` is idempotent (second run reports
"already initialized"), and `config/deployer/clean/launch-step.ts` can create a game on the lab chain that C3's harness
then joins.

## Out of scope for this brief (deliberately)

Owned indexer, owned account/auth service, standalone VRF fulfillment, pure Cairo, RECS replacement, AWS. Each of those
gets its own brief once the lab produces numbers. If you find yourself writing one of them here, stop.

## Validation

- Cairo: `scarb fmt`, `sozo test` for touched systems.
- TypeScript: focused tests, `pnpm run format`, `pnpm run knip`.
- Live: the four gates above, on the running lab chain, with the run manifest from C3 attached to the PR.
- Every command you ran that a reviewer needs to reproduce goes into `deploy/madara-lab/README.md` — the README is the
  deploy documentation for this branch and must be runnable top to bottom on a clean machine with Docker, asdf-managed
  `sozo 1.8.7`, and `bun`.
