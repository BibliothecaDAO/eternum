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

## Dev appchain deployment (reviewer, 2026-08-09)

- `s2_blitz` world migrated to the AWS dev appchain at
  `0x15ab45aea9188b0c4a8de1dc00fd23e71082aef2cb6384451d37ce0771b661a` (sozo 1.8.7 — the chain serves Starknet RPC 0.10;
  the tracked `manifest_appchain.json` is now the migrated s2 manifest).
- The dev chain has NO deployed collectibles, entry token, or VRF provider (all zero in the legacy s1 configs —
  playtests run fee-free). `ChainConfig` was therefore bootstrapped with zero entry-token/collectible/VRF addresses via
  a one-off runner that skips `wireSharedCollectibles` (nothing to wire). `deploy-s2-world.ts` remains the path for
  production chains with real peripherals. Bootstrap tx
  `0x7bf6746da3263b86ca4cb7d2838980f971e42e57c54b3b636c6638011964185`; preset 1 tx
  `0x74b895527662620798ed25d54baaf2c001a42f3d6a6952597781060ca9103eb`.
- Torii (`/realms-appchain/dev/torii-config` v10): s2 world pinned in `contracts`, `s2_blitz` added to `namespaces`; ECS
  service `torii` rolled. The s1 client is unaffected (different namespace tables).
- Lambda `DEFAULT_WORKFLOW_REF` intentionally NOT flipped: the client cannot display s2 games until A4. End-to-end
  pipeline validation runs via manual `workflow_dispatch` on `feat/single-world-blitz`.
- End-to-end validation on real infrastructure (workflow_dispatch run 31317884959, environment `appchain.blitz`, non-dev
  game): `s2smoke1` created as game_id 1, tx `0x692ac20f53806465c50cd8…`, torii row `Registration`/preset 1/end_grace
  86400; run record on `factory-runs` shows exactly `create-world` (23.8 s) + `wait-for-factory-index` (5.2 s),
  artifacts carry `gameId`. **Per-game launch: 29.0 s — A2 exit criterion met** (was ~10 min on the factory flow).
- Preset registry on the dev chain (2026-08-09, owner-requested): **preset 1** = base config, 2 h legacy dev shape
  (registered at bootstrap); **preset 2** = official-60 balance — "Regular Fast (1h)" (tx `0x282c813e9e1b…`, 2,048
  felts); **preset 3** = official-90 balance for **Duel** (tx `0x229d34c92b46…`, 2,067 felts). Duel's two-player nature
  is a LAUNCH flag (`twoPlayerMode` → registration cap 2), not preset data — preset 3 carries the 90-minute balance the
  duel is defined on. The 24-player "Regular Normal (1h:30m)" catalog entry is deliberately NOT deployed as a preset per
  owner decision; the A4 catalog maps blitz-fast → version 2 and blitz-duel → version 3.
