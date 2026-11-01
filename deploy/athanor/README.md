# ATHANOR

A shard hosts games on one sequencer, one installation of the native game contracts and one Herald. Madara is the
sequencer and the public RPC stamps signed player invokes; Herald serves the shard manifest, game directory, snapshots
and ordered diffs. Game contracts live in `contracts/l3/world-native`, and clients consume Herald through the shared
native fact store.

ATHANOR contains the isolated box deployment and gameplay harness. `scripts/shard.py` initializes a fresh shard from
pinned images, an explicit chain identity and the published guardian identity, then starts its compose project. See
"Runtime and deployment" below for the inputs. Clients are static builds on Cloudflare Pages; identity, the shard
directory, launches and the other central services are the environment's Workers. The
[shard runtime](../shard/README.md) runs with Docker alone; the runner renders that same Compose file.

## Runtime and deployment

The shard package in [deploy/shard](../shard/README.md) owns Madara, PostgreSQL, Herald, one stamping RPC and metrics.
The init image carries the compiled contracts and native verifier; the Herald image also carries the stamping bundle and
native prover. The RPC stamps each play inline. The box builds init, Herald and metrics images from its checkout. There
is no gateway image or service.

For first deployment and updates use `python3 deploy/athanor/scripts/operator-command.py deploy ENVIRONMENT DIRECTORY`.
`deploy/release/ENVIRONMENT.json` is the reviewed input source. The deployer builds its images under the shared Cairo
lock, with compilation pinned to cores 8–11. For measurements use the existing
`python3 deploy/athanor/scripts/shard.py CONFIGURATION DIRECTORY` runner with explicit local image digests, unique chain
identity, official RPC/Herald URLs, guardian, presets and fixed play bound. The runner writes its resolved Compose file
and public deployment manifest alongside private initialization logs. Both paths register PENDING before enrolment. Only
official deployment runs the activation gate; measurement runners stay hidden and retire on stop.

The dev node belongs to the operator running its trials. Deployment and workload commands take
`/opt/athanor/isolated-stack.lock` themselves; do not hold it around those commands. No command should target the
production chain or reuse the state or chain ID of another shard. Backups stay private and local to the shard.

## Native deployment

The shard package initializes host signing keys and a separate VRF key, then deploys Games with immutable VRF public
point and play gas bound. Use the package deployment flow in [deploy/shard](../shard/README.md); it registers the shard
pending before operator enrollment, compares initialized facts and confirms service roles before making it visible.
There is no sequencing account, per-game order, epoch service or second submission endpoint. Private credentials stay in
`data/` with mode `0600`; the public manifest contains only their public identity.

## Herald and client

Create a separate PostgreSQL database and configure `HERALD_RPC_URL`, `HERALD_PUBLIC_RPC_URL`, `DATABASE_URL` and
`NATIVE_WORLD_MANIFEST`. Start Herald with `pnpm --dir apps/herald start`, or build the shard package's Herald image,
the one Herald build: `git archive HEAD | docker build --target herald -f deploy/shard/Dockerfile -`. Export the
committed revision for every local image build so private runtime files anywhere in the checkout stay out of the
context. The candidate service must use that same manifest and chain.

Wait for `/health` and the confirmed snapshot before connecting the client. Run `pnpm --dir apps/game dev`; the app
reads our official directory (`/api/directory`, proxied to staging in development) and lists its active shards. Use the
client HTTPS configuration when signing through a browser wallet. Current facts come through Herald, never a second
direct state fetch.

The shard manifest is served at `/manifest` and the directory at `/games`. Compatible class upgrades do not require a
Herald restart. Incompatible schemas are explicit ingestion faults and require a planned release. Historical replay must
use the matching codec.

## Season opening and settlement runbook

