# Native game lab

This directory owns shared infrastructure, identity deployment and the gameplay harness. Native game contracts live
in `contracts/l3/world-native`; the embedded admission node is packaged by `deploy/madara-rand/release/build.py`.
Herald publishes snapshots and ordered diffs to the shared client's authoritative native fact store.

Use a separate checkout, compose project, ports, volumes and Herald database for a candidate. Keep the live project
and owner playtest running. Announce any replacement of the candidate being playtested. Passing a small smoke does
not authorize a traffic switch or a merge into `next`.

## Build tools

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm run build:packages
bash deploy/madara-lab/scripts/install-native-tools.sh "$HOME/.local/share/eternum-native-tools"
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
python3 deploy/madara-rand/release/build.py /path/to/madara REVISION BUILDX_BUILDER OUTPUT_DIRECTORY
```

Use the image digest from that output with `deploy/madara-rand/node.yml` and an isolated compose project. The candidate
configuration must supply the sequencing account, world address and schema, plus its private sequencing credential.
The node persists its epoch secret in its own data volume. Pending assignments are volatile across restart; recorded
nonces prevent duplicate gameplay effects. Keep WAL and fsync enabled for comparable runs. Never request fsync with
WAL disabled.

`docker-compose.yml` preserves the earlier infrastructure profiles and their pinned baseline image. That image is not
the native candidate. Do not start that profile over an existing stack or treat its pin as acceptance of the current
fork. Reserve disjoint ports and resource limits before starting a candidate. Caddy's local TLS routes require the
host entries and certificates produced by `scripts/issue-certs.sh`; keep private files under `.lab/`.

## Native deployment

Load credentials from a private, gitignored environment file under `.lab/`. The current deployment commands require
`RPC_URL`, `NATIVE_ACCOUNT_ADDRESS`, `NATIVE_PRIVATE_KEY`, `BINDING_AUTHORITY_ADDRESS`, `RANDOMNESS_PRIVATE_KEY`,
`NATIVE_AUTHORITY_FILE` and `NATIVE_WORLD_MANIFEST`. The sequencing authority output contains its signing credential;
keep it private. `NATIVE_WORLD_MANIFEST` must point to the isolated world's output, not another stack's manifest.

On the already prepared isolated chain:

```bash
bun deploy/madara-lab/scripts/deploy-gameplay-contracts.ts
bun deploy/madara-lab/harness/native/prepare-authority.ts "$NATIVE_WORLD_SEED"
bun config/deployer/clean/cli/deploy-world.ts \
  --seed "$NATIVE_WORLD_SEED" \
  --identity deploy/madara-lab/.lab/gameplay-contracts.json \
  --submitter "$SEQUENCING_SUBMITTER_ADDRESS"
bun deploy/madara-lab/harness/native/prepare-authority.ts "$NATIVE_WORLD_SEED" "$NATIVE_WORLD_MANIFEST"
bun config/deployer/clean/registrar/register-preset.ts \
  --environment madara.blitz --preset-id 2 --balance-profile official-60
```

Set `SEQUENCING_SUBMITTER_ADDRESS` to the address produced by authority preparation. Repeat deployment with the same
seed, identity, submitter and manifest to check that an unchanged world submits zero transactions. Add `--inspect`
to check class hashes, configuration and activation without mutation. Inspection does not prove storage compatibility;
a populated upgrade needs its own read/mutate check. The event-codec cutover requires a fresh native deployment.

Player identity deployment writes `.lab/gameplay-contracts.json`. No deployment output or private credential belongs
in a tracked configuration file. The launch service and administrative commands use `ADMISSION_URL` for recorded
execution; the client uses `VITE_PUBLIC_ADMISSION_URL` for that same node.

## Herald and client

Create a separate PostgreSQL database and configure `HERALD_CHAIN=madara`, `HERALD_RPC_URL`, `DATABASE_URL` and
`NATIVE_WORLD_MANIFEST`. Start Herald with `pnpm --dir apps/herald start`, or package its real workspace graph with
`deploy/madara-rand/release/build-herald.py`. The candidate service must use that same manifest and chain.

Wait for `/health` and the confirmed snapshot before connecting the client. Set its native manifest, admission and
Herald URLs to the isolated endpoints, then run `pnpm --dir apps/game dev`. Use the client HTTPS configuration when
signing through a browser wallet. Current facts come through Herald, never a second direct state fetch.

The directory is served at `/madara/games`. Compatible class upgrades do not require a Herald restart. Incompatible
schemas are explicit ingestion faults and require a planned release. Historical replay must use the matching codec.

## Gameplay validation

The harness uses the shared client, native fact store, recorded admission and node transaction subscriptions:

```bash
bun deploy/madara-lab/harness/run.ts \
  --bots 6 --minutes 2.5 --interval-seconds 15 --setup-concurrency 6 --workload build-order
```

Every bot follows build-order suggestions, updates automation each minute and explores. The full acceptance workload
uses 96 players and the frozen run configuration. Do not substitute a short smoke for it. Keep failed runs labeled
failed. Run reports remain in `.lab/runs/`; measurements and exact revision/image/configuration pins go in the PR.

For a node with OTLP export, set `MADARA_METRICS_FILE` to the collector's JSON-lines output. The existing
`scripts/block-stats.py` combines close-block data with upstream counter deltas, excluding process resets. Report
latency separately from gas and execution resources. Admission-to-visible includes queue wait and the Herald barrier.

The server deployment workflow fails closed without native target configuration. Do not use it to update the live
stack during integration. Preserve the baseline image and chain data until final acceptance and the approved cutover.
