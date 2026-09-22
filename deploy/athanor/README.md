# ATHANOR

ATHANOR is the infrastructure that runs Realms game worlds: the Madara sequencer with embedded recorded randomness,
Herald, the launch service, identity, host bootstrap, local TLS, deployment and the gameplay harness. Native game
contracts live in `contracts/l3/world-native`; the game clients consume Herald's snapshots and ordered diffs through the
shared native fact store. Madara is the upstream sequencer inside this stack.

The future shard model assigns each world to one isolated node and Herald, with shared identity and directory routing.
Shard placement, fan-in, ledger integration and proving are deferred. The current cutover validates one shard before
selecting its supported capacity.

## Live holdovers

Until the native cutover's fresh genesis, the running live stack retains its `madara-lab` compose project and container
names, the `WP_REALMS_MADARA_LAB` chain ID and its existing tunnel hostnames. Source-directory changes do not rename,
restart or switch that stack. Candidate projects use `athanor-<shard>` with disjoint ports and volumes. Set
`COMPOSE_PROJECT_NAME` when starting a shard, and `MADARA_CONTAINER` when measuring a separately named running node. The
three live holdovers are removed only at the approved traffic switch.

Use a separate checkout, compose project, ports, volumes and Herald database for a candidate. Keep the live project and
owner playtest running. Announce any replacement of the candidate being playtested. Passing a small smoke does not
authorize a traffic switch or a merge into `next`.

## Build tools

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm run build:packages
bash deploy/athanor/scripts/install-native-tools.sh "$HOME/.local/share/eternum-native-tools"
source "$HOME/.local/share/eternum-native-tools/env"
(cd contracts/l3/world-native && scarb build && scarb test)
python3 scripts/generate-realm-metadata.py --check
bun contracts/l3/world-native/scripts/generate-schema.mjs --check
```

The native workspace version file is authoritative. `scarb test` uses Foundry's built-in partitions and concurrency
limit; filtered `snforge test` remains available for individual rules. Test success alone does not establish native
execution: declare and execute the generated classes on the selected node image as well.

## Isolated node and release

Build a selected fork revision through the upstream Dockerfile and existing build cache:

```bash
python3 deploy/athanor/randomness/release/build.py /path/to/madara REVISION BUILDX_BUILDER OUTPUT_DIRECTORY
```

Use that node digest and a Herald release digest with `scripts/shard.py CONFIGURATION RUN_DIRECTORY`. The configuration
names `shard`, `port_base` (three free loopback ports above 27999), `cpuset`, `node_memory_mib`, `madara_image`,
`herald_image`, `chain_config` and `node_flags`. Both images must be pinned by digest. Flags explicitly select native
execution and compilation mode. The runner refuses existing project state and CPUs outside `athanor.slice`.

Supply `DEPLOYER_ACCOUNT_ADDRESS` and `DEPLOYER_PRIVATE_KEY` from the isolated devnet. The runner creates private
credentials and volumes, deploys identity, binds a gameplay operator and deploys the native world under it, registers
the Frontier and Regular Blitz presets and starts Herald. Each shard exports upstream node metrics through its own
pinned OTLP collector into its private run directory; `harness.env` points the existing block reporter at that output.
The run directory holds its compose configuration, manifest, logs and private `harness.env`. It starts no live services.
Failed runs retain their volumes for inspection; choose a fresh shard id for a new run.

For ordered trials, use `scripts/shard.py --matrix MATRIX_JSON RUN_DIRECTORY`. The matrix contains `configurations` (an
ordered list of shard configurations), `workload` (`games`, `accounts_per_game`, `minutes`, `interval_seconds`,
`setup_concurrency`, `workload`) and `live` (`container`, `chain_config`). The guard and matrix both read
`deploy/athanor/live-budget.json`; the live container and chain configuration are read only for host snapshots. The
guard must be running before deployment. Each trial stores its configuration, deployment, workload reports and start/end
host snapshots under the run directory. A failed workload or exceeded live budget aborts the matrix. Each completed or
failed candidate is stopped with its volumes retained; the next configuration starts fresh.

The checked-in live budget replaces the box-only budget file. Its 2026-09-22 baseline used 130 confirmed-diff windows
from 13:20–15:30 UTC while the candidate was frozen: window p95 ranged from 225 to 237 ms. The 300 ms confirmed budget
gives that maximum roughly 25% headroom. The preceding 24 hours contained 64 non-empty preconfirmed windows (1,728
observations), with window p95 from 2 to 41 ms; their budget is 60 ms. Twelve live-health samples had zero lag and
responses from 2.3 to 13.8 ms; the health budget is 50 ms and lag allowance remains three blocks. Disk reserves remain
10 GiB for the candidate and 100 GiB for the host. Raw measurements stay with the run artifacts.

The same condition must exceed its budget in two consecutive observed windows before the guard freezes the candidate or
the matrix aborts. A healthy observation resets that condition. Digest streams are counted independently; empty polls
and zero-count digests neither advance nor reset their streaks. Monitoring errors also require two consecutive failed
polls. The guard logs the pause timestamp; after investigating, restart the guard and thaw only `athanor.slice`.

The node initially waits for its game deployment while declarations remain available. After deployment, the runner
recreates only that new shard's node with its sequencing account and world address. The node persists its epoch secret
in its own data volume. Pending assignments are volatile across restart; recorded nonces prevent duplicate gameplay
effects. Keep WAL and fsync enabled for comparable runs. Never request fsync with WAL disabled.

`docker-compose.yml` preserves the earlier infrastructure profiles and their pinned baseline image. That image is not
the native candidate. Do not start that profile over an existing stack or treat its pin as acceptance of the current
fork. Reserve disjoint ports and resource limits before starting a candidate. Caddy's local TLS routes require the host
entries and certificates produced by `scripts/issue-certs.sh`; keep private files under `.lab/`.

## Native deployment

Load credentials from a private, gitignored environment file under `.lab/`. The current deployment commands require
`RPC_URL`, `DEPLOYER_ACCOUNT_ADDRESS`, `DEPLOYER_PRIVATE_KEY`, `BINDING_AUTHORITY_ADDRESS`, `RANDOMNESS_PRIVATE_KEY`,
`NATIVE_AUTHORITY_FILE`, `GAMEPLAY_CONTRACTS_PATH`, `BINDING_AUTHORITY_PRIVATE_KEY` and `NATIVE_WORLD_MANIFEST`. The
sequencing authority output contains its signing credential; keep it private. `NATIVE_WORLD_MANIFEST` must point to the
isolated world's output, not another stack's manifest.

On the already prepared isolated chain:

```bash
bun deploy/athanor/scripts/deploy-gameplay-contracts.ts
bun deploy/athanor/harness/native/prepare-authority.ts "$NATIVE_WORLD_SEED"
bun config/deployer/clean/cli/deploy-world.ts \
  --seed "$NATIVE_WORLD_SEED" \
  --identity "$GAMEPLAY_CONTRACTS_PATH" \
  --submitter "$SEQUENCING_SUBMITTER_ADDRESS"
