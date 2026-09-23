# ATHANOR

A shard hosts games on one sequencer, one installation of the native game contracts and one Herald. Madara is the
sequencer and the admission gateway orders signed actions beside it; Herald serves the shard manifest, game directory, snapshots and ordered diffs. Game contracts live in
`contracts/l3/world-native`, and clients consume Herald through the shared native fact store.

ATHANOR contains the isolated box deployment and gameplay harness. `scripts/shard.py` initializes a fresh shard from
pinned images, an explicit chain identity and the published guardian identity, then starts its compose project. See
"Isolated node and release" below for the inputs. The staging candidate also runs a static client and temporary launch
service beside the shards; identity and the other central services use the staging Workers. The public compose package
follows in E3, and launch moves to its Worker in K7 before the release deployment.

## Live holdovers

Until the native cutover's fresh genesis, the running live stack retains its `madara-lab` compose project and container
names, chain ID and tunnel hostnames. Source-directory changes do not rename, restart or switch that stack. Candidate projects use `athanor-<shard>` with disjoint ports and volumes. Set
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

A shard runs the upstream Madara image unmodified. The current pin is
`ghcr.io/madara-alliance/madara@sha256:efaa800354602ad89fa2f22492e55188f50b0fc5675f66cba8184f0e261394f5`
(`nightly-802086d`, the revision C3 measured). Admission runs beside it in the gateway, built from the same checkout:

```bash
docker build -t realms-gateway:REVISION apps/gateway
```

Use the node, gateway and Herald release digests with `scripts/shard.py CONFIGURATION RUN_DIRECTORY`. The configuration
names `shard`, `chain_id`, `port_base` (four free loopback ports above 27999), `cpuset`, `node_memory_mib`,
`player_capacity`, `madara_image`, `gateway_image`, `herald_image`, `chain_config`, `node_flags`, `guardian_url`,
`public_rpc_url` and `public_admission_url`. Choose a unique `chain_id` of 1–31 ASCII letters,
digits, underscores or hyphens, beginning with a letter. The runner writes its hex encoding to `native-world.json` at `shard.chainId`
before deployment and renders the node configuration with the same identity. The checked-in chain configuration is a
template; initialize it through the runner before starting a node. For the baseline compose profiles, set
`CHAIN_CONFIG_PATH` to that rendered file; compose refuses to start without it. Deployment, preset and harness commands check their
RPC against the manifest before submitting. Every image must be pinned by digest. Flags explicitly select native
execution and compilation mode. The runner refuses existing project state and CPUs outside `athanor.slice`.

Supply `DEPLOYER_ACCOUNT_ADDRESS` and `DEPLOYER_PRIVATE_KEY` from the isolated devnet. The runner creates private
credentials and volumes, deploys the Realms account class (refusing one that differs from the class the identity service approves devices
for) and the operator's own Realms account, deploys the native world under it, registers
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

