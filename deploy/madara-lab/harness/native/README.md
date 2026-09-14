# Native slice on the local lab

These commands exercise the pinned Dojo rules and the native contracts through `@bibliothecadao/eternum/game-client`.
Composition is imported from the main package entry; the light `game-client` subpath remains free of the composition
import cycle. Both clients consume Herald snapshots and diffs into RECS. The runners read transaction receipts for
measurements, not gameplay state.

The local Madara endpoint is `http://127.0.0.1:5050/rpc/v0_10_2`. Keep the lab image unchanged and run the two workloads
sequentially so execution batches can be attributed to individual actions. Do not run builds or other transaction
workloads during measurement.

## Inputs

Under the ignored `deploy/madara-lab/.lab/` directory:

- `native-sequencer.json`: public local sequencing-account fixture created by `lab:slice:prepare-authority`.
- `native-world-manifest.json`: output of `deploy-world.ts --profile native --manifest`.
- `gameplay-contracts.json`: the existing PlayerRegistry, gameplay account class and binding authority deployment.
- `native-history-accounts.private.json`: two already registered gameplay accounts, each with `address` and
  `privateKey`. Keep this file private; the runner uses their existing keys.

The native manifest must have an active schema matching `contracts/l3/world-native/schema/bindings.json`. Generate that
artifact with `bun contracts/l3/world-native/scripts/generate-schema.mjs` after `scarb build` in the native package.
Start Herald on port 3004 with `HERALD_MANIFEST_PATH` pointing to the native manifest and a separate database. Keep the
baseline Herald on port 3003 with its Dojo manifest.

The native profile requires `--submitter` with the dedicated sequencing account address. Prepare that account before
deploying, then bind it to the deployed season domain:

```bash
pnpm run lab:slice:prepare-authority native_foundation_20260914
# Deploy with --profile native --submitter ADDRESS and the ignored manifest path.
pnpm run lab:slice:prepare-authority native_foundation_20260914 deploy/madara-lab/.lab/native-world-manifest.json
```

The fixture signs version-3 transactions through the published sequencing account. Player signatures and raw roots travel
through the single recorded `execute` entrypoint; there is no public root-only execution path. The fixture credential is
public and belongs only on the local lab.

## Runs

From the repository root, with the local Dojo manifest selected:

```bash
export GAME_MANIFEST_PATH=/absolute/path/to/the/ignored/dojo/manifest.json
pnpm run lab:parity:native
pnpm run lab:slice:prepare-dojo
pnpm run lab:slice:dojo
pnpm run lab:slice:native 1
pnpm run lab:slice:report deploy/madara-lab/.lab/dojo-slice-1.json deploy/madara-lab/.lab/native-slice-1.json
```

Use the game id printed by Dojo preparation in the report filename, and a new unused native game id on every run.
Preparation installs a dev-only fixture contract into the local Dojo world, registers immutable preset 1 and provisions
two realms, a producer and an Ethereal entry spire. It does not edit the tracked release manifest. Both oracle commands
restore the same ignored source workspace; do not run them concurrently.

The native runner provisions the same starting conditions, then both workloads create explorers, resolve a battle and
assert deletion, recreate the defeated explorer, enter Ethereal, discover guarded mines on both layers, claim production
and reconnect. Normal stamina regeneration is retained. Prepared raw roots select useful inputs to the original
discovery pools; no pool weights are replaced. This is not a randomness assignment or adversarial randomness test.

`fixtures/world-parity.json` compares every touched row in controlled paired-world tests. `fixtures/harness.json`
records the live workload and matched transaction measurements. The latter is eight actions, not a load-capacity or
latency-SLO test. Dojo random actions include the fixture call that injects a root; native transactions include
authenticated intent dispatch. Exploration measures `explorer_move` with exploration enabled; the separate
reward-extraction action is outside this slice.

Run `bun test deploy/madara-lab/harness` for harness tests. Reports retain failure details when an action, Herald
barrier or reconnect fails; a partial run is not passing evidence.

## Evidence provenance and replay

Run measurements from a clean worktree. Each run records its revision and a digest of tracked source, configuration and
schema inputs. Output reports are excluded from that digest so committing evidence does not change the measured source
identity. The comparison command rejects dirty runs and mismatched source digests.

```bash
pnpm run lab:replay:native "$GAME_MANIFEST_PATH" 494458 deploy/madara-lab/.lab/native-history-manifest.json 495357
```

Use the deployment's actual immutable block ranges when reproducing on a new lab. This command archives the pinned
reference Herald sources, replays the same Dojo history with both implementations and compares the checkpoint hashes. It
also rebuilds the native history, crosses a checkpoint reconnect and compares non-empty directory and leaderboard rows
against receipt-driven delivery. It writes `fixtures/herald-replay.json`.

Native pre-confirmed decoding rejection is counted and logged; the next valid receipt can still publish. Confirmed
rejection halts that deployment at its last valid checkpoint and makes `/health` return 503 with the rejected block and
transaction. The process and subscription remain available. Correct the release/schema metadata and restart to replay
the blocked range; the fold never silently skips the receipt.
