# Shard runtime

A shard hosts games on an unmodified Madara node, Herald and one public stamping RPC. The box builds this checkout and
writes `compose.yml`, `images.env` (local init, Herald and metrics image IDs) and `release.json` (commit and contract
facts). There is no downloaded package or release tag. The upstream node remains pinned by digest in Compose.

## Initialize a fresh shard

Use reviewed environment inputs with `deploy/athanor/scripts/operator-command.py deploy ENVIRONMENT DIRECTORY`, or the
existing local runner `deploy/athanor/scripts/shard.py CONFIGURATION DIRECTORY`. Neither reuses another shard's chain
state. Ops provisions `/opt/athanor/operator-token` as an owner-only regular `0600` file. The wrapper reads it in
memory; Compose binds it read-only into initialization and the harness. Its value never appears in arguments, rendered
environments or Docker container configuration. There is no alternate credential path.

Required package inputs:

```sh
SHARD_NAME=unique-shard-name
CHAIN_ID=UNIQUE_ASCII_CHAIN_ID
GUARDIAN_URL=https://identity.example.org/api/guardian
PUBLIC_RPC_URL=https://rpc.example.org/rpc/v0_10_2
PUBLIC_HERALD_URL=https://herald.example.org
PLAYER_CAPACITY=2000
PRESETS=2,5,101
L2_GAS_BOUND=0x47868c00
HOST_UID=1000
HOST_GID=1000
```

Use image digests from the same release. The pinned node image and chain template are shared by package and runner. The
host must have the athanor slice and enough memory for node, Herald, database, metrics and the stamping runtime. The
node defaults to 24 GiB and Herald to 6 GiB. The RPC container has a 2 GiB RAM limit, with no additional swap, for its
one process, which stamps each play inline with the native prover. Measure its high-water RSS in the 2,000-player run;
this is capacity provisioning, not a claim that RSS was measured on the node.

Deployment runs `docker compose run --rm --no-deps prepare` before creating the stack, so the RPC file bind exists and
Docker cannot replace a missing key with a directory. Manual starts must use that order too.

Preparation generates a host signing key and a separate VRF key on the shard. Both remain in private `data/` files;
`vrf-key.json` is mode `0600`, owned by HOST_UID/HOST_GID. Its public point and the fixed play gas bound are recorded in
`native-world.json` and passed to Games' constructor. Restart verifies the file against that point and refuses an
identity or bound change. There is no VRF key setter: a leaked key retires the shard.

Preparation records immutable identity before network work. An active, draining or retired shard is never removed or
reinitialized; a class or identity difference refuses the update by name. The deployer reads recorded status through the
operator-authenticated directory route before touching state. An incompatible unfinished shard is removed only when the
authenticated directory lists exactly its recorded and configured chain at its configured Herald URL as pending and the
run directory is the environment's own directory. Unlisted incompatible state refuses and requires manual removal; an
unreadable local identity or directory read failure refuses cleanup. Matching initialized state continues through the
existing initialization and role verification. The initializer runs as HOST_UID, and private credentials remain
owner-only with mode `0600`.

## Endpoints and readiness

Both official and runner bootstrap require the Herald HTTPS hostname to be reachable by the identity Worker before
enrolment, including measurement shards. Forward HTTPS hostnames to loopback 8080 (RPC) and 8081 (Herald). `RPC_PORT`,
`HERALD_PORT` and `BIND_ADDRESS` change bindings. The public RPC admits one signed Games.play call, the data-listed
role-guarded administrative entries and existing Realms account-management calls. Play receives a VRF proof inside the
proxy; proof bodies are never served. Simulations and fee estimates are never stamped. The node's write RPC is internal,
not exposed through another port.

Behind a tunnel, set TRUSTED_PROXY to its actual socket peer. With loopback bindings initialization derives that peer
from the Compose network route; exposed bindings trust no proxy unless explicitly configured.

The identity service must carry the pending route before a shard from this code starts. Deploy the identity Worker
containing `/api/directory/shards/pending` before running official deployment; a missing route fails with this
prerequisite. The initializer never lists. The runner registers PENDING before enrolment and retires that registration
on stop; it never activates.

Herald's existing listener first serves the real prepared identity at `/manifest`, with other routes unavailable.
Official deployment registers the Herald URL as pending after starting Herald and before starting initialization or
enrolling the operator. Pending shards are hidden from players. Init then deploys Games, sets owner/launcher/ledger
roles and registers the selected presets. Games is created with the bootstrap owner and the launcher and relay addresses
derived from the guardian identity. The two service Workers join those accounts on their own alarm or cron. Last, on
every start, init has Madara compile each of the world's classes to native code (`warm-native-classes.ts`): Madara
compiles a class only when it first runs it, and runs that first execution on the VM, 2–4× slower. Madara compiles four
at once and refuses more, so init asks again each round for every class still missing, until all are compiled or 15
minutes pass (then the start fails, naming them). Classes already in Madara's cache cost one directory read.

