# ATHANOR

A shard hosts games on one sequencer, one installation of the native game contracts and one Herald. Madara is the
sequencer and the public RPC stamps signed player invokes; Herald serves the shard manifest, game directory, snapshots
and ordered diffs. Game contracts live in `contracts/l3/world-native`, and clients consume Herald through the shared
native fact store.

ATHANOR contains the isolated box deployment and gameplay harness. `scripts/shard.py` initializes a fresh shard from
pinned images, an explicit chain identity and the published guardian identity, then starts its compose project. See
"Runtime and deployment" below for the inputs. Clients are static builds on Cloudflare Pages; identity, the shard
directory, launches and the other central services are the environment's Workers. The
[public shard package](../shard/README.md) runs with Docker alone; the runner renders that same Compose file.

## Runtime and deployment

The shard package in [deploy/shard](../shard/README.md) owns Madara, PostgreSQL, Herald, one stamping RPC and metrics.
The init image carries the compiled contracts and native verifier; the Herald image also carries the stamping bundle,
worker and native prover. CI publishes only init, Herald and metrics images. There is no gateway image or service.

For released packages use `OPERATOR_TOKEN=... python3 deploy/athanor/scripts/deploy.py ENVIRONMENT DIRECTORY`.
`deploy/release/ENVIRONMENT.json` is the reviewed input source. For a fresh local build use the existing
`python3 deploy/athanor/scripts/shard.py CONFIGURATION DIRECTORY` runner with explicit local image digests, unique chain
identity, official RPC/Herald URLs, guardian, presets, worker count and fixed play bound. The runner writes its resolved
Compose file and public deployment manifest alongside private initialization logs. Only official deployment registers
pending before enrollment and runs the activation gate. The local runner never lists measurement shards.

The dev node belongs to the operator running its trials. Deployment and workload commands take
`/opt/athanor/isolated-stack.lock` themselves; do not hold it around those commands. No command should target the
production chain or reuse the state or chain ID of another shard. Backups stay private and local to the shard.

## Native deployment

The shard package initializes host signing keys and a separate VRF key, then deploys Games with immutable VRF public
point and play gas bound. Use the package deployment flow in [deploy/shard](../shard/README.md); it registers the shard
pending before operator enrollment and runs the deployment self-check before making it visible. There is no sequencing
account, per-game order, epoch service or second submission endpoint. Private credentials stay in `data/` with mode
`0600`; the public manifest contains only their public identity.

## Herald and client

Create a separate PostgreSQL database and configure `HERALD_RPC_URL`, `HERALD_PUBLIC_RPC_URL`, `DATABASE_URL` and
`NATIVE_WORLD_MANIFEST`. Start Herald with `pnpm --dir apps/herald start`, or build the shard package's Herald image,
the one Herald build: `docker build --target herald -f deploy/shard/Dockerfile .`. The candidate service must use that
same manifest and chain.

Wait for `/health` and the confirmed snapshot before connecting the client. Run `pnpm --dir apps/game dev`; the app
reads our directory (`/api/directory`, proxied to staging in development) and lists every shard on it, and a shard the
directory does not list is opened by pasting its Herald URL into the games list. Use the client HTTPS configuration when
signing through a browser wallet. Current facts come through Herald, never a second direct state fetch.

The shard manifest is served at `/manifest` and the directory at `/games`. Compatible class upgrades do not require a
Herald restart. Incompatible schemas are explicit ingestion faults and require a planned release. Historical replay must
use the matching codec.

## Gameplay validation

The harness uses the shared client, native fact store, direct signed invokes and public receipt polling. On one of our
shards, run it from the package directory with the environment's operator token in the shell:

```bash
OPERATOR_TOKEN=... sudo --preserve-env=OPERATOR_TOKEN docker compose run --rm harness \
  --bots 6 --minutes 6 --interval-seconds 15 --setup-concurrency 6 --workload build-order --functional
```

The `harness` service runs the init image on the shard's network as the host user, with the shard's `harness.env`: the
node's internal RPC, Herald, the identity API and the operator's keys. Its reports land in `data/harness/<start time>/`,
owned by the host user. `HARNESS_CPUSET` pins the driver to CPUs of its own; set it for any large run, so the driver
does not compete with the shard it drives. `--herald-url https://HERALD_HOST` drives the public Herald instead, as a
player's client does.

Bots are Realms accounts under the shard's own guardian, like players. Each bot's device is approved by the
environment's identity Worker through its operator route (`POST /api/devices/bots`), which approves only a bot account's
first device, and only on accounts whose Realms id is a bot's. It never adds a later device or revokes one, so a leaked
operator token cannot take over an account that already has a device, the operator included. `IDENTITY_URL` is the
identity API of the environment whose guardian the shard's manifest names, and `OPERATOR_TOKEN` is that environment's
operator token.

