# A3 implementation notes

Validated locally on 2026-08-09 against the existing `deploy/appchain/spike` Katana and the A2 `s2_blitz` world at
`0x041bbb8900b623206178b90739e1b645fe5c6a1bc83a242c528296ee0cd10a46`.

## Upstream Torii and config

- Selected official `ghcr.io/dojoengine/torii:v1.8.16`: `torii 1.8.16 (main fe3ed0f)`, image digest
  `sha256:4f6633c1f8fddbc68d647e14f424c91f083c20d14a5dd4661eb0ab77841899ac`.
- This release reports native RPC spec 0.9 support and warns when connected to the spike's RPC 0.10 endpoint. It
  continued without a compatibility failure, and every A3 query/subscription surface passed.
- The rendered config contains one `WORLD` contract, namespace `s2_blitz`, and `world_block = 0`. It keeps pending,
  pre-confirmed, controller, transaction, and raw-event indexing. There are no registry models, exclusions, or s1
  namespaces.
- A fresh-volume boot exposed the HTTP endpoint at `15:04:19.177Z` and had indexed the block-0 fixture records and
  contract head by approximately `15:04:20.264Z`: **1.087 seconds** on the local 2,930-block spike chain.

## Upstream parity matrix

The parity fixtures were registrar games 5 and 6 (`a3-parity-g5`, `a3-parity-g6`). Their create transactions were
`0x39da1a0276ed043214ccfc90c349cba8151f03cdd1f4cff2b657ab48b8b2fba` and
`0x69dd7d3accdaca9e78d7845298250d0ddcbbf41d146b7fc08dd6f1814831df5`. One reserved hyperstructure was materialized in
each game to produce genuine Structure and Resource rows at overlapping model shapes.

| Surface             | Result | Observation                                                                             |
| ------------------- | ------ | --------------------------------------------------------------------------------------- |
| Block 0 to head     | PASS   | Torii contract head 2,987 matched Katana when the final matrix ran.                     |
| SQL `WHERE game_id` | PASS   | Per game: GameRegistry 1, Structure 1, TileOpt 25, Resource 1; no cross-game ids.       |
| GraphQL `game_idEQ` | PASS   | All four model connections returned only the requested game; no panic.                  |
| gRPC entity fetch   | PASS   | All four projected model queries decoded nested members with no ambiguous-column error. |

An unprojected gRPC entity query attempts to join all 78 registered models and hits SQLite's 64-table join limit. The
client-facing proof therefore uses the Torii query's model projection, which is also the intended client request shape.

## D16 query and subscription matrix

The harness used the exact repo/client versions: `@dojoengine/torii-client`, `@dojoengine/torii-wasm`, and
`@dojoengine/sdk` at `1.7.0-preview.3`. The browser-oriented `@dojoengine/torii-client` entry fails to initialize under
Bun (`wasm.__wbindgen_start is not a function`), so the same release's `@dojoengine/torii-wasm/node` binding provided
the client and `@dojoengine/sdk/node` built clauses.

Games 3 and 4 were both owned by `0x0127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec`.
`GameRegistry.creator` was used as the player-address member for the composite shape. The harness subscribed first,
synced game 3 in transaction `0x6c61247a1b22e0f71fcd3f01e38a5c8b343ad221026bb5a4c772b4ca5921cf2`, waited for every
callback, then synced game 4 in `0x7b66c6c49195abfd3f71495b5cfdd49ebac95c404fee5dc3f4ab76060fa28d8` and observed no
game-4 callback.

| Clause shape                       | Query | Subscription | Exact observation                          |
| ---------------------------------- | ----- | ------------ | ------------------------------------------ |
| key prefix for game 3              | PASS  | PASS         | `[3]`; one game-3 update                   |
| same prefix while game 4 mutates   | PASS  | PASS         | game 4 absent from query and callback sets |
| member `GameRegistry.game_id == 3` | PASS  | PASS         | `[3]`; one game-3 update                   |
| game prefix + `creator == player`  | PASS  | PASS         | `[3]`; one game-3 update                   |

