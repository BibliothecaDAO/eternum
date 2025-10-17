# Realtime Communication Stack

## Phased Plan

1. **Discovery** – Map current Blitz auth/session handshake (JWT plus Starknet identifiers), catalogue existing realtime
   endpoints or polling flows, identify Torii integration points and map interaction hooks, and list infrastructure
   prerequisites (Redis, BullMQ, load balancer behaviour).
2. **Schema & Validation** – Design Drizzle schema tables (`Note`, `ChatMessage`, `DirectMessageThread`,
   `DirectMessage`) with required indexes, draft shared Zod schemas in `common/validation`, outline Redis data
   structures for presence and typing, and prepare migration and rollback strategy.
3. **Server Foundations** – Scaffold a Bun-powered Hono server under `app/server/realtime`, implement auth middleware
   attaching wallet/player ids to WebSocket sessions, configure namespace/room conventions and optional Redis adapter,
   and build lifecycle utilities (rate limiter, heartbeat monitors, presence tracking).
4. **Feature Handlers** – Implement plugin registrations for notes, world chat, and DMs covering validation, permission
   checks, persistence, emissions, moderation queue integration, and HTTP fallback endpoints for history retrieval.
5. **Client Transport Layer** – Add `packages/torii/realtime` with a `RealtimeClient` singleton, implement
   join/send/subscribe methods, integrate reconnect/backoff logic and HTTP fallbacks, and wrap functionality with React
   hooks (`useWorldChat`, `useNotes`, `useDirectMessages`) following Feature-Sliced boundaries.
6. **UI Implementation** – Build world chat overlay, direct message panel, and notes composer/list components in
   `client/apps/game/src/features`, wire Zustand stores, provide toast notifications, and ensure mobile responsiveness
   with proper index exports.
7. **Quality & Ops** – Create automated tests (unit, integration, E2E, load), add monitoring metrics/logs, document
   deployment and migration steps, and compile a QA checklist including moderation workflows.

## Detailed TODO

- Draft a technical brief covering auth flow, namespace layout, Redis usage, moderation requirements, and infrastructure
  assumptions for stakeholder alignment.
- Produce Drizzle schema updates and migration scripts; validate with `pnpm drizzle-kit generate` and
  `pnpm drizzle-kit migrate` against a sandbox database and document backup/rollback steps.
- Implement reusable Zod schemas and rate limit configuration objects in `common/validation`.
- Build the Hono + WebSocket bootstrapper injecting Drizzle ORM (PostgreSQL), Redis, and BullMQ dependencies while
  exposing a handler registration API.
- Code feature handlers for notes, world chat, and direct messages including permission enforcement, persistence,
  broadcast, audit logging, and moderation queue enqueueing.
- Extend `packages/torii` with the realtime client, integrate JWT session handshake, expose React hooks, and ensure
  reconnect/backoff plus optimistic flows.
- Update Zustand stores to maintain normalized state, pagination cursors, reconnect delta fetching, and unread/typing
  metadata.
- Develop Feature-Sliced UI components for chat panels and note overlays, integrate with existing navigation/map layers,
  and surface notification toasts.
- Add Jest unit tests, Hono-based integration suites (Vitest or Bun test harness), Playwright E2E scenarios, and
  load-test scripts (k6 or Artillery) covering chat throughput and sync.
- Configure observability (metrics, log aggregation), document operational runbooks, and prepare release/migration
  checklist with QA sign-off steps.

## Immediate Next Steps

1. Choose Bun/Hono WebSocket adapter strategy (Redis clustering versus single instance) and provision the required Redis
   resources.
2. Finalize moderation and retention policy with product/community stakeholders, including profanity filters and
   TTL/archive jobs.
3. Schedule the Drizzle migration window and draft the realtime infrastructure rollout plan covering load balancer
   updates and QA timeline.