The node and Herald URLs are required (`--rpc-url`/`RPC_URL`, `--herald-url`/`HERALD_URL`) and have no default; the
`harness` service takes them from `harness.env`. Player invokes use the public stamping RPC. Setup and administrative
calls use HARNESS_ADMIN_RPC_URL on the private node inside the Compose network.

Every bot follows build-order suggestions, updates automation each minute and explores. The full acceptance workload
uses 96 players and the frozen run configuration. Do not substitute a short smoke for it. Keep failed runs labeled
failed. Measurements and exact revision/image/configuration pins go in the PR.

A roster run drives every player as a worker thread of one process and asserts its gates once, over the whole run, in
`rosters-<time>/summary.json`. A run fails only on correctness: the action threshold (3,500 for the frozen 96-player
configuration, otherwise every planned action), chain or driver failures, and blocking gameplay rejections. Latency is a
target to drive as low as possible, reported against the owner's figures and flagged when over, never a failed run:
submit to pre-confirmed visible in the client p95 250 ms (`admissionToVisibleMs`), and Herald's confirmed state behind
the node p95 500 ms (`heraldConfirmedLagMs`: Herald's confirmed notice for the transaction minus the node's
ACCEPTED_ON_L2 for it, both on the driver's clock). Pre-confirmed, accepted-on-L2 and block close latencies are reported
beside them as diagnostics. The summary records the driver's placement (host, pid, cpuset, cgroup, available threads)
and, per game, the number of transactions its settlement burst took at start. Worker reports under `players/` carry no
gates of their own. Reports are committed at process exit after client and socket teardown; their verdict includes late
callback failures and the exit code. The console names the report path without announcing an earlier PASS.

The capacity campaign's shapes are run configurations of the same harness. `--preset <id>` names the preset new games
are created from (default: the game type's). The slot shape's start burst is `--bots 96 --workload burst`: four games of
24, every bot releasing its whole plan at the same instant and its next action as soon as the previous one lands; the
summary's `releaseSpreadMs` shows how tight the release was. The Frontier shape is `--game-type frontier` without
`--functional`: production-length days, every player settling then mustering and exploring in the first minutes, with
the latency gates and, measured from the host, the close-cost evidence. `--game-type frontier --functional` is FR11's
design run instead: the season is created with twelve-minute days so the bots play through rollovers, and the design
gates (token cap, fresh armies after at least three rollovers) apply while the latency gates do not.
`--game-type frontier --functional --preset 5` is the real-speed pass on the preset players play: every bot founds its
realm, raises the troops its wheat pays for and explores, and the run checks, from the chain's facts, each producing
building's rate against preset 5's, that raising took exactly the recipe's 2 wheat per troop and each explore or step
exactly its food per troop, and that no submitted action was a gameplay rejection. Latency is reported, not gated. A day
lasts a day there, so the multi-day gates stay with the design run.

The slot shape proper registers the bots the way players register: `--slot <name> --launch-url <app origin>` with
`OPERATOR_TOKEN` in the environment creates the slot closing `--slot-closes-in-seconds` ahead (default 120), registers
every bot's account into it, waits for the cron to freeze it and for each `<slot>-<gameNumber>` launch run to complete,
and then drives the games the launch service split, created and settled. The harness creates nothing itself in this
mode; a failed launch run fails the harness run with the launch service's reason.

### Measuring a shard

The harness runs inside the shard's network and sees only what a client sees. What only the host sees is measured around
it, by one function in `scripts/measures.py` that a runner trial and a package shard share: the host's state before and
after (`host-state.sh`), the node's anonymous memory and kept RocksDB snapshots every 15 s, read from the cgroup Docker
placed the node in, and, over the workload window the harness's reports span, the node's closed blocks from its logs and
its metrics export (`block-stats.sh`) and the harness's gas per block reconciled against them. Block statistics are the
run's close-cost evidence: a window without a closed block fails the run.

Measure one of our package shards from its deploy directory:

```bash
OPERATOR_TOKEN=... python3 deploy/athanor/scripts/measures.py /opt/athanor/runs/staging-f soak-1 --cpuset 20-23 -- \
  --game-type frontier --frontier-burst booth --bots 2000 --setup-concurrency 32
```

It takes the isolated-stack lock, runs the package's `harness` service with the options after `--` on the CPUs
`--cpuset` names (recorded as `driverCpuset`; the harness's own report records the CPUs it saw), and writes
`data/measure/NAME/result.json` beside the harness's reports in `data/measure/NAME/workload`. Report latency separately
from gas and execution resources. Admission-to-visible includes queue wait and the Herald barrier.

Preserve the baseline image and chain data until final acceptance and the approved cutover.
