# Game Documentation

This app is the Vocs-based documentation site for Eternum.

## Getting Started

From the repo root:

```bash
pnpm install
pnpm dev:docs
```

From this directory:

```bash
pnpm run dev
```

Production build:

```bash
pnpm run build
```

## Doc Structure

The content under `docs/pages` is organized by audience and game mode:

- `overview/`: shared product and ecosystem pages
- `blitz/`: Blitz-specific gameplay and rules
- `eternum/`: Eternum season documentation and legacy mode details
- `development/`: developer documentation for the client, contracts, SDK, collaborators, and Axis
- `changelog/`: dated release notes

The site also includes:

- `docs/components/`: reusable React components embedded in MDX pages
- `docs/utils/`: resource metadata, formatting helpers, and shared config inputs
- `vocs.config.ts`: navigation, theme, and site configuration
- `vite-plugin-llm-txt.mjs`: LLM-friendly output generation

## Operating Model

Use this README for docs app setup and structure.

Use these entrypoints for content ownership:

- Repo docs index: [`docs/README.md`](../../../docs/README.md)
- Game client README: [`client/apps/game/README.md`](../game/README.md)
- Repo overview: [`README.md`](../../../README.md)