The runner starts the gateway after deployment with the new world's sequencing account and address. The gateway
persists its epoch secret in its own volume. Pending assignments are volatile across restart; recorded nonces prevent
duplicate gameplay effects. The node always runs with WAL and fsync enabled; never request fsync with WAL disabled
(upstream issue #1257).

`docker-compose.yml` preserves the earlier infrastructure profiles and their pinned baseline image. That image is not
the native candidate. Do not start that profile over an existing stack or treat its pin as acceptance of a shard's
node. Reserve disjoint ports and resource limits before starting a candidate. Caddy's local TLS routes require the host
entries and certificates produced by `scripts/issue-certs.sh`; keep private files under `.lab/`.

### Staging candidate

Initialize both browser-gate shards with `guardian_url=https://staging.realms.party/api/guardian`. Initialization fetches
the guardian's public key and account class hash and records them in `shard.guardianPublicKey` and
`shard.accountClassHash`. An unavailable endpoint or invalid identity stops initialization; candidate and release
configurations never supply substitute values. The deployer declares `RealmsAccount` only when its locally built class
matches that published hash, and the game's authentication and Herald use the same manifest class. Build the account
with the repository root's declared toolchain before starting the shard runner; build the game with its workspace's
toolchain.

Run the pinned upstream node image with the gateway, as above. Set each shard's public RPC and admission URLs to
its staging tunnel hostnames, not its loopback deployment endpoints; the admission hostname routes to the gateway. Herald has a 6 GiB memory limit:
the 96-player run was OOM-killed at 2 GiB; stream D will size it from C3's measured peak. Herald restarts on failure so a
node restart does not leave it down. The app uses `staging.realms.party`, whose `/api/*` routes remain on K's staging
Worker. The temporary launch service uses that identity origin and an explicit address allowlist; never `*`.
`candidate-services.yml` replaces the old candidate's Vite dev server and launch host unit with a static client and
an allowlisted launch container. Build the app with
`VITE_PUBLIC_LAUNCH_SERVICE_URL=https://staging.realms.party/launch`; the static server strips `/launch` before proxying
to the service, so the browser sends its existing identity cookie. The owner-approved staging launcher is
`0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d` only. Further launchers require the owner's word.
The private launch environment supplies its separate database URL, operator credentials and season start; its shard
network, checkout, manifest directory, user IDs and runtime image digests are explicit compose inputs.

Use a separate staging tunnel connector, disjoint ports and fresh volumes for both shards. Hold the shared
`/opt/athanor/isolated-stack.lock` during deployment and verification. Verify the app, launch service and both public
manifests before handing the candidate to the other streams. Leave the live stack and its tunnel connector running.

## Native deployment

Load credentials from a private, gitignored environment file under `.lab/`. The current deployment commands require
`RPC_URL`, `DEPLOYER_ACCOUNT_ADDRESS`, `DEPLOYER_PRIVATE_KEY`, `BINDING_AUTHORITY_ADDRESS`, `RANDOMNESS_PRIVATE_KEY`,
`NATIVE_AUTHORITY_FILE`, `GAMEPLAY_CONTRACTS_PATH` and `NATIVE_WORLD_MANIFEST`. The
sequencing authority output contains its signing credential; keep it private. `NATIVE_WORLD_MANIFEST` must point to the
isolated shard's output. For manual initialization, write the nested shard record with the unique ASCII chain ID's hex
encoding and the `guardianPublicKey` and `accountClassHash` returned by the identity service. The deployer asserts the
node reports this identity, then preserves it in `shard.chainId` alongside
`shard.accountClassHash` and `shard.contracts`. Only fresh shards are supported: manifests without
`shard.chainId`, including the earlier top-level `chainId` shape, must be replaced by a fresh initialization with new
node state. E1 provides no migration of an existing chain.

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
execution; the client reads the gateway's public admission URL from Herald's `/manifest`.

## Herald and client

Create a separate PostgreSQL database and configure `HERALD_RPC_URL`, `HERALD_PUBLIC_RPC_URL`,
`HERALD_PUBLIC_ADMISSION_URL`, `DATABASE_URL` and `NATIVE_WORLD_MANIFEST`. Start Herald with `pnpm --dir apps/herald start`, or package its real workspace graph with
`deploy/athanor/release/build-herald.py`. The candidate service must use that same manifest and chain.

Wait for `/health` and the confirmed snapshot before connecting the client. Run `pnpm --dir apps/game dev`; the app
reads our directory (`/api/directory`, proxied to staging in development) and lists every shard on it, and a shard the
directory does not list is opened by pasting its Herald URL into the games list. Use the client HTTPS configuration when
signing through a browser wallet. Current facts come through Herald, never a second direct state fetch.

The shard manifest is served at `/manifest` and the directory at `/games`. Compatible class upgrades do not require a Herald restart. Incompatible
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

A roster run drives every player as a worker thread of one process and asserts its gates once, over the whole run, in
`rosters-<time>/summary.json`: the action threshold (3,500 for the frozen 96-player configuration, otherwise every
planned action) and the owner's bars: submit to pre-confirmed visible in the client p95 ≤ 250 ms
(`admissionToVisibleMs`), Herald's confirmed state behind the node p95 ≤ 500 ms (`heraldConfirmedLagMs`: Herald's
confirmed notice for the transaction minus the node's ACCEPTED_ON_L2 for it, both on the driver's clock), and zero
failures. Pre-confirmed, accepted-on-L2 and block close latencies are reported beside them as diagnostics. Host state
and block stats are read once by the driver, never per worker, and a block-stats read that fails or finds no closed
block fails the run. The summary records the driver's placement (host, pid, cpuset, cgroup, available threads) and, per game, the
number of transactions its settlement burst took at start. Worker reports under `players/` carry no gates of their own.

The capacity campaign's shapes are run configurations of the same harness. `--preset <id>` names the preset new games
are created from (default: the game type's). The slot shape's start burst is `--bots 96 --workload burst`: four games of
24, every bot releasing its whole plan at the same instant and its next action as soon as the previous one lands; the
summary's `releaseSpreadMs` shows how tight the release was. The Frontier shape is `--game-type frontier` without
`--functional`: production-length days, every player settling then mustering and exploring in the first minutes, with
the latency and close-cost gates. `--game-type frontier --functional` is FR11's design run instead: the season is
created with twelve-minute days so the bots play through rollovers, and the design gates (token cap, fresh armies
after at least three rollovers) apply while the latency gates do not.

For a node with OTLP export, set `MADARA_METRICS_FILE` to the collector's JSON-lines output. The existing
`scripts/block-stats.py` combines close-block data with upstream counter deltas, excluding process resets. Report
latency separately from gas and execution resources. Admission-to-visible includes queue wait and the Herald barrier.

The server deployment workflow fails closed without native target configuration. Do not use it to update the live stack
during integration. Preserve the baseline image and chain data until final acceptance and the approved cutover.
