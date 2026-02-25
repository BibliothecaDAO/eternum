# Axis Headless Mode Design

**Date**: 2026-02-21 **Status**: Approved

## Goal

Make Axis fully scriptable so an AI orchestrator can spawn, authenticate, steer, and monitor one or many Axis instances
— all via CLI commands and structured JSON. No TUI, no browser, no human required at runtime.

## Use Cases

- **Remote server fleet**: Multiple Axis bots on a VPS/cloud, orchestrated by an AI agent
- **Single remote bot**: One Axis instance on a remote server, human occasionally steers via API
- Both require headless operation with no local desktop/browser

## Command Surface

```
axis worlds [--json]                              List discovered worlds
axis auth <world|--all> [--approve] [--json]      Generate policies + auth URL, persist artifacts
      --method=password|google|discord             Auth method for --approve
      --username=<user> --password=<pass>          Credentials for --approve
axis auth-status <world|--all> [--json]           Check session validity
axis auth-url <world>                              Print raw auth URL (for piping)
axis run [--json]                                  Current TUI mode (default)
axis run --headless --world=<name>                 Headless mode with NDJSON output
      --auth=session|privatekey                    Auth strategy (default: session)
      --api-port=<port> [--api-host=<host>]        Enable HTTP steering API
      --stdin                                      Enable stdin steering
      --verbosity=quiet|actions|decisions|all       Output verbosity
axis doctor [--json]                               Health check
axis init                                          Seed data/session dirs (unchanged)
axis --version                                     Print version (unchanged)
```

## Artifact Persistence

Every `axis auth <world>` writes artifacts to a known directory. Subsequent commands read from there — no complex
argument passing needed.

```
~/.eternum-agent/sessions/<worldName>/
  profile.json         World profile (chain, rpc, torii, worldAddress, tokens)
  manifest.json        Resolved manifest with live contract addresses
  policy.json          Generated session policies (contracts + methods + messages)
  auth.json            Auth metadata: { url, status, createdAt, expiresAt, worldName, chain }
  .cartridge/          Cartridge session credentials (managed by SessionProvider)
```

Rules:

- `axis auth <world>` overwrites profile/manifest/policy/auth.json every time (world config can change between games)
- `.cartridge/` is managed by SessionProvider — Axis never writes to it directly
- `axis auth-status <world>` reads auth.json + probes .cartridge/ session validity
- `axis run --headless --world=<name>` reads profile.json + manifest.json to bootstrap, skips discovery entirely
- All paths are deterministic from worldName alone

## Auth Flows

### Path A: Browser Auth (via agent-browser or remote human)

```
axis auth <world> --json
  -> discovers world, resolves manifest, builds policies
  -> creates SessionProvider, triggers connect()
  -> captures auth URL (suppresses browser open in headless)
  -> writes all artifacts to sessionBasePath/<world>/
  -> outputs JSON: { url, status: "pending", artifactDir }
  -> polls for up to 6 minutes waiting for approval
```

Approval is completed externally (agent-browser, human in browser, etc.) or via `--approve`:

```
axis auth <world> --approve --method=password --username=bot1 --password=$PASS --json
  -> same as above, then shells out to agent-browser commands:
     agent-browser open <url>
     agent-browser wait --load networkidle
     agent-browser snapshot -i
     agent-browser fill @eN <username>
     agent-browser fill @eN <password>
     agent-browser click @eN (submit)
     agent-browser wait --load networkidle
     agent-browser snapshot -i
     agent-browser click @eN (approve policies)
     agent-browser close
  -> updates auth.json: { status: "active" }
```

Batch auth for all worlds:

```
axis auth --all --approve --method=password --json
  -> discovers all worlds
  -> runs auth + approve for each sequentially
  -> outputs JSON array of results
```

If agent-browser is not installed, `--approve` fails with:
`"agent-browser not found -- install it or complete auth manually at: <url>"`

### Path B: Headless Private Key (no browser ever)

```
PRIVATE_KEY=0x... axis run --headless --world=<name> --auth=privatekey
  -> reads profile.json + manifest.json from artifacts
  -> creates starknet.js Account directly with private key
  -> skips SessionProvider entirely
  -> no browser, no auth URL, no polling
```

Loses Controller paymaster/session benefits but is fully autonomous from second zero.

### Session Lifecycle

```
axis auth-status <world> --json
  -> { status: "active" | "expired" | "none", address, expiresAt }

When expired, AI re-runs: axis auth <world> --approve --json
```

## Headless Runtime & JSON Output

### NDJSON Event Stream

`axis run --headless` emits one JSON object per line to stdout:

