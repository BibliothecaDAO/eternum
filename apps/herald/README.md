# Herald

Herald restores the native world's confirmed fold from PostgreSQL, replays the gap from Madara block receipts, and
maintains a replaceable pre-confirmed overlay through RPC subscriptions. Clients receive game-scoped snapshots, ordered
diffs, ticket outcomes and heads over one WebSocket.

The native release manifest identifies domain addresses and codecs. Generated schema artifacts describe keys, member
ownership and recursive Cairo types. An address remains authoritative through a compatible class upgrade; unknown event
shapes are explicit ingestion faults.

## Run

```sh
HERALD_CHAIN=madara \
HERALD_RPC_URL=http://127.0.0.1:5050/rpc/v0_10_2 \
NATIVE_WORLD_MANIFEST=/absolute/path/to/native-manifest.json \
DATABASE_URL=postgres://realms:realms@127.0.0.1:5432/realms \
pnpm --dir apps/herald start
```

Use a separate database and native manifest for each isolated world. The RPC URL determines the upstream WebSocket URL.
The confirmed fold checkpoints every 100 blocks and on shutdown. Startup replays the checkpoint gap and reconciles the
upstream subscriptions before serving.

## Client endpoints

- `GET /health`
- `GET /<chain>/games`
- `GET /<chain>/games/<game_id>/snapshot`
- `GET /<chain>/games/<game_id>/snapshot?models=SliceRules,Structure`
- `GET /<chain>/games/<game_id>/leaderboard`
- `GET /<chain>/games/<game_id>/history?model=StoryEvent&limit=50&offset=0`
- `GET /<chain>/games/<game_id>/review/snapshot`
- `GET /<chain>/games/<game_id>/transactions/count`
- `WS /<chain>/games/<game_id>`

The server sends `hello`. The client answers `resume{epoch,seq}` with its last applied boundary; an empty epoch requests
a snapshot. A retained boundary replays later messages. An expired or different epoch returns a model-chunked snapshot
followed by live messages after that atomic boundary.

## Fold and recovery

Confirmed receipts are authoritative. Pre-confirmed receipts are provisional and deduplicated by transaction/event
identity. A confirmed head resets the overlay and rebuilds it from the current pre-confirmed block. All domain events in
one transaction are validated together before any of its rows become visible.

Malformed pre-confirmed receipts are rejected atomically and counted without killing the subscription. An incompatible
confirmed receipt halts the authoritative fold explicitly; skipping it would publish incomplete game state. Transaction
messages retain each recorded ticket's outcome, including mixed success and rejection within one transaction.

Current facts live in the fold and the client's native store. Immutable story history may have a SQL read model, but it
is not a fallback source for current rows. A game's review snapshot freezes once after finalization, with its frozen
marker persisted across restarts.

```sh
pnpm --dir apps/herald test
pnpm --dir apps/herald typecheck
```
