# Axis

Autonomous AI agent that plays Eternum on StarkNet. Discovers active game worlds, authenticates via Cartridge Controller,
and runs an LLM-driven tick loop that executes on-chain actions.

## Install

```bash
curl -fsSL https://github.com/bibliothecadao/eternum/releases/latest/download/install-axis.sh | bash
```

Pin a version with `VERSION=v0.1.0 bash`. See [INSTALL.md](INSTALL.md) for rollback/uninstall.

## Quick Start (Interactive)

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> ~/.eternum-agent/.env
axis
```

Discovers worlds, opens browser for auth, starts the agent. Everything auto-initializes on first run.

## Quick Start (Headless)

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> ~/.eternum-agent/.env
axis auth my-world --method=password --username=me --password=secret
axis run --headless --world=my-world
```

Password auth creates a Cartridge Controller session with paymaster support. Sessions last 7 days.

## Fleet Setup

```bash
axis auth --all --method=password --username=me --password=secret --json > /tmp/auth.json
for world in $(jq -r '.[].world' /tmp/auth.json); do
  axis run --headless --world="$world" --api-port=$((3000+RANDOM%1000)) &
done
```

## Build from Source

```bash
git clone https://github.com/bibliothecadao/eternum.git && cd eternum
pnpm install
pnpm --dir packages/types build
pnpm --dir packages/torii build
pnpm --dir packages/provider build
pnpm --dir packages/client build
pnpm --dir packages/game-agent build
cd client/apps/onchain-agent
cp .env.example .env
pnpm dev
```

Standalone binary (requires [Bun](https://bun.sh)):

```bash
cd client/apps/onchain-agent
bun run build.ts --compile    # produces ./axis
```

Always use `build.ts` -- direct `bun build` skips plugins that embed WASM and manifests.

## Documentation

Full docs at the [Axis docs site](https://eternum-docs.realms.world/development/axis/overview):

- [CLI Reference](https://eternum-docs.realms.world/development/axis/cli-reference)
- [Worlds and Auth](https://eternum-docs.realms.world/development/axis/worlds-and-auth)
- [Headless and API](https://eternum-docs.realms.world/development/axis/headless-and-api)
- [Configuration](https://eternum-docs.realms.world/development/axis/configuration-and-operations)

## Testing

```bash
pnpm --dir client/apps/onchain-agent test
pnpm --dir client/apps/onchain-agent test:watch
```
