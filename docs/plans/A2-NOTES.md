# A2 implementation notes

Validated locally on 2026-08-09 against the existing `deploy/appchain/spike` Katana/Torii stack.

## Decisions

- Appchain Blitz resolves the persistent world and registrar system from the migrated manifest. The tracked
  `manifest_appchain.json` is the default; `APPCHAIN_MANIFEST_PATH` selects the ignored spike manifest for local
  verification.
- The existing `version` launch input is the registrar preset id and defaults to preset 1.
- Standalone and series games share the same `create_game` payload builder. Series registration is one `register_series`
  transaction; rotation scheduling remains above the series runner.
- Appchain launch records contain only `create-world` and `wait-for-factory-index`. The latter keeps its stable id but
  waits for `s2_blitz-GameRegistry` instead of a factory-deployed world.
- `fee_token` remains chain-scoped in `ChainConfig`, so a per-game `fee_token` launch override is rejected. Per-game
  `fee_amount` and `registration_count_max` overrides remain supported.
- Mainnet factory execution remains on the existing runner and workflow branches. The appchain collapse is selected by
  the existing deployment environment check; focused tests continue to exercise the mainnet create/config/indexer
  behavior.

## Preset dry run

`bun config/deployer/clean/registrar/register-preset.ts --preset-id 1 --dry-run` produced a stable 2,037-felt payload:

| Side table                  | Rows |
| --------------------------- | ---: |
| weights                     |   39 |
| resource factories          |   39 |
| building categories         |   39 |
| structure levels            |    3 |
| hyperstructure construction |    0 |
| resource lists              |  203 |
| resource min/max lists      |    3 |

The same payload registered successfully in one local transaction, so no registrar calldata gap was found.

## Local spike evidence

- Migrated one `s2_blitz` world at `0x041bbb8900b623206178b90739e1b645fe5c6a1bc83a242c528296ee0cd10a46`: 108 resources
  registered, 25 writer permissions synced, and 25 systems initialized.
- The one-time D3 script wired both shared collectible roles, initialized `ChainConfig`, and registered preset 1. A
  second run skipped the initialized chain config and preset with clear messages.
- Ran `launch-step.ts --step create-world` for `a2-spike-1786276064`: game id 1, transaction
  `0x354b3dc41d1b77ee274770a76b89f6165f1c1b0f76e6c32f688c9b740ff318`, 12.88 seconds wall clock.
- Ran `launch-step.ts --step wait-for-factory-index`: indexed in 3 ms, 1.64 seconds command wall clock.
- Total per-game create plus wait: **14.52 seconds**. Torii SQL reported the resulting `GameRegistry` row with status
  `Registration`.

The spike used Sozo 1.8.7 because the existing local Katana exposes Starknet RPC 0.10. The appchain build and migration
completed with the existing oversized-CASM warnings for `troop_battle_systems` and `troop_management_systems`.

## Round 2 verification

- The real `launch-step.ts` CLI path, with no `--version`, resolved preset 1 and created `a2-r2-1786283496` as game id 2
  in 14.488 seconds. Transaction: `0x23b93dfbf90c8cec5f8be54c1a255749310660f2e4661a9be39a30f94be96ba`.
- The matching CLI wait step resolved preset 1, found the `GameRegistry` row in 3 ms, and completed in 0.914 seconds.
  Total per-game wall clock was **15.402 seconds**. Torii reported preset 1, status `Registration`, and the explicit
  86,400-second end grace.
- Appchain CLI defaults are preset 1, a 2-second GameRegistry poll, and a 2-minute timeout. Mainnet retains factory
  version 140 and its 5-second/5-minute poll budget.
- Duplicate protection queries the encoded name directly and fails closed when Torii is unavailable. The deployment
  script validates the full `s2_blitz` registrar API before any transaction; the tracked stale manifest fails even in
  dry-run mode.
- Full preset and `CreateGameParams` felt arrays are pinned as golden snapshots. Touched tests are run per-file because
  whole-directory Bun runs have pre-existing `mock.module("starknet")` leakage between files.

## Accepted limitations and follow-ups

- A series freezes `num_games` when it is first registered. Its games must continue to be created by the registered
  series owner, so rotating the deployer key mid-series prevents later appends.
- Game seeds are deterministic Poseidon hashes of public launch inputs. This is acceptable because combat randomness
  remains VRF-backed.
- `appchain.eternum` launches intentionally reject; A2 supports the persistent `appchain.blitz` world only.
- Every appchain game shares one `worldAddress`. A4 must use `artifacts.gameId` to identify the game within that world.
