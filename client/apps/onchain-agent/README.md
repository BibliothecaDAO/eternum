# Axis (CLI)

Axis runs the Eternum autonomous agent in a terminal (TUI + CLI loop).

## Public Install

Install latest public release:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | bash
```

Install a pinned release:

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | VERSION=v0.1.0 bash
```

More install/rollback/uninstall details: `client/apps/onchain-agent/INSTALL.md`.

## Commands

```bash
pnpm --dir client/apps/onchain-agent dev     # run
pnpm --dir client/apps/onchain-agent doctor  # validate local config
pnpm --dir client/apps/onchain-agent init    # scaffold local files
pnpm --dir client/apps/onchain-agent package:release  # build release archives + checksums
```

## Build Release Archives

Generate release archives for all supported V1 targets:

```bash
pnpm --dir client/apps/onchain-agent package:release
```

Useful flags:

- `--targets darwin-arm64,linux-x64` to limit targets
- `--outDir /tmp/onchain-release` to change output directory
- `--version 0.1.0` to override package version
- `--skipBuild --binaryPath /path/to/axis` for packaging-only flows

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
- `ETERNUM_AGENT_HOME` (optional, defaults to `~/.eternum-agent`)
- `DATA_DIR` (optional override, defaults to `$ETERNUM_AGENT_HOME/data`)
- `CHAIN_ID` (e.g. `SN_SEPOLIA`)
- `GAME_NAME` (default: `eternum`)
- `LOOP_ENABLED` (`true` or `false`)
- `MODEL_PROVIDER` and `MODEL_ID`
- matching API key (for example `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)

4. Start the agent from the repository root:

```bash
pnpm --dir client/apps/onchain-agent dev
```

## Cartridge Controller Authentication

The agent authenticates via the [Cartridge Controller](https://github.com/cartridge-gg/controller) session flow. No
private keys are stored in config — instead, the agent requests a session that the human approves in their browser.

### How it works

1. **Agent starts** — calls `ControllerSession.connect()`
2. **Existing session?** — checks `SESSION_BASE_PATH/session.json` on disk. If a valid (non-expired) session exists, the
   agent reconnects immediately with no browser step.
3. **No session?** — the agent prints an auth URL to stdout:
   ```
   Connecting to Cartridge Controller...
   https://x.cartridge.gg/session?public_key=0x...&redirect_uri=http://localhost:54321/callback&policies=...
   ```
4. **Human opens the URL** — reviews the session policies and approves with their Cartridge account (Passkeys/WebAuthn).
5. **Callback received** — the browser redirects to the agent's local HTTP server. The session is saved to
   `.cartridge/session.json`.
6. **Agent is live** — the `SessionAccount` can now execute transactions. `executeFromOutside` is tried first
   (paymaster-sponsored, no gas needed), falling back to direct execution.

### Session persistence

The session persists to `SESSION_BASE_PATH` (default: `~/.eternum-agent/.cartridge/`). Restarting the agent reconnects
from the stored session without re-auth. Sessions have an expiration — when expired, the auth flow triggers again
automatically.

### Configuration

| Env var              | Default                          | Description                                                                                    |
| -------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `CHAIN_ID`           | `SN_SEPOLIA`                     | StarkNet chain ID (`SN_SEPOLIA`, `SN_MAIN`, or Dojo slot/katana encoded IDs)                   |
| `ETERNUM_AGENT_HOME` | `~/.eternum-agent`               | Base directory for runtime files                                                               |
| `DATA_DIR`           | `$ETERNUM_AGENT_HOME/data`       | Data directory for soul/tasks/heartbeat                                                        |
| `SESSION_BASE_PATH`  | `$ETERNUM_AGENT_HOME/.cartridge` | Directory for session storage                                                                  |
| `GAME_NAME`          | `eternum`                        | Game namespace used to select policy contracts from manifest tags (for example `s1_eternum-*`) |

### Runtime requirements

Node.js 20+ with `--experimental-wasm-modules` (already set in the `dev` script). The `@cartridge/controller-wasm`
package provides WASM bindings for session signing.

---

The agent starts in the terminal UI and begins ticking automatically. Press `Ctrl+C` to shut it down gracefully.

## HEARTBEAT.md Jobs (Cron-Style)

Recurring jobs are defined in `client/apps/onchain-agent/data/HEARTBEAT.md`. The scheduler hot-reloads this file during
runtime, so edits apply without restart.

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
- `gameName`
- `chainId`
- `sessionBasePath`
- `tickIntervalMs`
- `loopEnabled`
- `modelProvider`
- `modelId`
- `dataDir`

Example tool call payload for faster ticks:

```json
{
  "changes": [{ "path": "tickIntervalMs", "value": 15000 }],
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