Exact clause payloads:

```json
{
  "keys": {
    "Keys": {
      "keys": ["0x3"],
      "pattern_matching": "VariableLen",
      "models": ["s2_blitz-GameRegistry"]
    }
  },
  "member": {
    "Member": {
      "model": "s2_blitz-GameRegistry",
      "member": "game_id",
      "operator": "Eq",
      "value": { "Primitive": { "U32": 3 } }
    }
  },
  "composite": {
    "Composite": {
      "operator": "And",
      "clauses": [
        {
          "Keys": {
            "keys": ["0x3"],
            "pattern_matching": "VariableLen",
            "models": ["s2_blitz-GameRegistry"]
          }
        },
        {
          "Member": {
            "model": "s2_blitz-GameRegistry",
            "member": "creator",
            "operator": "Eq",
            "value": {
              "Primitive": {
                "ContractAddress": "0x0127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec"
              }
            }
          }
        }
      ]
    }
  }
}
```

## Pruning measurement

The initial stock index, before A3 created games, occupied 5,809 SQLite pages: **23,793,664 logical bytes**. The final
A3 pre-prune snapshot contained the two D16 games plus the two parity games and their materialized hyperstructures. Its
main database was **25,030,656 bytes** (6,115 pages / 25,047,040 logical bytes, plus a 1,133,032-byte WAL).

Game 5 was advanced past its grace period on local Katana and marked `Settled`; game 6 remained `Ended`. The dry run
found 57 game-scoped tables and nonzero game-5 rows in AgentConfig, GameCreated, GameMapConfig, GameRegistry,
Hyperstructure, HyperstructureGlobals, Resource, Structure, StructureOwnerStats, TileOpt, and WorldConfig. It planned 34
entity-model relations, one event-model relation, 28 orphan entities, and one orphan event message.

After pruning game 5 and running VACUUM plus WAL checkpoint, the database was **24,088,576 bytes** (5,881 pages), a
942,080-byte reduction in the main file. Verification found zero game-5 rows in every discovered game-scoped table. Game
6 retained its GameRegistry, Structure, 25 TileOpt, and Resource rows; preset 1 and all 203 preset-1 ResourceList rows
remained. A target at `Ended` status was rejected with `status is Ended, not Settled`.

The size series is representative rather than a clean two-game delta because the persistent spike already contained A2
games and D16 needed a separate pair. The deletion cycle itself used a played game and an untouched sibling in the same
offline snapshot.

## Pruning boundaries and escalation

- Entity keys are padded felt segments. Game id 1 collides with preset id 1, so key-prefix deletion alone would corrupt
  preset data. The script removes exact model relations first and deletes only genuinely orphaned, game-prefixed
  entity/event rows.
- `ResourceList` and `ResourceMinMaxList` are preset-scoped and intentionally excluded because they have no `game_id`.
- Historical entity/event-message rows are removed when present. Blocks, transactions, raw events, model metadata, and
  other chain-wide Torii bookkeeping remain.
- This is offline cache compaction. Reindexing from block 0 restores the rows because on-chain state is unchanged.
- `--settled-older-than-days` uses `GameRegistry.end_at`; no settled-at timestamp exists.
- The local A2 bootstrap copied legacy nonzero collectible addresses into ChainConfig. A real Blitz `settle` therefore
  tried `create_lock` against a Katana account contract and reverted before any Torii behavior was exercised. D16 used
  registrar status sync, and parity used reserved-hyperstructure materialization. The deployed dev appchain has the
  documented zero peripheral addresses, so this is a stale local-fixture limitation, not a Cairo or Torii gap.

## Reviewer follow-up

Stand up the parallel vanilla `torii-s2` service with the pinned config, re-run the D16 harness against that endpoint,
and point A4 work at it. The existing production Torii fork must continue serving s1 until the A5 cutover.
