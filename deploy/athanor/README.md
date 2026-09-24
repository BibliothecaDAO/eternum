# ATHANOR

A shard hosts games on one sequencer, one installation of the native game contracts and one Herald. Madara is the
sequencer and the admission gateway orders signed actions beside it; Herald serves the shard manifest, game directory,
snapshots and ordered diffs. Game contracts live in `contracts/l3/world-native`, and clients consume Herald through the
shared native fact store.

ATHANOR contains the isolated box deployment and gameplay harness. `scripts/shard.py` initializes a fresh shard from
pinned images, an explicit chain identity and the published guardian identity, then starts its compose project. See
"Isolated node and release" below for the inputs. Clients are static builds on Cloudflare Pages; identity, the shard
directory, launches and the other central services are the environment's Workers. The
[public shard package](../shard/README.md) runs with Docker alone; the runner renders that same Compose file.

## Publishing the shard package

Push a reviewed `shard-v*` tag to build the init, Herald and gateway images and the downloadable Compose package. Tag
only a commit whose own validation run is green; the workflow refuses any other before building. The release job
verifies anonymous pulls before publishing its archive. For the first tag, an organization package administrator must
set `eternum-shard-init`, `eternum-shard-herald` and `eternum-shard-gateway` to public; GitHub creates new container
packages as private
([registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)).
After that one-time setting, retry the failed package job; future tags retain the package visibility. Tags publish
artifacts only and never redeploy a shard.

## Live holdovers

Until the native cutover's fresh genesis, the live stack on the production box retains its `madara-lab` compose project
and container names, chain ID and tunnel hostnames. Source-directory changes do not rename, restart or switch that
stack. Native shards run on their own box, where nothing live runs, as `athanor-<shard>` projects; set
`COMPOSE_PROJECT_NAME` when starting one. A measured harness run reads the node's image and container from the shard's
`harness.env` (`MADARA_IMAGE`, pinned by digest, and `MADARA_CONTAINER`) and stops by name without them; a functional
run reads neither. Set `MADARA_CONTAINER` by hand only when measuring a separately named running node. The three live
holdovers are removed only at the approved traffic switch.

Give each shard its own compose project, ports, volumes and Herald database. Announce any replacement of a shard being
playtested. Passing a small smoke does not authorize a traffic switch or a merge into `next`.

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

