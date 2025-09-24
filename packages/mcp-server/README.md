# Eternum MCP Server

This package hosts the Model Context Protocol (MCP) server that surfaces Eternum's live game state and transactional tools for AI agents.

## Getting Started

```bash
pnpm install
pnpm --dir packages/mcp-server build
```

## Development Commands

- `pnpm --dir packages/mcp-server dev` – build in watch mode.
- `pnpm --dir packages/mcp-server test` – run unit tests (Vitest).
- `pnpm --dir packages/mcp-server lint` – lint source files.

Refer to [`SPEC.md`](./SPEC.md) for the full architecture and implementation plan.
