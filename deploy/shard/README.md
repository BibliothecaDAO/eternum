# Run a shard

A shard hosts games on a node, admission gateway and Herald. This package replaces the box-specific generated service
definitions. It needs Docker with Compose, Linux amd64, and memory for the node, Herald and the remaining services.
Identity, the directory and launches belong to the central Workers; the client is the shared app.

Download `shard.tar.gz` from a `shard-v*` release and extract it. The archive includes this Compose file,
`images.env` with the CI-built init, Herald and gateway image digests, and `release.json`, the release's facts: its
commit, images, node, every contract class and every preset commitment it can register. No checkout, compiler or JavaScript runtime is
needed on the host. Supply a unique chain id and the public endpoints in `.env`:

```sh
cp images.env .env
cat >> .env <<'CONFIG'
SHARD_NAME=my-shard
CHAIN_ID=MY_SHARD_20260923
GUARDIAN_URL=https://play.realms.party/api/guardian
PUBLIC_RPC_URL=https://rpc.example.org/rpc/v0_10_2
PUBLIC_ADMISSION_URL=https://admission.example.org
PRESETS=2,5
HERALD_MEMORY=6g
NODE_MEMORY=24g
CONFIG
printf 'HOST_UID=%s\nHOST_GID=%s\n' "$(id -u)" "$(id -g)" >> .env
docker compose up -d
```