A shard runs the upstream Madara image unmodified, pinned by digest in one place: `x-madara-image` in
`deploy/shard/compose.yml` (each release's `release.json` records it as `node`). Admission runs beside it in the
gateway, built from the same checkout:

```bash
docker build -t realms-gateway:REVISION apps/gateway
```

Use the init, gateway and Herald release digests with `scripts/shard.py CONFIGURATION RUN_DIRECTORY`; the node runs the
package's pin in `deploy/shard/compose.yml`, and a configuration naming another node image is refused. The configuration
names `shard`, `chain_id`, `port_base` (free loopback ports at base through base+3 and base+5 above 27999), `cpuset`,
`node_memory_mib`, `player_capacity` (at most 2,000, campaign G's target, until a G measurement supports more),
`init_image`, `gateway_image`, `herald_image`, `chain_config`, `node_flags`, `guardian_url`, `public_rpc_url` and
`public_admission_url`. Behind a tunnel or reverse proxy, also set `trusted_proxy` to the address the gateway sees for
it: the gateway then limits each client by the last `X-Forwarded-For` entry, the one that proxy appended, and ignores
the header from any other peer. Choose a unique `chain_id` of 1–31 ASCII letters, digits, underscores or hyphens,
beginning with a letter. The runner writes its hex encoding to `native-world.json` at `shard.chainId` before deployment
and renders the node configuration with the same identity. The checked-in chain configuration is a template; the package
init renders it before starting a node. Deployment, preset and harness commands check their RPC against the manifest
before submitting. Every image must be pinned by digest. Flags explicitly select native execution and compilation mode.
The runner refuses existing project state and CPUs outside `athanor.slice`. `node_memory_mib` is optional and defaults
to 24576 (24 GiB); explicit host limits override it. Its only upper bound is the slice: the runner refuses a shard whose
limits, beside the containers already in `athanor.slice`, exceed the slice's `memory.max`. The shared Compose node
restarts on failure with its existing chain volume. The old 12 GiB staging limit caused a memcg OOM on September 24.

The runner generates the host's deployer and sequencing keys into private `host-keys.json`; inherited deployer
credentials are not used. It starts the pinned upstream node with `--devnet --devnet-contracts=0`: genesis contains only
the UDC and the two fee tokens, with the standard account class declared but no seeded accounts. This replaces the ten
accounts derived from Madara's public seed. The host's account deploys itself under `--no-charge-fee`, and its address
becomes the node's sequencer address. No bootstrap account or balance transfer is needed. This requires fresh chain
state; existing candidate chains are not rewritten or migrated by initialization.

The runner creates private volumes, deploys the Realms account class (refusing one that differs from the class the
identity service approves devices for) and the operator's own Realms account, deploys the native world under it,
registers the configuration's `presets` and starts Herald. Each shard exports upstream node metrics through its own
pinned OTLP collector into its private run directory; `harness.env` points the existing block reporter at that output.
The collector also scrapes `gateway:9951/metrics` (a port the package never publishes) every 5 seconds. Its cgroup
sampler replaces the Docker stats receiver: it reads each container's `cpu.stat` through a read-only `/sys/fs/cgroup`
mount, with no Docker socket. Every 10 seconds it appends usage and throttling counters to
`metrics/container-metrics.jsonl` in the existing OTLP JSON format, retaining the whole run across collector restarts.
Container ID, cgroup name and relative cgroup path identify each sample, including containers outside the shard so runs
can show competing work. Compare cumulative `container.cpu.usage.total` deltas (nanoseconds), CPU utilization and
throttled time with the latency window. The image builds from pinned Python and collector images; the Compose runner
builds it from the sampler's content hash. It runs without capabilities or writable root files. Keep the unrotated
samples with the run report. The run directory holds its compose configuration, manifest, logs and private
`harness.env`. It starts no live services. Failed runs retain their volumes for inspection; choose a fresh shard id for
a new run.

Before starting admission, the runner checks genesis and every shard role against `host-accounts.json` and the node: the
deployer, sequencing account and its administrator, operator and each domain's authority. It refuses a seeded devnet
address, a different key or the central guardian key used as a shard key. Repeat the read-only check with
`bun deploy/athanor/scripts/inspect-shard-roles.ts RUN_DIRECTORY RPC_URL`; it prints public role holders only.

Public RPC must forward to the shard's `rpc` service on `port_base+5`, never directly to the node on `port_base`. The
RPC proxy replaces unrestricted tunnel forwarding: it permits named reads and exactly three Realms account operations
with tip zero. Deploys must use the manifest's account class and guardian, with salt equal to realms id. Invokes must
come from that account class and contain one self-call: `is_device` with a five-felt join signature, or `revoke_device`
with a three-felt signature. Other writes and node WebSocket upgrades remain refused. Public state streams use Herald.
Fee estimation is limited to those same shapes; the SDK's unsigned query form requires `SKIP_VALIDATE`. Simulation is
refused. The gateway remains the public path for gameplay.

Set `trusted_proxy` to the tunnel's actual socket peer in the shard configuration, matching stream C's gateway setting.
Only that peer may name a client, using the last `X-Forwarded-For` entry; otherwise the socket peer is used. The proxy
permits 30 account requests per client per minute, including estimates and refused attempts. This boundary is required
because `--no-charge-fee` would otherwise let anyone deploy an account and bypass admission. The runner checks its proxy
on startup. After configuring a public hostname, repeat from outside the host:

```bash
bun deploy/athanor/scripts/inspect-shard-roles.ts --public-rpc https://RPC_HOST/rpc/v0_10_2
```

The check requires a working chain identity read and method-not-found rejection for unshaped submissions, both singly
and in mixed batches; it also refuses an exposed WebSocket upgrade. Invalid-params errors fail the check. For the
account-operation smoke, run `bun deploy/athanor/scripts/account-rpc-smoke.ts RUN_DIRECTORY PUBLIC_RPC_URL`. It refuses
foreign account classes, guardian keys, targets, selectors and multi-calls, then joins and revokes a temporary device on
the host operator through the public endpoint. The temporary key stays private in the run directory.

The operator is a bot under the shard's guardian. Our shards' deployment and smoke approve it with `OPERATOR_TOKEN`, the
operator token of the environment `guardian_url` belongs to, from the shell that starts them; it is never written to the
run directory. A community shard brings `data/operator-enrolment.json` instead. The runner derives that environment's
identity API from `guardian_url` (which must end in `/guardian`) and records it as `IDENTITY_URL` in `harness.env`.

The harness requires explicit `DEPLOYER_ACCOUNT_ADDRESS` and `DEPLOYER_PRIVATE_KEY`, including for resumed runs.

For ordered trials, use `scripts/shard.py --matrix MATRIX_JSON RUN_DIRECTORY`. The matrix contains `configurations` (an
ordered list of shard configurations) and `workload` (harness options, underscores for dashes and `true` for a bare
flag: `{"game_type": "frontier", "bots": 2000, "frontier_burst": "booth", "preset": 101, "minutes": 30}` or Blitz
`games` and `accounts_per_game`, or a launch `slot`; the harness refuses what it does not accept). Each trial stores its
configuration, deployment, workload reports and start/end host snapshots under the run directory. A failed workload
aborts the matrix. Each completed or failed candidate is stopped with its volumes retained; the next configuration
starts fresh.

The runner starts the gateway after deployment with the new world's sequencing account and address. The gateway persists
its epoch secret in its own volume. Pending assignments are volatile across restart; recorded nonces prevent duplicate
gameplay effects. The node always runs with WAL and fsync enabled; never request fsync with WAL disabled (upstream issue
#1257).

### Staging

Staging runs on its own box and domain. Initialize each shard with `guardian_url=https://<staging origin>/api/guardian`.
Initialization fetches the guardian's public key and account class hash and records them in `shard.guardianPublicKey`
and `shard.accountClassHash`. An unavailable endpoint or invalid identity stops initialization; candidate and release
configurations never supply substitute values. The deployer declares `RealmsAccount` only when its locally built class
matches that published hash, and the game's authentication and Herald use the same manifest class. The init image builds
the account with the root's declared toolchain and the game with its workspace's toolchain. The host does not compile
contracts during initialization.

Every shard uses the pinned upstream Madara image and admission gateway described above, with its public RPC and
admission URLs on their own staging tunnel hostnames. The node is limited to 24 GiB (`node_memory_mib`) and Herald to
its [measured 6 GiB](../shard/README.md); both restart on failure, so a node restart does not leave Herald down.

The client deploys by dispatching `deploy-client.yml` with the `staging` environment, whose Pages project, origin, zone
and identity RPC secret live in that GitHub environment and never on the box. The client finds shards through its
origin's `/api/directory`; every `/api/*` route belongs to the staging Workers. The launch Worker's shard, registrar
account and launchers are its GitHub environment's variables ([launch service](../../apps/launch-service/README.md)).
The owner-approved `LAUNCHER_ALLOWLIST` is `0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d` only;
further launchers require the owner's word. After a client deploy, verify the served bundle has no public RPC fallback
and exercise sign-in.

Deploy one of our shards from its release with
`OPERATOR_TOKEN=... python3 deploy/athanor/scripts/deploy.py ENVIRONMENT DIRECTORY`. `deploy/release/ENVIRONMENT.json`
is the environment's inputs, including the only preset set it registers. The command takes
`/opt/athanor/isolated-stack.lock` itself, so do not hold it around the command; it refuses to start when initialization
would receive no operator approval, and it fails naming every way the shard differs from the tag's release.json. Use a
staging tunnel connector of its own and fresh volumes for every shard. Hold the lock by hand for verification
afterwards, and verify the app, launch service and every public manifest before handing staging to the other streams.

## Native deployment

Load credentials from a private, gitignored environment file under `.lab/`. The current deployment commands require
`RPC_URL`, `DEPLOYER_ACCOUNT_ADDRESS`, `DEPLOYER_PRIVATE_KEY`, `RANDOMNESS_PRIVATE_KEY`, `NATIVE_AUTHORITY_FILE`,
`GAMEPLAY_CONTRACTS_PATH` and `NATIVE_WORLD_MANIFEST`. The sequencing authority output contains its signing credential;
keep it private. `NATIVE_WORLD_MANIFEST` must point to the isolated shard's output. For manual initialization, write the
nested shard record with the unique ASCII chain ID's hex encoding and the `guardianPublicKey` and `accountClassHash`
returned by the identity service. The deployer asserts the node reports this identity, then preserves it in
`shard.chainId` alongside `shard.accountClassHash` and `shard.contracts`. Only fresh shards are supported: manifests
without `shard.chainId`, including the earlier top-level `chainId` shape, must be replaced by a fresh initialization
with new node state. E1 provides no migration of an existing chain.

Use the release facts JSON baked with the compiled artifacts (`/release/release-facts.json` in the init image). For host
commands, set `NATIVE_RELEASE_FACTS` to that published file.

On the already prepared isolated chain:

```bash
bun deploy/athanor/scripts/deploy-gameplay-contracts.ts
bun deploy/athanor/harness/native/prepare-authority.ts "$NATIVE_WORLD_SEED"
bun config/deployer/clean/cli/deploy-world.ts \
  --seed "$NATIVE_WORLD_SEED" \
  --release-facts "$NATIVE_RELEASE_FACTS" \
  --identity "$GAMEPLAY_CONTRACTS_PATH" \
  --submitter "$SEQUENCING_SUBMITTER_ADDRESS"
bun deploy/athanor/harness/native/prepare-authority.ts "$NATIVE_WORLD_SEED" "$NATIVE_WORLD_MANIFEST"
export DEPLOYER_ACCOUNT_ADDRESS="$(jq -er .operatorAccountAddress "$GAMEPLAY_CONTRACTS_PATH")"
bun config/deployer/clean/registrar/register-preset.ts \
  --environment madara.blitz --preset-id 2
```

The deployer declares classes through `DEPLOYER_ACCOUNT_ADDRESS` and administers the world through identity's bound
`operatorAccountAddress`, which uses the same signing key. Keep the original host deployer account for sequencing
authority preparation and repeat world deployments; switch to the operator for preset registration and launch commands.
Set `SEQUENCING_SUBMITTER_ADDRESS` to the address produced by authority preparation. Repeat deployment with the same
seed, identity, submitter and manifest to check that an unchanged world submits zero transactions. Add `--inspect` to
check class hashes, configuration and activation without mutation. Inspection does not prove storage compatibility; a
populated upgrade needs its own read/mutate check. If a registered release's migration class is not declared, declare
it, then apply. The event-codec cutover requires a fresh native deployment.

Player identity deployment writes the explicit `GAMEPLAY_CONTRACTS_PATH`. No deployment output or private credential
belongs in a tracked configuration file. The launch service and administrative commands use `ADMISSION_URL` for recorded
execution; the client reads the gateway's public admission URL from Herald's `/manifest`.

## Herald and client

Create a separate PostgreSQL database and configure `HERALD_RPC_URL`, `HERALD_PUBLIC_RPC_URL`,
`HERALD_PUBLIC_ADMISSION_URL`, `DATABASE_URL` and `NATIVE_WORLD_MANIFEST`. Start Herald with
`pnpm --dir apps/herald start`, or build the shard package's Herald image, the one Herald build:
`docker build --target herald -f deploy/shard/Dockerfile .`. The candidate service must use that same manifest and
chain.

Wait for `/health` and the confirmed snapshot before connecting the client. Run `pnpm --dir apps/game dev`; the app
reads our directory (`/api/directory`, proxied to staging in development) and lists every shard on it, and a shard the
directory does not list is opened by pasting its Herald URL into the games list. Use the client HTTPS configuration when
signing through a browser wallet. Current facts come through Herald, never a second direct state fetch.

The shard manifest is served at `/manifest` and the directory at `/games`. Compatible class upgrades do not require a
Herald restart. Incompatible schemas are explicit ingestion faults and require a planned release. Historical replay must
use the matching codec.

## Gameplay validation

The harness uses the shared client, native fact store, recorded admission and node transaction subscriptions:

```bash
RPC_URL=http://127.0.0.1:<node-port>/rpc/v0_10_2 HERALD_URL=http://127.0.0.1:<herald-port> \
IDENTITY_URL=https://staging.realms.party/api OPERATOR_TOKEN=... \
bun deploy/athanor/harness/run.ts \
  --bots 6 --minutes 2.5 --interval-seconds 15 --setup-concurrency 6 --workload build-order
```

Bots are Realms accounts under the shard's own guardian, like players. Each bot's device is approved by the
environment's identity Worker through its operator route (`POST /api/devices/bots`), which approves devices only on
accounts whose Realms id is a bot's. `IDENTITY_URL` is the identity API of the environment whose guardian the shard's
manifest names, and `OPERATOR_TOKEN` is that environment's operator token.

The node and Herald URLs are required (`--rpc-url`/`RPC_URL`, `--herald-url`/`HERALD_URL`) and have no default. Use the
node's internal URL on the box, as the shard's `harness.env` records it: the public RPC refuses writes and WebSockets,
and the harness confirms over the node's WebSocket.

Every bot follows build-order suggestions, updates automation each minute and explores. The full acceptance workload
uses 96 players and the frozen run configuration. Do not substitute a short smoke for it. Keep failed runs labeled
failed. Run reports remain in `.lab/runs/`; measurements and exact revision/image/configuration pins go in the PR.

A roster run drives every player as a worker thread of one process and asserts its gates once, over the whole run, in
`rosters-<time>/summary.json`. A run fails only on correctness: the action threshold (3,500 for the frozen 96-player
configuration, otherwise every planned action), chain or driver failures, and blocking gameplay rejections. Latency is a
target to drive as low as possible, reported against the owner's figures and flagged when over, never a failed run:
submit to pre-confirmed visible in the client p95 250 ms (`admissionToVisibleMs`), and Herald's confirmed state behind
the node p95 500 ms (`heraldConfirmedLagMs`: Herald's confirmed notice for the transaction minus the node's
ACCEPTED_ON_L2 for it, both on the driver's clock). Pre-confirmed, accepted-on-L2 and block close latencies are reported
beside them as diagnostics. Host state and block stats are read once by the driver, never per worker, and a block-stats
read that fails or finds no closed block fails the run. The summary records the driver's placement (host, pid, cpuset,
cgroup, available threads) and, per game, the number of transactions its settlement burst took at start. Worker reports
under `players/` carry no gates of their own.

The capacity campaign's shapes are run configurations of the same harness. `--preset <id>` names the preset new games
are created from (default: the game type's). The slot shape's start burst is `--bots 96 --workload burst`: four games of
24, every bot releasing its whole plan at the same instant and its next action as soon as the previous one lands; the
summary's `releaseSpreadMs` shows how tight the release was. The Frontier shape is `--game-type frontier` without
`--functional`: production-length days, every player settling then mustering and exploring in the first minutes, with
the latency and close-cost gates. `--game-type frontier --functional` is FR11's design run instead: the season is
created with twelve-minute days so the bots play through rollovers, and the design gates (token cap, fresh armies after
at least three rollovers) apply while the latency gates do not.

The slot shape proper registers the bots the way players register: `--slot <name> --launch-url <app origin>` with
`OPERATOR_TOKEN` in the environment creates the slot closing `--slot-closes-in-seconds` ahead (default 120), registers
every bot's account into it, waits for the cron to freeze it and for each `<slot>-<gameNumber>` launch run to complete,
and then drives the games the launch service split, created and settled. The harness creates nothing itself in this
mode; a failed launch run fails the harness run with the launch service's reason.

For a node with OTLP export, set `MADARA_METRICS_FILE` to the collector's JSON-lines output. The existing
`scripts/block-stats.py` combines close-block data with upstream counter deltas, excluding process resets. Report
latency separately from gas and execution resources. Admission-to-visible includes queue wait and the Herald barrier.

Preserve the baseline image and chain data until final acceptance and the approved cutover.
