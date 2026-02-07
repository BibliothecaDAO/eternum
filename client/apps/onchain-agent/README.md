# Onchain Agent (CLI)

This app runs the Eternum autonomous agent in a terminal (TUI + CLI loop).

## Run in CLI

1. Ensure your Eternum backend endpoints are reachable (`RPC_URL`, `TORII_URL`) and your manifest/world values are set.
2. Create local env config:

```bash
cd client/apps/onchain-agent
cp .env.example .env
```

3. Update `.env` with at least:
- `RPC_URL`
- `TORII_URL`
- `WORLD_ADDRESS`
- `MANIFEST_PATH`
- `PRIVATE_KEY`
- `ACCOUNT_ADDRESS`
- `LOOP_ENABLED` (`true` or `false`)
- `MODEL_PROVIDER` and `MODEL_ID`
- matching API key (for example `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)

4. Start the agent from the repository root:

```bash
pnpm --dir client/apps/onchain-agent dev
```

The agent starts in the terminal UI and begins ticking automatically.  
Press `Ctrl+C` to shut it down gracefully.

## HEARTBEAT.md Jobs (Cron-Style)

Recurring jobs are defined in `client/apps/onchain-agent/data/HEARTBEAT.md`.
The scheduler hot-reloads this file during runtime, so edits apply without restart.

Job format:

```yaml
version: 1
jobs:
  - id: market-check
    enabled: true
    schedule: "*/10 * * * *"
    mode: observe
    timeoutSec: 90
    prompt: |
      Check market conditions and summarize opportunities.
```

- `schedule` uses 5-field cron: `minute hour day month dayOfWeek`.
- `mode: observe` adds guidance not to execute on-chain actions.
- `mode: act` allows action-taking if the prompt decides it.
- The agent can manage this file itself via existing `read`/`write` tools.

## Live Self-Reconfiguration (No Restart)

The running agent can reconfigure itself through tools:
- `get_agent_config`: read live config
- `set_agent_config`: apply one or more live config changes

Supported paths (including aliases like `world.rpcUrl`, `model.id`, `loop.enabled`):
- `rpcUrl`
- `toriiUrl`
- `worldAddress`
- `manifestPath`
- `privateKey`
- `accountAddress`
- `tickIntervalMs`
- `loopEnabled`
- `modelProvider`
- `modelId`
- `dataDir`

Example tool call payload for faster ticks:

```json
{
  "changes": [
    { "path": "tickIntervalMs", "value": 15000 }
  ],
  "reason": "need faster reaction loop"
}
```

Example payload for hot-swapping world connectivity:

```json
{
  "changes": [
    { "path": "rpcUrl", "value": "http://127.0.0.1:5050" },
    { "path": "toriiUrl", "value": "http://127.0.0.1:8080" },
    { "path": "worldAddress", "value": "0x123" },
    { "path": "manifestPath", "value": "/abs/path/to/manifest.json" }
  ],
  "reason": "switching to new world"
}
```