```jsonl
{"type":"startup","world":"eternum-s1","chain":"slot","address":"0x...","ts":"..."}
{"type":"tick","id":1,"state":{...},"ts":"..."}
{"type":"decision","tick":1,"reasoning":"...","actions":[...],"ts":"..."}
{"type":"action","tick":1,"action":"guard_add","params":{...},"status":"ok","txHash":"0x...","ts":"..."}
{"type":"heartbeat","job":"resource-check","mode":"observe","ts":"..."}
{"type":"prompt","source":"http","content":"...","ts":"..."}
{"type":"session","status":"expired","world":"eternum-s1","ts":"..."}
{"type":"error","message":"...","ts":"..."}
{"type":"shutdown","reason":"SIGTERM","ts":"..."}
```

### Event Types

| Type      | When                     | Key Fields                           |
| --------- | ------------------------ | ------------------------------------ |
| startup   | Agent initialized        | world, chain, address                |
| tick      | Tick cycle starts        | id, state summary                    |
| decision  | LLM decides what to do   | reasoning, planned actions           |
| action    | On-chain action executed | action, params, status, txHash/error |
| heartbeat | Heartbeat job runs       | job id, mode                         |
| prompt    | External prompt received | source (http/stdin), content         |
| session   | Session status change    | status (active/expired/refreshing)   |
| error     | Non-fatal error          | message                              |
| shutdown  | Agent stopping           | reason                               |

### Verbosity Levels

```
--verbosity=quiet      Errors + session events only
--verbosity=actions    + action results
--verbosity=decisions  + decisions, heartbeats (default)
--verbosity=all        + tick state dumps, prompts
```

### Stream Separation

- stdout: NDJSON events only (machine-readable, pipeable)
- stderr: Human-readable warnings, fatal errors

## Steering API

### HTTP API

Enabled with `--api-port`:

```
axis run --headless --world=my-world --api-port=3000
```

| Method | Path      | Purpose                     |
| ------ | --------- | --------------------------- |
| POST   | /prompt   | Send prompt to agent        |
| GET    | /status   | Agent status, tick, session |
| GET    | /state    | Latest world state snapshot |
| GET    | /events   | SSE stream of NDJSON events |
| POST   | /config   | Update runtime config       |
| POST   | /shutdown | Graceful shutdown           |

Binds to 127.0.0.1 by default. Use `--api-host=0.0.0.0` for network access (behind firewall). No built-in auth — use SSH
tunneling or reverse proxy for remote access.

### Stdin Pipe

Enabled with `--stdin` (or auto-detected when stdin is a pipe). One JSON object per line:

```jsonl
{"type":"prompt","content":"build more farms"}
{"type":"config","changes":[{"path":"tickIntervalMs","value":30000}]}
{"type":"shutdown","reason":"done"}
```

### Both Together

```
axis run --headless --world=my-world --api-port=3000 --stdin
```

Both feed into the same prompt queue. Events emit to both stdout and /events SSE.

## End-to-End Fleet Script

```bash
#!/bin/bash
# 1. Auth all worlds
axis auth --all --approve --method=password \
  --username="$BOT_USER" --password="$BOT_PASS" --json \
  > /tmp/auth-results.json

# 2. Launch headless agents
for world in $(jq -r '.[] | select(.status=="active") | .name' /tmp/auth-results.json); do
  axis run --headless \
    --world="$world" \
    --api-port="$((3000 + RANDOM % 1000))" \
    --verbosity=decisions \
    > "logs/${world}.jsonl" 2> "logs/${world}.err" &
  echo "Started $world (pid $!)"
done

# 3. Steer
curl -X POST http://localhost:3042/prompt \
  -d '{"content":"prioritize hyperstructure contributions"}'

# 4. Monitor
tail -f logs/eternum-s1.jsonl | jq 'select(.type=="action")'
```

## Architecture Changes

| Component             | Current                          | New                                     |
| --------------------- | -------------------------------- | --------------------------------------- |
| cli.ts                | 4 commands (run/init/doctor/ver) | + worlds, auth, auth-status, auth-url   |
| index.ts              | TUI-only orchestration           | Split into TUI path + headless path     |
| controller-session.ts | Always opens browser             | Suppress browser in headless, emit URL  |
| New: output/          | --                               | JSON event emitter, verbosity filtering |
| New: api/             | --                               | HTTP server (node:http)                 |
| New: auth-approve.ts  | --                               | agent-browser shell-out script          |
| config.ts             | Env vars only                    | + CLI flags merged over env vars        |
| Session dir           | Flat .cartridge/ per world       | + profile/manifest/policy/auth.json     |

## What Stays the Same

- `axis run` with no flags: identical TUI experience
- EternumGameAdapter, action registry, world state builder
- Heartbeat loop, tick loop, runtime config hot-swap
- game-agent framework
- Build pipeline (Bun binary)

## Dependencies

- No new heavy deps. HTTP server uses node:http.
- Auth approval shells out to agent-browser (external, optional).
- --auth=privatekey uses existing starknet package Account class.