Set the Frontier calendar, wait for the game to be created, then fund it at once with the operator's whole-LORDS amount
using the [environment's funding command](../../contracts/l2/ledger/README.md#fund-a-frontier-season). The relay checks
that deposit and publishes the pool to the shard. No ruin chest exists before publication; confirm the positive pool in
Herald's `LordsBudget` row. The preset carries no pool.

For automatic payouts, settlement and treasury returns, follow the ledger's
[Frontier settlement and treasury returns](../../contracts/l2/ledger/README.md#frontier-settlement-and-treasury-returns)
procedure, including its compatible-deployment rehearsal requirement and existing dev-ledger limitation.

## Independent payout co-signer

Frontier custody requires the relay's operator transaction plus a Stark-curve signature from a separate box process.
Install `deploy/athanor/cosigner/payout-cosigner.service` for a dedicated `payout-cosigner` Unix user, with this
reviewed checkout at `/opt/eternum`. Install dependencies with `pnpm install --frozen-lockfile` and build the workspace
exports with `pnpm run build:packages` before starting the unit. This process has no Cloudflare deployment credentials
and submits no L2 transactions. Keep its private key outside every Worker secret store and deployment export.

`deploy/athanor/cosigner/install.sh` does these steps on the box and is safe to rerun: `prepare REVISION` (piped over SSH
before the checkout exists) makes the user, puts Bun at `/usr/local/bin`, checks out and builds `/opt/eternum` at that
commit and initializes the key, printing only the public key; `start` takes `config.json` on standard input, installs
it mode 0600 with the unit, starts it and prints `/health`.

Before ledger setup, run `bun deploy/athanor/cosigner/main.ts init-key /etc/payout-cosigner/key` as that user. It prints
only the public key. Put that public key in setup's `cosignerPublicKey`; setup also requires `cosignerUrl` (HTTPS) and
`cosignerToken` (request bearer token). Only the URL/token go to the relay Worker. The ledger constructor takes the
public key. A fresh ledger and matching relay/identity builds are required.

Create `/etc/payout-cosigner/config.json`, owned by `payout-cosigner`, mode `0600`, containing:

- `l2RpcUrl`, `l2ChainId`, `ledgerAddress`: the reviewed L2 endpoint, chain ID and fresh ledger.
- `identityUrl`, `identityToken`: identity's HTTPS origin and existing operator read token. The service queries
  `/api/operator/payout-identity?account=...` directly for the receipt account's current verified wallet.
- `requestToken`: the same request token supplied as setup's `cosignerToken`.
- `port`: the assigned loopback port; expose only `/sign` and `/health` through the host's HTTPS proxy.
- `shards`: copy only `chainId`, `gamesAddress` and `firstRelease` from the reviewed box manifests. Set `rpcUrl` to
  `http://127.0.0.1:8080` and `heraldUrl` to `http://127.0.0.1:8081` (the stack's local published ports). Do not copy
  the public tunnel hostnames. Startup requires HTTP on numeric loopback, including IPv6 `::1`, for both sources. For
  another local stack, use its explicitly assigned loopback ports. Requests cannot alter these sources. Keep retiring
  shards listed until their claims are settled.

Both the key and configuration files must have mode `0600`. The service binds only `127.0.0.1`; startup refuses invalid
configuration. Install/start the unit after funding bindings and identity routing are available. `/health` identifies
the process and public key, plus `pendingWalletChanges` (`count` and `oldestSince`, a Unix timestamp or null). It is not
proof that a particular claim can be verified. Read it directly on the box to inspect holds independently of Cloudflare;
the journal remains the source of account/identity-change details. On production, `payout-alerts.timer` (installed by
setup step 13, `deploy/first/README.md`) runs `cosigner/alerts.ts check` every minute as the co-signer's user and posts
to the owner's Discord channel, off Cloudflare: each held wallet change (the Realms ID, its accounts, the candidate
wallet and when the hold ends), its acceptance or cancellation, a paused and an unpaused ledger, and a co-signer silent
for three minutes and back. It reads the wallet database read-only and keeps `alerts.json` in the state directory, so
each change posts once; a failed post records nothing and the next minute retries. What each message means:
[ON-CALL.md](../first/ON-CALL.md#payout-alerts--the-owners-discord-channel). Rehearse `/sign` through an actual
withdrawal, then check the L2 wallet and `get_payment`; also rehearse deadline treasury returns and signer
outage/recovery. The service signs synchronously on request, with no timer or cron queue; network-dependent subsecond
latency must be checked in the deployment rehearsal.

The systemd unit owns `/var/lib/payout-cosigner` (mode `0700`); its `wallets.sqlite` database is mode `0600`. Preserve
this database across updates, restarts and key rotations, and back it up with the box state. Deleting it or restoring an
older copy loses recipient history. After verifying a payment, the service pins the receipt account's Realms ID and that
ID's wallet independently of Cloudflare. A different wallet is logged and refused for 24 hours from its first
observation. Another observed candidate restarts the hold; observing the known wallet cancels it. A changed Realms ID
for a known gameplay account is refused, so identity cannot bypass the hold by changing the cache key. Investigate
`cosigner_wallet_change_waiting` and `cosigner_account_identity_changed` journal entries; do not delete the database to
clear them. Ordinary unchanged wallets have no added delay. Rehearse a relink and restart before player funding.

This is a hold based on observations during signing requests, not a player-signed wallet binding: first-seen account/ID
bindings still trust identity, and an attacker controlling identity for 24 hours can satisfy a held wallet change.
Changes between observations are not independently witnessed. Player-signed bindings are still needed to close those
gaps. The box process must read the game node and Herald directly on loopback; Cloudflare cannot choose those facts.

For rotation, pause the ledger, generate a new box key, have the cold admin call `set_cosigner(public_key)`, update the
box key and restart the unit, then rehearse before unpausing. Every rotation increments the ledger epoch, invalidating
old signatures even if a public key is reused. Keep the key file out of logs and public artifacts. A signer outage
queues payments and settlement; the operator cannot bypass it. The independent monitor retains its pause policy and
needs STRK for pause/challenge transactions; the co-signer needs none.

## Uptime qualification

Every load qualification includes an idle leg after gameplay: observe the same chain for at least nine hours, long
enough to cover the measured tombstone accumulation cycle. Record total block-close p95 every thirty minutes and repeat
a modest gameplay check at the end. Require idle block-close p95 below 6 ms and no close stall longer than the
configured block time. A short burst cannot establish long-running node health.

The existing metrics collector observes total block close, not a separate commit stage. It emits `node_close_slow` after
three fresh OTLP exports above 6 ms and `node_close_recovered` on recovery. Thirty seconds without a fresh block-close
metric emits `node_close_metric_missing`; fresh data emits `node_close_metric_restored`. Malformed records emit
`node_metric_record_invalid` and are skipped. Read these events in the metrics container log. This is a local alarm, not
a notification delivery service; it uses `close_block_total_last_seconds` from the pinned node. One outlier does not
trigger it. The collector follows the rotating export and never counts the same sample twice.

## Gameplay validation

The harness uses the shared client, native fact store, direct signed invokes and public receipt polling. On one of our
shards, run it from the package directory with the protected operator credential file mounted:

```bash
sudo docker compose run --rm harness \
  --bots 6 --minutes 6 --setup-concurrency 6 --game-type frontier --functional
```

The `harness` service runs the init image on the shard's network as the host user, with the shard's `harness.env`: the
node's internal RPC, Herald, the identity API and the operator's keys. Its reports land in `data/harness/<start time>/`,
owned by the host user. `--herald-url https://HERALD_HOST` drives the public Herald instead, as a player's client does.

Bots are Realms accounts under the shard's own guardian, like players. Each bot's device is approved by the
environment's identity Worker through its operator route (`POST /api/devices/bots`), which approves only a bot account's
first device, and only on accounts whose Realms id is a bot's. It never adds a later device or revokes one, so a leaked
operator token cannot take over an account that already has a device, the operator included. `IDENTITY_URL` is the
identity API of the environment whose guardian the shard's manifest names. The package harness reads the environment's
operator token from its protected `/opt/athanor/operator-token` mount; host commands use `operator-command.py`.

The node and Herald URLs are required (`--rpc-url`/`RPC_URL`, `--herald-url`/`HERALD_URL`) and have no default; the
`harness` service takes them from `harness.env`. Player invokes use the public stamping RPC. Setup and administrative
calls, bot accounts joining included, use HARNESS_ADMIN_RPC_URL on the private node inside the Compose network.

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
are created from (default: the game type's). The Frontier shape is `--game-type frontier` without `--functional`:
production-length days, every player settling then mustering and exploring in the first minutes, with the latency gates
and, measured from the host, the close-cost evidence. `--game-type frontier --functional` is FR11's design run instead:
the season is created with twelve-minute days so the bots play through rollovers, and the design gates (token cap, fresh
armies after at least three rollovers) apply while the latency gates do not.
`--game-type frontier --functional --preset 5` is the real-speed pass on the preset players play: every bot founds its
realm, raises the troops its wheat pays for and explores, and the run checks, from the chain's facts, each producing
building's rate against preset 5's, that raising took exactly the recipe's 2 wheat per troop and each explore or step
exactly its food per troop, and that no submitted action was a gameplay rejection. Latency is reported, not gated. A day
lasts a day there, so the multi-day gates stay with the design run.

### Measuring a shard

The harness runs inside the shard's network and sees only what a client sees. What only the host sees is measured around
it, by one function in `scripts/measures.py` that a runner trial and a package shard share: the host's state before and
after (`host-state.sh`), the node's anonymous memory and kept RocksDB snapshots every 15 s, read from the cgroup Docker
placed the node in, and, over the workload window the harness's reports span, the node's closed blocks from its logs and
its metrics export (`block-stats.sh`) and the harness's gas per block reconciled against them. Block statistics are the
run's close-cost evidence: a window without a closed block fails the run. Every workload report gives its window as
`workload.startedAt`/`endedAt`; one that observes no per-action outcomes or per-block gas omits them, and the result
names those measurements unavailable rather than zero.

Measure one of our package shards from its deploy directory:

```bash
python3 deploy/athanor/scripts/operator-command.py measure /opt/athanor/runs/staging-f soak-1 -- \
  --game-type frontier --frontier-burst booth --bots 2000 --setup-concurrency 32
```

It takes the isolated-stack lock, runs the package's `harness` service with the options after `--` and writes
`data/measure/NAME/result.json` beside the harness's reports in `data/measure/NAME/workload`. Report latency separately
from gas and execution resources. Admission-to-visible includes queue wait and the Herald barrier.

A measurement shard (the runner, `operator-command.py runner CONFIGURATION DIRECTORY --matrix`) has no directory-listed
game: it stays PENDING. After its readiness probe the runner makes the harness's operator the Games launcher and ledger
operator (`scripts/measurement-roles.ts`, refused on any chain named after a deployment environment), so the harness
creates its own games there. Eternum runs create theirs as always; a Frontier run or the 2,000-player wave takes
`--create-game`. Matrix workloads name the shard's own endpoints, `"rpc_url": "http://rpc:8080/rpc/v0_10_2"` and
`"herald_url": "http://herald:3003"`, with `public_rpc_url` set to the same RPC URL. When an arm ends, passed or failed,
the runner keeps its containers' logs in `DIRECTORY/SHARD/shard-logs.log` and removes the shard's containers, volumes
and network; the images it ran stay for the next arm.

Preserve the baseline image and chain data until final acceptance and the approved cutover.
