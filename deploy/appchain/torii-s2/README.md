# Single-world s2 Torii

This directory contains the local proof for serving the persistent `s2_blitz` world with an unmodified upstream
Torii. The template pins one world from block 0. It has no world-registry discovery, secondary world, or exclusion
rules.

## Render and boot

The validated image is Torii 1.8.16. The digest keeps a rerun byte-identical to the A3 spike.

```bash
A3_WORLD=0x...
A3_TORII_IMAGE=ghcr.io/dojoengine/torii@sha256:4f6633c1f8fddbc68d647e14f424c91f083c20d14a5dd4661eb0ab77841899ac

bun deploy/appchain/torii-s2/render-config.ts \
  --world "$A3_WORLD" \
  --rpc http://katana:5050 \
  --db-dir /data/torii-db-v1 \
  --output /tmp/torii-s2.toml

docker volume create torii-s2-data
docker run --rm --name torii-s2 \
  --network spike_default \
  -p 127.0.0.1:8081:8080 \
  -v torii-s2-data:/data \
  -v /tmp/torii-s2.toml:/config/torii.toml:ro \
  "$A3_TORII_IMAGE" torii --config /config/torii.toml
```

Use a new volume to prove block-0 bootstrap behavior. Reusing a volume resumes its existing checkpoint.

## Validate the client surfaces

Create two games through the appchain launch CLI and produce at least one row in each selected model. Then run:

```bash
bun deploy/appchain/torii-s2/validate-parity.ts \
  --torii-url http://localhost:8081 \
  --rpc-url http://localhost:5050 \
  --world "$A3_WORLD" \
  --game-ids 5,6 \
  --output /tmp/torii-s2-parity.json
```

The validator checks block-0 catch-up plus game isolation through SQL, GraphQL, and the Torii client gRPC transport.
It projects one model per gRPC query; an unprojected query asks SQLite to join every model and exceeds SQLite's
64-table join limit in this world.

The D16 harness needs two mutable games owned by the supplied account. It subscribes before sending the two
`sync_game_status` stimuli.

```bash
bun deploy/appchain/torii-s2/d16-verify.ts \
  --torii-url http://localhost:8081 \
  --rpc-url http://localhost:5050 \
  --world "$A3_WORLD" \
  --registrar-contract "$A3_REGISTRAR" \
  --account-address "$A3_ACCOUNT_ADDRESS" \
  --private-key "$A3_PRIVATE_KEY" \
  --game-ids 3,4 \
  --output /tmp/torii-s2-d16.json
```

The repo pins `@dojoengine/torii-client`, `@dojoengine/torii-wasm`, and `@dojoengine/sdk` to
`1.7.0-preview.3`. The public `@dojoengine/torii-client` entry is browser/WASM-oriented and does not initialize under
Bun, so the harness uses that exact release's Node binding from `@dojoengine/torii-wasm/node`; clause builders come
from `@dojoengine/sdk/node`.

## Prune settled games

Pruning is direct SQLite maintenance. Stop Torii and make a backup before execution. A dry run is the default and can
also be requested explicitly:

```bash
bun deploy/appchain/torii-s2/prune-games.ts \
  --db /path/to/torii.db \
  --game-ids 5 \
  --dry-run \
  --output /tmp/torii-s2-prune-plan.json

bun deploy/appchain/torii-s2/prune-games.ts \
  --db /path/to/torii.db \
  --game-ids 5 \
  --execute \
  --confirm-offline \
  --vacuum \
  --output /tmp/torii-s2-prune-result.json
```

`--settled-older-than-days N` is an alternative selector. Torii has no settlement timestamp in `GameRegistry`, so
the age selector uses `end_at` as a conservative proxy and still requires stored status `Settled`.

The plan discovers every `s2_blitz-*` model or event table with a `game_id` column. It deletes exact
`(entity_id, model_id)` relations and only deletes an `entities` or `event_messages` row when no model relation remains
and its key starts with the padded game felt. This matters because game 1 and preset 1 can share an entity key;
preset-scoped `ResourceList` and `ResourceMinMaxList` data must survive.

Pruning does not delete blocks, transactions, raw events, model metadata, or on-chain state. Reindexing the same world
from block 0 recreates the pruned rows. Treat this as offline cache compaction, not canonical data deletion.