bun deploy/athanor/harness/native/prepare-authority.ts "$NATIVE_WORLD_SEED" "$NATIVE_WORLD_MANIFEST"
export DEPLOYER_ACCOUNT_ADDRESS="$(jq -er .operatorAccountAddress "$GAMEPLAY_CONTRACTS_PATH")"
bun config/deployer/clean/registrar/register-preset.ts \
  --environment madara.blitz --preset-id 2
```

The deployer declares classes through `DEPLOYER_ACCOUNT_ADDRESS` and administers the world through identity's bound
`operatorAccountAddress`, which uses the same signing key. Keep the original deployer account for sequencing authority
preparation, funding and repeat world deployments; switch to the operator for preset registration and launch commands.
Set `SEQUENCING_SUBMITTER_ADDRESS` to the address produced by authority preparation. Repeat deployment with the same
seed, identity, submitter and manifest to check that an unchanged world submits zero transactions. Add `--inspect` to
check class hashes, configuration and activation without mutation. Inspection does not prove storage compatibility; a
populated upgrade needs its own read/mutate check. The event-codec cutover requires a fresh native deployment.

Player identity deployment writes the explicit `GAMEPLAY_CONTRACTS_PATH`. No deployment output or private credential
belongs in a tracked configuration file. The launch service and administrative commands use `ADMISSION_URL` for recorded
execution; the client uses `VITE_PUBLIC_ADMISSION_URL` for that same node.

## Herald and client

Create a separate PostgreSQL database and configure `HERALD_CHAIN=madara`, `HERALD_RPC_URL`, `DATABASE_URL` and
`NATIVE_WORLD_MANIFEST`. Start Herald with `pnpm --dir apps/herald start`, or package its real workspace graph with
`deploy/athanor/randomness/release/build-herald.py`. The candidate service must use that same manifest and chain.

Wait for `/health` and the confirmed snapshot before connecting the client. Set its native manifest, admission and
Herald URLs to the isolated endpoints, then run `pnpm --dir apps/game dev`. Use the client HTTPS configuration when
signing through a browser wallet. Current facts come through Herald, never a second direct state fetch.

The directory is served at `/madara/games`. Compatible class upgrades do not require a Herald restart. Incompatible
schemas are explicit ingestion faults and require a planned release. Historical replay must use the matching codec.

## Gameplay validation

The harness uses the shared client, native fact store, recorded admission and node transaction subscriptions:

```bash
bun deploy/athanor/harness/run.ts \
  --bots 6 --minutes 2.5 --interval-seconds 15 --setup-concurrency 6 --workload build-order
```

Every bot follows build-order suggestions, updates automation each minute and explores. The full acceptance workload
uses 96 players and the frozen run configuration. Do not substitute a short smoke for it. Keep failed runs labeled
failed. Run reports remain in `.lab/runs/`; measurements and exact revision/image/configuration pins go in the PR.

For a node with OTLP export, set `MADARA_METRICS_FILE` to the collector's JSON-lines output. The existing
`scripts/block-stats.py` combines close-block data with upstream counter deltas, excluding process resets. Report
latency separately from gas and execution resources. Admission-to-visible includes queue wait and the Herald barrier.

The server deployment workflow fails closed without native target configuration. Do not use it to update the live stack
during integration. Preserve the baseline image and chain data until final acceptance and the approved cutover.