`HERALD_MEMORY` defaults to `6g`: stream D's `measure:load` workload of four 24-player Blitz games (96 subscribers)
held RSS at about 4.6–4.7 GB over 90 simulated minutes after stream cleanup
([measurement](https://github.com/BibliothecaDAO/eternum/commit/38673965cf4)). `NODE_MEMORY` separately defaults to
`24g`: staging exhausted its previous 12 GiB node limit on September 24. Nodes restart on failure using their
persistent chain volumes; this gives more headroom while the memory growth is investigated. Leave additional memory
for Postgres, the gateway and the host; size larger or Frontier workloads from their own measurements. These are RAM limits with swap disabled. Our box
runner keeps these defaults and refuses a shard whose limits do not fit its resource slice beside the shards already
running there.

Community shards use the production guardian at `https://play.realms.party/api/guardian`.
`https://staging.realms.party/api/guardian` belongs to our staging tests.

Initialization generates the host's deployer and sequencing keys locally in `data/`, reads the guardian's real public
key and account class, starts a genesis with no seeded accounts, deploys the contracts and operator, registers the
presets `PRESETS` names (2 is Blitz, 5 is Frontier; an id outside `release.json` is refused before anything deploys)
and writes `data/native-world.json` and `data/initialized.json`, which records each preset's commitment on chain.
Every start registers any listed preset not yet on chain. Private keys remain in `data/` (mode 0700); back it up with the chain, gateway
and PostgreSQL volumes. Never publish it. Initialization refuses a changed identity on existing data. Inspect a failed
init in `data/*.log` before retrying; do not delete chain state to repair a deployment.

Forward your HTTPS hostnames to loopback ports 8080 (RPC), 8081 (Herald) and 8082 (admission). `RPC_PORT`,
`HERALD_PORT` and `ADMISSION_PORT` can select disjoint ports for a second shard. Never expose the node itself. Gameplay writes enter through admission. Herald serves `/manifest`; public RPC permits
Realms account deployment, device join and device revoke checked against the manifest, plus invokes from the host
operator recorded in `data/gameplay-contracts.json`. All require zero tip. SDK fee estimation follows the same policy;
other writes and node WebSocket upgrades are refused. The node still verifies every submitted transaction signature.
The default loopback bindings expect a tunnel on the host. Set `BIND_ADDRESS` only when placing these three services
behind another TLS proxy. The node has no published port.
Only a trusted proxy may supply a client address, using the last `X-Forwarded-For` entry; other requests are keyed by
their socket peer. The account RPC limit is 30 requests per client per minute. Behind the default loopback bindings,
every connection arrives from the shard's Compose network gateway, so initialization trusts that address, found again
on every start; with `BIND_ADDRESS` set, it trusts no one unless `TRUSTED_PROXY` names your proxy's socket peer IP.
An explicit `TRUSTED_PROXY` always wins. The benchmark runner names this same setting `trusted_proxy`.

Verify the boundary and read the public manifest:

```sh
docker compose run --rm --no-deps --entrypoint bun init \
  deploy/athanor/scripts/inspect-shard-roles.ts --public-rpc https://rpc.example.org/rpc/v0_10_2
curl --fail https://herald.example.org/manifest
```

Repeat the RPC check from outside the host. Unshaped submissions must return method-not-found, including in mixed batches; invalid-params means the node's write
handler is exposed. Exercise the account exceptions and refusals through the same public endpoint:

```sh
docker compose run --rm --no-deps --entrypoint bun init \
  deploy/athanor/scripts/account-rpc-smoke.ts /data https://rpc.example.org/rpc/v0_10_2
```

The smoke rejects foreign classes, guardian keys and non-operator calls to other targets, selectors or multi-calls;
it joins and revokes a temporary device and confirms a harmless operator invoke. Keys remain private in `data/`.

Create an unranked Frontier game with the host operator (choose a future start time):

```sh
docker compose run --rm --no-deps --entrypoint /bin/sh init -ec \
  'set -a; . /data/harness.env; exec bun config/deployer/clean/cli/create.ts \
    --environment madara.frontier --game my-frontier --start-time 2026-09-24T12:00:00Z --dev-mode-on true'
```

Open `https://play.realms.party/play`, paste your Herald HTTPS URL into **Shard URL**, and select **Open shard**.
The game appears beside the directory's games; sign in and enter it. A private unlisted shard does not need a directory
entry for this flow.

To create games through the central launch Worker, give its owner the shard's Herald URL and transfer registrar
credentials from `data/harness.env` privately. Publish only the operator address. The owner lists the shard in the
directory and approves its launchers. Open `https://play.realms.party` to create and join a game on the listed shard.
Anyone can host unranked games; ranked games require an approved shard.

`docker compose stop` retains state. Starting the same package again audits the existing deployment. Changing the
release is a separate operator action; never recreate genesis for an existing shard. CI publishes immutable images and
this archive from `shard-v*` tags; it does not deploy a box or change a live hostname.

## Operations: apply a logic hotfix

Use the new package's init and Herald image digests in `.env`, keeping the existing shard identity, data and Games
address. The build's immutable release id and schema come from its published release facts; changing an existing
release's contents is refused. A hotfix must keep the shard's fact schema. The deployer refuses a changed schema with
`NATIVE_HOTFIX_SCHEMA_CHANGE`; a schema-changing fix requires a new shard or season.
The signing key must belong to the game's creator (the launch operator for our games).

A release that migrates data includes a production contract named `ReleaseMigration` in its build artifacts. It
implements `IReleaseMigration.migrate(game_id, previous_release, release_id)` and updates Games storage through a
library call. The build records its class hash in the baked release facts. The deployer declares it and checks its
declaration before registration. If a registered release's migration class is not declared, declare it, then apply.
Bump `NATIVE_RELEASE_ID` in `deploy/release/facts.ts` for each release; never edit a published release's contents.

Run these steps in order. The init image contains the CLI, compiled classes and published facts, so no host toolchain
is needed. This helper loads the shard's private credentials inside the container without printing them:

```sh
hotfix() {
  docker compose run --rm --no-deps --entrypoint /bin/sh init -ec '
    set -a
    . /data/harness.env
    DEPLOYER_ACCOUNT_ADDRESS=$(bun -e "console.log(require(\"/data/host-keys.json\").deployerAddress)")
    seed=$(bun -e "console.log(require(\"/data/native-world.json\").world.seed)")
    submitter=$(bun -e "console.log(require(\"/data/authority.json\").address)")
    exec bun config/deployer/clean/cli/deploy-world.ts \
      --seed "$seed" --manifest /data/native-world.json \
      --identity /data/gameplay-contracts.json --submitter "$submitter" \
      --rpc-url http://madara:9944/rpc/v0_10_2 \
      --world-address-file /data/world-address \
      --release-facts /release/release-facts.json "$@"
  ' hotfix "$@"
}

# 1. Register once and write the release-to-schema map. Existing games keep their pins.
hotfix

# 2. Update Herald with that manifest BEFORE applying to any game.
docker compose run --rm --no-deps --entrypoint /bin/sh init -ec \
  'cp /data/native-world.json /public/native-world.json; chmod 0644 /public/native-world.json'
docker compose up -d --no-deps --force-recreate herald
curl --fail https://herald.example.org/health
curl --fail https://herald.example.org/manifest

# 3. Apply to explicitly chosen games as their creator.
hotfix --apply-games 1,2 --herald-url http://herald:3003
```

Step 3 reads Herald's live `/manifest` and refuses unless the release is already registered on chain and Herald lists
every release the games will traverse for this shard. The CLI advances each game one release at a time, so each
migration runs in order. Herald and the client refuse an unavailable decoder by name.

Each apply emits `GameRelease` before the migration's facts in one transaction; migration failure rolls back the pin,
data and event. Earlier successful steps remain applied if a later migration fails; retry resumes from the game's pin.
Repeating registration or applying the already pinned release submits no transaction. Downgrade is refused. To roll
back logic, register the old classes again as release N+1, with any required forward migration, then follow the same
publication and apply sequence. Never recreate genesis to recover a failed migration.