After initialization, deployment compares the deployed classes, schema and selected preset commitments with the build's
facts. It confirms the distinct on-chain roles, then activates the directory entry through Herald's real manifest. A
failed role check or active write leaves the shard pending; rerunning repeats these idempotent operations. Deployment
creates no game and proves no gameplay action end to end; the first real game and playtest provide that evidence.

Metrics collect OTLP and sample container CPU from a read-only cgroup mount, without a Docker socket or write access.
The compose services restart on failure. Initializer logs and `harness.env` are private and must never be published.

| Path                | Registration and visibility                                              | Operator command                                                          |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Official deployment | PENDING before enrolment; initialized facts and Worker roles then ACTIVE | `operator-command.py deploy ENVIRONMENT PACKAGE_DIRECTORY`                |
| Measurement runner  | PENDING before enrolment; retires on stop; never activates               | `operator-command.py runner CONFIGURATION RUNNER_DATA_DIRECTORY --matrix` |

Run each command above as `python3 deploy/athanor/scripts/operator-command.py ...`. The wrapper reads the box's
protected token file; ops provisions it. Use `stop.py` for a manually started runner: it keeps the runner's logs,
removes its containers and volumes, and retires its directory entry.

## Operations: back up and restore

`backup.py capture PROJECT DATA_DIR DEST` takes the isolated-stack lock, backs up PostgreSQL hot, stops the node only
for its cold chain-volume copy, archives private `data/` locally and writes checksums and `capture.json`. The backup
includes the VRF credential and must remain private on the shard. `backup.py restore-test PROJECT DEST` restores into
isolated scratch containers without a network and checks the chain head and database contents. Its JSON verdict must
pass before relying on the backup. A shard's final copy, the one `teardown production` removes it after, follows
`backup.py quiesce PROJECT [RELAY_HEALTH_URL]`: the proxy refuses every write and keeps serving the relay's reads; on a
shard deployed before that switch, quiesce stops the proxy instead, only once the environment's relay health shows the
shard drained and no transaction after its last read. `backup.py reopen PROJECT` lifts either, and
`backup.py verify PROJECT DEST` accepts only a copy of the closed, drained chain. Stop the public RPC during a node
outage; callers receive the fixed refusal and must observe their original transaction hash before submitting another
action.

To restore, use the recorded image digests, chain archive, database backup and private data archive on fresh volumes.
Start preparation first: it verifies identity and republishes runtime files. Then start the stack and verify the pinned
roles before directory activation. Never initialize fresh host keys over an incomplete or restored data directory.

## Contract releases

Games and its VRF configuration are immutable for the life of the shard. A deployment whose baked release facts name the
shard's next release, with the same schema and Games class, registers it: init runs the world deployer, which declares
the changed logic classes and registers them under the next id. Deploy then restarts Herald from the published manifest,
so `/manifest` maps every release. A registration moves no game: games created afterwards start on the new release, and
the launch Worker, which holds the launcher, applies it to the running Frontier games during the Cloudflare deploy. The
baked release facts include the verifier class hash. A schema-changing release still requires the repository's
release/migration procedure; do not edit a published release's contents or reuse a chain identity for a fresh world.

## Shipped node settings

The next fresh dev chain closes blocks every second, selected by `block_time: "1s"` in `deploy/release/dev.json`. The
shared initializer renders `BLOCK_TIME` into the chain configuration; environments without an override retain 2 seconds,
including production. Existing chain configuration is never rewritten by this change. Measurement runner inputs use the
same `block_time` value. This is an environment value, not a gameplay mode.

Block capacity limits stay unchanged: they bound work per block, not a duration or a throughput target. There is no
pending-update interval in the shipped configuration; pre-confirmation keeps the pinned node’s default. Measure its
cadence during qualification rather than inferring it from block time.

Block caps are 10,000 transactions, 1,000,000 state-diff entries, 1,000,000 events and 10^13 for each of Sierra, proving
and receipt L2 gas. Database, Merkle and executor settings use the pinned node’s defaults.

The node keeps its own response-size default. The response size of a full 2,000-action block remains unmeasured; ops
must measure it before adding an override. Compose supplies no execution-batch override.

Qualify 1-second blocks on a fresh dev chain before changing production: repeat the 2-second idle baseline for at least
120 minutes, then the nine-hour soak that covers database maintenance. Record run count, p50/p95/max total-close time,
node RSS, Herald lag and CPU, actual block lifetime and addInvoke latency; compare like-for-like idle and burst loads.
The reference is idle total-close p95 2–3 ms and RSS 3.9 GiB at 120 minutes. The close alarm is 6 ms (twice the
reference p95 upper bound), sustained across three fresh exports. Record stalls and missing measurements explicitly;
block lifetime must come from observed close timestamps if the pinned node does not export it. No qualification has been
run by changing these inputs.
