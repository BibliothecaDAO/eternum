# Referral Migration PR Plan

Date: 2026-02-13
Target branch: `next`
Source reference: `BibliothecaDAO/loot-referral`

## Goal

Migrate the Loot referral program into Eternum with:

1. Backend in `client/apps/realtime-server`
2. Frontend in `client/apps/game` dashboard/landing surfaces
3. Production-safe verification, scheduling, and observability

## Decisions Locked

1. Referral backend will live in `client/apps/realtime-server` (Hono + Drizzle + Postgres)
2. Referral UX will live in `client/apps/game`
3. No Supabase dependency in Eternum implementation
4. Rollout will be feature-flagged

## High-Level Sequence

1. PR1: Spec + shared types
2. PR2: DB schema + migrations
3. PR3: Public referral APIs
4. PR4: Verification engine + secure trigger
5. PR5: Scheduled verification workflow
6. PR6: Game capture plumbing
7. PR7: Game dashboard UI module
8. PR8: Hardening + observability
9. PR9: Rollout + documentation finalization

## Cross-PR Rules

1. Keep each PR independently reviewable and deployable
2. Add tests in the same PR as behavior changes
3. No hidden infra assumptions; every env variable is documented
4. Keep API contracts typed in shared package imports

## PR1: Referral Spec And Shared Contracts

### Objective

Lock business behavior and payload contracts before storage and API implementation.

### Scope

1. Write product and technical specification
2. Define shared TS contracts for requests/responses/entities
3. Define required env vars and default safe values

### Deliverables

1. `docs/prd-referrals.md`
2. `packages/types/src/referrals.ts`
3. `client/apps/realtime-server/.env.example` additions
4. `client/apps/game/.env.local.sample` additions

### Key Decisions Captured

1. Conversion definition (what qualifies as "played")
2. Scoring formula and tie-breakers
3. Anti-abuse policy (self-referral, duplicate referee, rate limits)
4. Endpoint auth model

### Validation

1. `pnpm --dir packages/types build`
2. Type imports compile in both game and realtime-server apps

### Exit Criteria

1. Spec approved by product/engineering
2. Contract types frozen for PR2-PR4

## PR2: Realtime Schema And Migration

### Objective

Create durable referral storage in Postgres via Drizzle.

### Scope

1. Add new Drizzle schema module for referrals
2. Add migrations and indexes
3. Wire schema exports into server schema index

### Deliverables

1. `client/apps/realtime-server/src/db/schema/referrals.ts`
2. `client/apps/realtime-server/src/db/schema/index.ts` update
3. `client/apps/realtime-server/drizzle/0003_referrals.sql`
4. `client/apps/realtime-server/drizzle/meta/*` updates

### Suggested Table Set

1. `referrals`
2. `referral_verification_runs` (optional but recommended)
3. `referral_events` (optional audit trail)

### Minimum Columns For `referrals`

1. `id`
2. `referee_address` (unique)
3. `referrer_address`
4. `referee_username` (nullable)
5. `referrer_username` (nullable)
6. `has_played` (default false)
7. `games_played` (default 0)
8. `last_checked_block` (default 0)
9. `created_at`
10. `updated_at`

### Indexes

1. Unique index on `referee_address`
2. Btree index on `has_played`
3. Btree index on `last_checked_block`
4. Btree index on `created_at`
5. Btree index on `referrer_address`

### Validation

1. `pnpm --dir client/apps/realtime-server db:generate`
2. `pnpm --dir client/apps/realtime-server db:push` (staging/sandbox DB)

### Exit Criteria

1. Migration applies cleanly
2. Rollback strategy documented in PR notes

## PR3: Public Referral API In Realtime Server

### Objective

Ship referral creation and leaderboard APIs without verification automation yet.

### Scope

1. Add referral routes module
2. Register routes in server
3. Add request validation and error contracts

### Endpoints

1. `POST /api/referrals`
2. `GET /api/referrals/leaderboard`
3. `GET /api/referrals/stats`

### Deliverables

1. `client/apps/realtime-server/src/http/routes/referrals.ts`
2. `client/apps/realtime-server/src/server.ts` route registration
3. Shared validation usage from `packages/types`

### Behavior

1. Reject malformed addresses
2. Reject self-referrals
3. Reject second referral for same referee
4. Return leaderboard rows ranked by configured score

### Validation

1. Integration tests for all routes
2. Rate limit behavior test
3. Duplicate referee conflict test

### Exit Criteria

1. Public API stable and documented
2. Client can create referrals and fetch leaderboard

## PR4: Verification Engine (Manual Trigger)

### Objective

Implement server-side verification and game count updates behind a secure endpoint.

### Scope

1. Create verifier service
2. Add secure trigger endpoint
3. Add batch/cursor mechanics

### Endpoints

1. `POST /api/referrals/verify` (auth required)
2. `GET /api/referrals/verify/status` (ops visibility)

### Deliverables

1. `client/apps/realtime-server/src/services/referral-verifier.ts`
2. `client/apps/realtime-server/src/http/routes/referrals-verify.ts`
3. Route wiring in `client/apps/realtime-server/src/server.ts`

### Engine Requirements

1. Idempotent processing
2. Incremental block cursor handling
3. Batch limits + offset progression
4. Retry/backoff for RPC failures
5. Non-destructive partial-failure handling

### Security

1. Bearer key check (`REFERRALS_VERIFY_API_KEY`)
2. Verify endpoint excluded from public CORS usage
3. Audit log record per verification run

