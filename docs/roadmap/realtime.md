# Realtime Communication (Build Plan)

> NOTE: This is an internal engineering plan / roadmap. It is linked from the repo README to avoid mixing roadmap
> content into the project landing page.

## Build plan

1. Bootstrap `apps/realtime-server` with Fastify + Socket.IO, pnpm scripts, and environment scaffolding.
2. Define shared TypeScript contracts and validation in a new `packages/realtime-schema` workspace package.
3. Model Prisma schema for notes, world chat, DM threads/messages, and run the initial migration.
4. Implement server handlers for HTTP history endpoints and realtime rooms (world, zone, location, direct) with username
   auth and rate limits.
5. Ship `packages/realtime-client` to wrap the Socket.IO transport with reconnection, buffering, and typed events.
6. Wire new feature slices in `client/apps/game` for notes, world chat, and DMs, including UI panels and map overlays.
7. Add moderation tooling, automated tests, and deployment docs/observability before opening the feature for QA.
