# PRD: Scroll Content Blog System

## 1. Document Control
- Product: `realms-world-site` (`san-francisco-v2`)
- Owner: Product + Frontend Engineering
- Date: February 12, 2026
- Status: Draft
- Related branch: `ponderingdemocritus/scroll-build-tests`
- Related docs:
  - `docs/scroll-md-system-scope.md`

## 2. Context and Problem Statement
Realms World needs a reliable publishing system for ecosystem updates and thought pieces.  
Today, the site has no active blog route and no markdown content pipeline wired into the app runtime.

This creates three gaps:
- publishing requires code edits instead of content-first workflow
- there is no dedicated information architecture for long-form updates
- no build-time validation exists for editorial metadata quality

## 3. Vision
Create a "Scroll" publishing surface where content lives as markdown files in-repo and is compiled at build into static site assets, with predictable URL structure and strong metadata hygiene.

## 4. Goals
1. Enable content publishing by adding `.md` files only.
2. Render all blog content from build-generated static data.
3. Ship a clear `Scroll` UX with index and article pages.
4. Preserve performance and deployment simplicity of current Vite static output.

## 5. Non-Goals
- Full CMS/WYSIWYG workflow in v1
- Server-side rendering migration
- Full-text search, RSS, tag landing pages in v1
- Complex editorial workflows (draft review, approvals, scheduled publish)

## 6. Users and Use Cases
- Core team: publish ecosystem updates quickly.
- Contributors: publish thought pieces with consistent metadata.
- Readers: discover recent updates and read long-form content in a clear, scroll-first layout.

Primary use cases:
1. Add a new update post and have it appear automatically on `/scroll`.
2. Open a specific article at `/scroll/<slug>`.
3. Filter feed by post type (`update`, `thought-piece`).

## 7. Functional Requirements

### 7.1 Content Model
Posts live in `content/scroll/` as `*.md`.

Required frontmatter:
- `title: string`
- `excerpt: string`
- `date: YYYY-MM-DD`
- `type: update | thought-piece`
- `author: string`
- `tags: string[]`
- `published: boolean`

Optional frontmatter:
- `coverImage: string` (public asset path)
- `canonicalUrl: string`

Derived fields (generator):
- `slug`
- `readingTime`
- `lastModified` (from git/file metadata if available)

### 7.2 Build-Time Generation
Build pipeline must:
1. Read `content/scroll/*.md`.
2. Parse frontmatter and markdown body.
3. Validate schema and fail build with file-specific errors.
4. Convert markdown to renderable format (HTML or AST).
5. Sort posts by `date` descending.
6. Emit generated module `src/generated/scroll-posts.ts`.

`pnpm build` must execute generator before `vite build`.

### 7.3 Routing and Pages
Required routes:
- `/scroll` (feed/index)
- `/scroll/$slug` (detail)

`/scroll` requirements:
- show only `published: true`
- newest first
- type filter tabs: `All`, `Updates`, `Thought Pieces`
- card metadata: title, date, excerpt, tags, author

`/scroll/$slug` requirements:
- render full content body
- metadata header with type/date/author/tags
- previous/next article links
- 404 behavior for unknown slugs

### 7.4 Navigation and Discoverability
- Header must include `Scroll` link to `/scroll`.
- Footer must include `Scroll` link to `/scroll`.
- Homepage can optionally include a "Latest from Scroll" teaser in phase 1.1 (not mandatory for v1 launch).

### 7.5 SEO and Social Metadata
- `/scroll` has dedicated title and description.
- Post detail sets:
  - `title`
  - `description` (from `excerpt`)
  - Open Graph title/description/image
  - Twitter title/description/image
- Canonical tag added if `canonicalUrl` exists.

## 8. Non-Functional Requirements
1. Performance:
  - no runtime markdown fetch/parsing from remote services
  - route-level code splitting for Scroll pages
2. Reliability:
  - malformed content blocks build
3. Maintainability:
  - strict schema validation and deterministic generation
4. Security:
  - markdown rendering must sanitize unsafe HTML

## 9. UX and Design Direction
- Keep existing Realms visual system; do not introduce a disconnected design language.
- "Scroll" experience should feel editorial and intentional:
  - denser vertical rhythm for feed scanning
  - strong typographic hierarchy in article pages
  - readable long-form width and spacing
- Mobile-first readability for article pages is mandatory.

## 10. Technical Architecture

### 10.1 Proposed Components
- `scripts/generate-scroll-posts.mjs` (or `.ts` run via toolchain)
- `src/generated/scroll-posts.ts` (generated artifact)
- `src/lib/scroll.ts` (selectors/helpers: get all posts, by slug, prev/next)
- `src/routes/scroll/index.tsx`
- `src/routes/scroll/$slug.tsx`

### 10.2 Dependencies
Recommended:
- `gray-matter` for frontmatter parsing
- `zod` for schema validation
- `marked` or `remark` stack for markdown compile
- `sanitize-html` (or equivalent) for safe HTML output

### 10.3 Error Handling
- Generator exits non-zero on:
  - missing required frontmatter
  - invalid date/type
  - duplicate slug
  - invalid markdown parse
- Error format includes file path and field name.

## 11. Milestones and Delivery Plan

### Milestone A: Data Pipeline
- implement generator + schema
- wire prebuild hook in `package.json`
- add sample posts

Exit criteria:
- build succeeds with valid content
- build fails clearly with invalid content

### Milestone B: Scroll Routes
- ship `/scroll` and `/scroll/$slug`
- add filtering and metadata sections
- add prev/next links

Exit criteria:
- feed and detail render from generated data only

### Milestone C: Navigation + SEO
- add header/footer links
- finalize page metadata and OG behavior
- add sitemap entries for scroll routes (list page + optional post URLs if generation strategy supports it)

Exit criteria:
- links discoverable globally
- SEO metadata present and correct

## 12. QA and Validation Plan
1. Unit tests for generator:
  - valid file parses
  - invalid frontmatter fails
  - duplicate slug fails
2. Route tests:
  - `/scroll` renders expected cards
  - `/scroll/$slug` renders expected article
  - unknown slug shows error state
3. Build verification:
  - `pnpm build` includes generated module
4. Accessibility checks:
  - heading hierarchy on detail page
  - keyboard navigation on filters and links

## 13. Success Metrics
Primary:
1. Time-to-publish reduced to a single markdown PR.
2. Zero production incidents from malformed post metadata after launch.
3. Scroll routes pass build and test gates on every release.

Secondary:
1. Increased return visits to `/scroll`.
2. Improved engagement on thought-piece content (time on page, scroll depth).

## 14. Risks and Mitigations
- Risk: markdown rendering introduces XSS vector.
  - Mitigation: sanitize rendered HTML and disallow raw HTML blocks by default.
- Risk: content schema drifts over time.
  - Mitigation: zod schema as hard gate in CI/build.
- Risk: SPA rewrite setup limits crawl depth for posts.
  - Mitigation: maintain robust metadata and sitemap updates; consider pre-render in phase 2 if needed.

## 15. Open Questions
1. Should article `slug` come from filename only, or optional explicit frontmatter override?
2. Do we require a featured post concept at launch?
3. Should canonical URLs be required for cross-posted thought pieces?
4. Should old "blogs" Keystatic collection be kept, migrated, or deprecated?

## 16. Launch Checklist
- [ ] Generator script implemented and wired into build
- [ ] At least 2 production-ready sample posts created
- [ ] `/scroll` and `/scroll/$slug` routes live
- [ ] Header/footer links verified
- [ ] SEO tags verified in built output
- [ ] Tests green (`node --test`, `pnpm build`)
