# Game Documentation

The documentation site for Realms (Frontier and Blitz), built with Vocs, a React-based documentation framework.

## Getting Started

To install dependencies:

```bash
pnpm install
```

To run the development server:

```bash
pnpm run dev
```

To build for production:

```bash
pnpm run build
```

The site lives at [docs.realms.party](https://docs.realms.party). `deploy/first`'s Cloudflare command builds and
publishes it with the client from the same commit (dev: docs.dev-realms.party); see `deploy/first/README.md`.

## How the site is built

The pages say what the game does, read from the game's own code: never a number or a rule written by hand when the code
holds it.

- **Pages** (`docs/pages`): Start, Your account (sign-in, payout wallet, LORDS), Frontier, Blitz, and More (What's new,
  the developer pages, and the Eternum Season 1 archive, which no live game backs and which says so on every page).
- **Numbers** come from the modes' configs and presets: `docs/utils/frontier.ts` and `docs/utils/blitz.ts` read them,
  `docs/utils/config.ts` fails the build on a key a mode's config lacks, and `docs/utils/contract-constants.json` holds
  the few rules the contracts keep as literals, each beside the Cairo line it copies
  (`scripts/contract-constants.test.mjs` fails when that line changes).
- **Media** (`docs/components/Media.tsx`): every video and screenshot is captured from the game by one command, from the
  list in `media.json`, into `apps/game/public/docs-media`:

  ```bash
  pnpm --dir apps/game dev --host 127.0.0.1 --port <port>
  node scripts/capture-media.mjs --base https://127.0.0.1:<port> [--session <saved test player>] [--only a,b]
  ```

  Most items film the lab's fixture pages and studio. Items marked `live` play the dev stack as a saved test player.

- **Moved pages** keep their old addresses through `_redirects`.

## Checks

`pnpm run build` runs the docs' tests, builds every page, then:

- ships each file a page names from the game's public folder, and fails on a local link, image, video or redirect that
  resolves to nothing (`scripts/ship-referenced-assets.mjs`);
- checks each page states its mode's own numbers, and the text export (`llm.txt`) the same
  (`scripts/check-rendered-balance.mjs`).