### Validation

1. Unit tests for selector/event filtering
2. Integration test for verify endpoint auth
3. Integration test for updates and cursor movement

### Exit Criteria

1. Manual verify run works end-to-end
2. No duplicate increments on repeated run

## PR5: Scheduled Verification Workflow

### Objective

Automate periodic verification runs.

### Scope

1. Add GitHub workflow with cron + manual dispatch
2. Add secure secret usage
3. Add run summary output

### Deliverables

1. `.github/workflows/referrals-verify.yml`
2. `docs/runbooks/referrals-ops.md` scheduling section

### Workflow Requirements

1. Uses env/secret for backend URL and bearer key
2. Supports batch loops until completion or timeout
3. Fails loudly on non-2xx responses

### Validation

1. `workflow_dispatch` dry run in staging
2. Confirm no overlap behavior for concurrent runs

### Exit Criteria

1. Scheduler is live in staging
2. On-call/debug procedure documented

## PR6: Game Client Referral Capture Plumbing

### Objective

Capture and persist referral code and submit once wallet is connected.

### Scope

1. Add URL parsing and local persistence helpers
2. Add capture hook into game landing flow
3. Submit referral mapping to realtime API

### Deliverables

1. `client/apps/game/src/ui/features/referrals/referral-storage.ts`
2. `client/apps/game/src/ui/features/referrals/use-referral-capture.ts`
3. Landing integration in `client/apps/game/src/ui/features/landing/views/play-view.tsx`

### Behavior

1. Read `ref` from URL
2. Persist locally until successful submit
3. Submit only once per connected wallet and clear on success

### Validation

1. Unit tests for parse/store/clear
2. Hook test for one-time submit behavior

### Exit Criteria

1. Referral from URL is captured and persisted
2. Submission occurs after connect and does not repeat

## PR7: Game Dashboard Referral UI Module

### Objective

Expose share and leaderboard UI in main game dashboard.

### Scope

1. Create referral dashboard components
2. Integrate into existing landing/dashboard tabs
3. Fetch data from realtime API with loading/error states

### Deliverables

1. `client/apps/game/src/ui/features/referrals/referral-panel.tsx`
2. `client/apps/game/src/ui/features/referrals/referral-leaderboard.tsx`
3. Dashboard integration in `client/apps/game/src/ui/features/landing/views/play-view.tsx`
4. Feature entry in `client/apps/game/src/ui/features/world/latest-features.ts`

### UX Requirements

1. Copyable share link
2. Personal referral status
3. Top leaderboard with rank and points
4. Responsive on desktop/mobile

### Validation

1. `pnpm --dir client/apps/game lint`
2. `pnpm --dir client/apps/game test`
3. Visual QA in local/staging build

### Exit Criteria

1. Referral module visible and functional in dashboard
2. No regressions in existing landing/dashboard navigation

## PR8: Hardening And Observability

### Objective

Make referral system production-safe under load and failures.

### Scope

1. Harden rate limiting strategy
2. Improve verification telemetry
3. Add explicit alerting/runbook guidance

### Deliverables

1. Middleware updates in `client/apps/realtime-server/src/http/middleware/*`
2. Structured logs in verifier and routes
3. `docs/runbooks/referrals-ops.md` final incident guide

### Hardening Targets

1. Burst-resistant rate limits
2. Clear error classes and status codes
3. Retry ceilings and timeout guards
4. Correlation IDs for verify runs

### Validation

1. Endpoint stress smoke test
2. Simulated RPC failure run
3. Verify alert/log usefulness in staging

### Exit Criteria

1. Operational dashboards/log trails are actionable
2. Failure modes are bounded and recoverable

## PR9: Rollout Controls And Final Documentation

### Objective

Ship safely with feature flags and complete release docs.

### Scope

1. Add frontend and backend flags
2. Stage rollout procedure
3. Finalize docs and handoff notes

### Deliverables

1. `VITE_PUBLIC_REFERRALS_ENABLED` integration in game app
2. `REFERRALS_ENABLED` integration in realtime server
3. Final docs links in `docs/README.md`

### Rollout Plan

1. Enable backend in staging only
2. Enable frontend for internal testers
3. Validate verify scheduler + leaderboard updates
4. Enable production backend
5. Enable production frontend

### Validation

1. Staging end-to-end: `?ref=...` -> connect -> stored -> verified -> leaderboard
2. Feature flags can disable both API writes and UI rendering

### Exit Criteria

1. Production release complete with rollback path
2. Ownership and support model documented

## Dependencies Matrix

1. PR2 depends on PR1
2. PR3 depends on PR2
3. PR4 depends on PR2 and PR3
4. PR5 depends on PR4
5. PR6 depends on PR3
6. PR7 depends on PR6 and PR3
7. PR8 depends on PR4 and PR5
8. PR9 depends on PR5, PR7, and PR8

## Estimated Timeline

1. PR1: 0.5 day
2. PR2: 1 day
3. PR3: 1.5 days
4. PR4: 2 days
5. PR5: 0.5 day
6. PR6: 1 day
7. PR7: 1.5 days
8. PR8: 1 day
9. PR9: 0.5 day

Total: about 9.5 engineering days (plus QA and review latency)

## Definition Of Program Done

1. Referral creation works from game client
2. Verification runs automatically on schedule
3. Leaderboard shows verified results
4. Abuse protections are active
5. Feature flags allow immediate rollback
6. Runbook and ownership are in place
