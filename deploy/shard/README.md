# Shard package

A shard hosts games on an unmodified Madara node, Herald and one public stamping RPC. The package contains
`compose.yml`, `images.env` (init, Herald and metrics digests), `release.json` and these operational scripts.

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
VRF_WORKERS=8
L2_GAS_BOUND=0x47868c00
HOST_UID=1000
HOST_GID=1000
```

Use image digests from the same release. The pinned node image and chain template are shared by package and runner. The
host must have the athanor slice and enough memory for node, Herald, database, metrics and the stamping runtime. The
node defaults to 24 GiB and Herald to 6 GiB. The RPC container has a 2 GiB RAM limit, with no additional swap, for its
eight Bun worker isolates, native prover and bounded request queue. Measure its high-water RSS in the 2,000-player run;
this is capacity provisioning, not a claim that RSS was measured on the node.

Deployment runs `docker compose run --rm --no-deps prepare` before creating the stack, so the RPC file bind exists and
Docker cannot replace a missing key with a directory. Manual starts must use that order too.

Preparation generates a host signing key and a separate VRF key on the shard. Both remain in private `data/` files;
`vrf-key.json` is mode `0600`, owned by HOST_UID/HOST_GID. Its public point and the fixed play gas bound are recorded in
`native-world.json` and passed to Games' constructor. Restart verifies the file against that point and refuses an
identity or bound change. There is no VRF key setter: a leaked key retires the shard.

Preparation records immutable identity before network work and resumes an interrupted first run without replacing keys.
The initializer prepares mount ownership as root, then runs as HOST_UID, like the harness. A credential must be owned by
its reading process's effective uid with mode 0600. If deployed metadata or an older credential is damaged, restore the
same shard's private backup and retry; never remove or regenerate keys or reuse the chain as a fresh shard. If no node
was ever started and no backup exists, retain the failed directory privately and choose a fresh directory and chain id.

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
roles and registers the selected presets. This bootstrap assigns all three roles to the enrolled operator; later role
changes use the contract's existing owner-authorized setters.

Deployment's last step runs `deploy/athanor/harness/self-check.ts` in the harness container against the same public
stamping RPC. Activation also requires the launch Worker to enroll its own account on this pending shard. The owner
confirms `Games.set_launcher(worker account)`; the Worker signs an idempotent `check-worker-*` game creation, and the
deployment verifies its sender, call, confirmed receipt and game row. Missing Worker routes leave the shard PENDING.
Only these checks together promote the directory entry to active. A failure writes `data/self-check.json`, exits nonzero
naming the first failed route and leaves directory status unchanged. Re-run deployment after correcting the fault; it
repeats the check only while PENDING. An ACTIVE or DRAINING rerun creates no check games. The runner and fixture are the
harness implementation, not a separate deployment test suite.

Metrics collect OTLP and sample container CPU from a read-only cgroup mount, without a Docker socket or write access.
The compose services restart on failure. Initializer logs and `harness.env` are private and must never be published.

| Path                | Registration and visibility                                       | Operator command                                                          |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Official deployment | PENDING before enrolment; self-check and Worker check then ACTIVE | `operator-command.py deploy ENVIRONMENT PACKAGE_DIRECTORY`                |
| Measurement runner  | PENDING before enrolment; retires on stop; never activates        | `operator-command.py runner CONFIGURATION RUNNER_DATA_DIRECTORY --matrix` |

Run each command above as `python3 deploy/athanor/scripts/operator-command.py ...`. The wrapper reads the box's
protected token file; ops provisions it. Use `stop.py` for a manually started runner so its directory entry is retired.

Official deployment requires confirmed Worker enrolment, `set_launcher` and Worker-signed creation checks. It binds
cached gameplay evidence to `native-world.json` and `initialized.json`, the chain identity and initialized contracts the
check proves. Packaging changes do not invalidate that evidence. Once `launcher-enrolment.json` exists, a missing or
invalid pass refuses a re-check: "launcher already handed off; finish the Worker check or retire the chain". Missing
Worker routes leave the shard PENDING.

## Operations: back up and restore

`backup.py capture PROJECT DATA_DIR DEST` takes the isolated-stack lock, backs up PostgreSQL hot, stops the node only
for its cold chain-volume copy, archives private `data/` locally and writes checksums and `capture.json`. The backup
includes the VRF credential and must remain private on the shard. `backup.py restore-test PROJECT DEST` restores into
isolated scratch containers without a network and checks the chain head and database contents. Its JSON verdict must
pass before relying on the backup. Stop the public RPC during a node outage; callers receive the fixed refusal and must
observe their original transaction hash before submitting another action.

To restore, use the recorded image digests, chain archive, database backup and private data archive on fresh volumes.
Start preparation first: it verifies identity and republishes runtime files. Then start the stack and repeat the
self-check before directory activation. Never initialize fresh host keys over an incomplete or restored data directory.

## Contract releases

Games and its VRF configuration are immutable for the life of the shard. Releases register new logic classes and
explicitly apply them to games through the existing owner-only calls. The baked release facts include the verifier class
hash. A schema-changing release still requires the repository's release/migration procedure; do not edit a published
release's contents or reuse a chain identity for a fresh world.

## Shipped node settings

Closed blocks remain 2 seconds. Block caps are 10,000 transactions, 1,000,000 state-diff entries, 1,000,000 events and
10^13 for each of Sierra, proving and receipt L2 gas. Parallel Merkle construction is enabled and historical database
snapshots are disabled (`--db-max-kept-snapshots=0`). These are the shipped leader configuration, not trial scripts.

The node keeps its own response-size default. The response size of a full 2,000-action block remains unmeasured; ops
must measure it before adding an override. Execution batches are 4; block-production batches are explicitly 1,024.
