# config

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

<!-- dev -->

`bun --env-file=../client/.env.development index.ts`

<!-- prod -->

`bun --env-file=../client/.env.production index.ts`

## Batched config deployment (multicall)

You can batch all configuration transactions into a single multicall and optionally force specific entrypoints to
execute immediately:

```bash
# Batch all config txs into one multicall
CONFIG_BATCH=1 bun run index.ts

# Batch all, but execute selected entrypoints immediately
CONFIG_BATCH=1 CONFIG_IMMEDIATE_ENTRYPOINTS="set_world_config,set_blitz_previous_game" bun run index.ts
```

Notes:

- When batching is enabled, inter-call sleeps are skipped for speed.
- Immediate entrypoints run as normal transactions before the final multicall flush.

Programmatic control inside scripts:

- Import `markImmediateEntrypoints` from `config/deployer/tx-batcher` and call it while batching is enabled to toggle
  entrypoints to execute immediately.

```ts
import { withBatching, markImmediateEntrypoints } from "./tx-batcher";

await withBatching(provider, account, async () => {
  // Run your config flow here
  markImmediateEntrypoints(provider, ["set_world_config"]);
  await config.setupAll(account, provider);
});
```
