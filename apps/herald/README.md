# Herald

Herald owns the game chain's decoded read path. It restores its confirmed per-chain fold from Postgres, replays the
confirmed gap from Madara, then maintains a replaceable pre-confirmed overlay from Madara's RPC 0.10.2 subscriptions.
Clients receive per-game snapshots, diffs, transaction status, and heads over one WebSocket.

The decoder list comes from `@bibliothecadao/eternum/game-sync-models`. The world manifest supplies selectors, fields,
and recursive ABI types; herald does not carry a second model list.

## Run

```sh
HERALD_CHAIN=madara \
HERALD_RPC_URL=http://127.0.0.1:5050/rpc/v0_10_2 \
DATABASE_URL=postgres://realms:realms@127.0.0.1:5432/realms \
pnpm --dir apps/herald start
```

The RPC URL also determines the upstream WebSocket URL (`http` → `ws`, `https` → `wss`). The process checkpoints the
confirmed fold every 100 blocks and on shutdown. It does not listen until the checkpoint gap is replayed and all three
upstream subscriptions have reconciled.

It serves:

- `GET /health`
- `GET /<chain>/games`
- `GET /<chain>/games/<game_id>/snapshot`
- `GET /<chain>/games/<game_id>/snapshot?models=WorldConfig,Structure`
- `GET /<chain>/games/<game_id>/history?model=StoryEvent&limit=50&offset=0`
- `GET /<chain>/games/<game_id>/review/snapshot`
- `GET /<chain>/games/<game_id>/transactions/count`
- `WS /<chain>/games/<game_id>`

The server sends `hello` first. The client answers `resume{epoch,seq}` with its last applied boundary; an empty epoch
requests a fresh snapshot. A matching retained boundary replays only later messages. A different epoch or an expired
boundary returns a model-chunked snapshot followed by live messages after that atomic boundary.

## Live state rule

Confirmed `getEvents` is the durable base. Pre-confirmed subscription events are latency hints deduplicated by
`(transaction_hash,event_index)`. On each confirmed head Herald applies the closed block, emits `overlay_reset`, and
rebuilds the overlay from exactly one `getBlockWithReceipts("pre_confirmed")` read. Transaction receipts are a separate
channel because a reverted transaction has no Store event; the sender is resolved once and matched against the
`BlitzSettlement` accounts in the fold.

## Herald encodings

Two encodings arrive on the same world event stream, and the decoder picks by event kind:

- **Store records** (`StoreSetRecord`, `StoreUpdateRecord`, `StoreUpdateMember`) carry Dojo's introspect layout: enum
  selectors are **one-based** (proved by the parity gate row-for-row on 229k rows).
- **Event messages** (`EventEmitted`, i.e. `world.emit_event`) are plain **Cairo serde**: enum selectors are zero-based
  and `Option` is `Some = 0, payload` / `None = 1`. Read off the chain on 2026-08-28 from `StoryEvent` at block 117558
  (`story` selector `0xc` = `GuardAddStory`, keys `owner = [0x0, address]`); the one-based rule there picked
  `ResourceReceiveArrivalStory` and read a structure id as an array length, and a `RealmCreatedStory` (`0x0`) had no
  variant at all — both were fatal until this rule.

No persistent sync model carries an `Option`; if one ever does, its store encoding is measured, not assumed.

## A.2 lab gate — 2026-08-27

- Genesis replay: 2,933,882 decoded events and 229,254 retained rows; 314.648 s on the loaded lab host (the approved A.1
  run was 147 s). The compressed Postgres checkpoint was 18,452,282 bytes.
- Checkpoint restart: block 97073 → head 97156 (83-block gap) to ready in **7.837 s**. The new process epoch differed,
  and its 35-model/5,155-row game-54 snapshot matched a fresh Herald snapshot byte-for-byte.
- Socket resume: the socket was dropped after sequence 2; the same epoch replayed `[3,4,5,6]`, with no snapshot and no
  gap.
- Forced replacement: the A.0 repeat/replacement fixture deduplicates the repeated hint, emits `overlay_reset`, and
  rebuilds to the same state as a fresh snapshot (`live-world.test.ts`).
- Reverted action: gameplay account `0x07e6075c…f39a9` settled in game 55, repeated `settle`, and received `tx` sequence
  64 with status `REVERTED` and `"Eternum: Player is already settled"` for transaction `0x344f0bcd…bb9b8`.
