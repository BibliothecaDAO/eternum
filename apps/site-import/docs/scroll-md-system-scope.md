# Scroll Markdown Content System - Scope

## Objective

Add a markdown-driven "Scroll" section where the team publishes:

- ecosystem updates
- thought pieces

Posts are authored as `.md` files in-repo and compiled at build time into static assets served by the existing Vite site.

## Current Constraints

- App is a Vite + TanStack Router SPA with static output (`dist`) and rewrite-to-`index.html` deployment.
- There is no active runtime markdown/content ingestion in `src/`.
- Keystatic config exists, but current app routes load hardcoded TS data.

## MVP Scope (In)

### 1) Content Source

- New folder: `content/scroll/`
- One file per post: `content/scroll/<yyyy-mm-dd>-<slug>.md`
- Required frontmatter:
  - `title: string`
  - `excerpt: string`
  - `date: YYYY-MM-DD`
  - `type: update | thought-piece`
  - `author: string`
  - `tags: string[]`
  - `published: boolean`
- Optional frontmatter:
  - `coverImage: string` (public path, e.g. `/content/scroll/my-cover.jpg`)
  - `canonicalUrl: string`

### 2) Build-Time Generation

- Add prebuild content pipeline script:
  - Read all `content/scroll/*.md`
  - Parse frontmatter + markdown body
  - Validate schema and fail build on invalid metadata
  - Sort by `date` descending
  - Emit generated static module, e.g. `src/generated/scroll-posts.ts`
- Build integration:
  - `pnpm build` runs generator before `vite build`
  - Generated file is treated as source-of-truth at runtime

### 3) Routes and Pages

- New routes:
  - `/scroll` (index)
  - `/scroll/$slug` (post detail)
- `/scroll` page:
  - Chronological feed (latest first)
  - Type filter tabs: `All`, `Updates`, `Thought Pieces`
  - Card list with title, date, excerpt, tags
- `/scroll/$slug` page:
  - Full article render from generated HTML/AST
  - Metadata block: type, date, author, tags
  - Basic previous/next post links

### 4) Navigation and IA

- Add `Scroll` link in top nav next to `Games`.
- Naming in UI:
  - Section title: `Scroll`
  - Supporting copy: `Updates from the ecosystem and thought pieces`

### 5) SEO and Metadata

- Index page title/description for Scroll section.
- Post-level dynamic meta tags (`title`, `description`, `og:title`, `og:description`, `og:image` when provided).
- Canonical tag support when `canonicalUrl` exists.

### 6) Styling Direction (MVP)

- Keep existing visual system and components.
- Distinct "scroll feed" feel via:
  - tighter vertical rhythm
  - date/type metadata up front
  - long-form reading width on detail page

## Explicitly Out of Scope (V1)

- WYSIWYG CMS/editor workflow
- Full-text search
- Pagination/infinite scroll (if post count remains modest)
- Multi-author profile pages
- RSS/Atom feed
- Server-side rendering or per-route static HTML pre-rendering

## Technical Notes

- Prefer a simple, deterministic generator (Node script) over runtime markdown parsing.
- Use strict schema validation (e.g. `zod`) in generator to prevent malformed content shipping.
- Keep generated artifacts reproducible and checked in only if needed by deployment workflow (default: generated at build, not committed).

## Acceptance Criteria

1. Adding a new `.md` file under `content/scroll/` is enough to publish a new post.
2. Invalid frontmatter fails build with clear error messages.
3. `/scroll` lists only `published: true` posts in descending date order.
4. `/scroll/$slug` renders full content and correct metadata.
5. `pnpm build` produces a fully static deploy artifact with Scroll content included.

## Phase 2 (After MVP)

- RSS/Atom generation at build
- Tag landing pages (`/scroll/tag/<tag>`)
- Featured posts
- Optional migration to CMS-backed editing (Keystatic-managed authoring while preserving generated static output)
