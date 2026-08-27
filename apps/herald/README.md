# Herald

Herald owns the game chain's decoded read path. This A.1 slice replays confirmed Dojo Store events into an in-memory
fold and serves per-game snapshots. Pre-confirmed overlays, live diffs, resume, and checkpoints belong to A.2.

The decoder list comes from `@bibliothecadao/eternum/game-sync-models`. The world manifest supplies selectors, fields,
and recursive ABI types; herald does not carry a second model list.

## Run

```sh
HERALD_CHAIN=madara \
HERALD_RPC_URL=https://rpc.realms.test/rpc/v0_10_2 \
pnpm --dir apps/herald start
```

The process captures one confirmed block at startup, folds through that boundary, then serves:

- `GET /health`
- `GET /<chain>/games/<game_id>/snapshot`
- `GET /<chain>/games/<game_id>/snapshot?models=WorldConfig,Structure`

## Torii parity gate

Until A.4 deletes Torii, its current model tables are the snapshot oracle:

```sh
HERALD_GAME_ID=53 \
HERALD_RPC_URL=https://rpc.realms.test/rpc/v0_10_2 \
TORII_URL=https://torii.realms.test \
pnpm --dir apps/herald parity
```

The gate captures Torii's latest raw world-event block, replays Madara through the same block, compares every persistent
sync model by entity and field, then verifies that Torii's boundary did not move during comparison. It exits nonzero on
any mismatch.
