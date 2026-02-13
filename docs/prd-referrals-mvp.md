# PRD: Eternum Referrals MVP (Build Now)

Date: 2026-02-13
Status: Ready for immediate implementation/release as MVP

## 1. Objective

Launch a production-usable referral MVP that:

1. Captures referral links from incoming users.
2. Stores one referrer-per-referee mapping.
3. Shows referral stats and leaderboard in the game dashboard.
4. Supports manual verification updates from ops/admin.

## 2. Problem

We need acquisition tracking now, without waiting for full on-chain automated verification and rewards distribution.

## 3. Users

1. Referrers: existing players who share links and track performance.
2. Referees: new/returning players entering with `?ref=...`.
3. Ops/Admin: team members who verify activity and monitor referral health.

## 4. Build-Now Scope (MVP)

1. Referral capture from URL query param `ref`.
2. Local persistence of referral until wallet connection.
3. One-time referral submission after wallet connect.
4. Rejection rules:
   1. Invalid address.
   2. Self-referral.
   3. Duplicate referee mapping.
5. Realtime-server referral API:
   1. `POST /api/referrals`
   2. `GET /api/referrals/leaderboard`
   3. `GET /api/referrals/stats`
   4. `POST /api/referrals/verify` (admin/manual updates)
   5. `GET /api/referrals/verify/status` (admin)
6. Dashboard UI in game (Profile -> Wallet):
   1. Personal referral link (copyable).
   2. Personal stats.
   3. Top leaderboard.
7. Feature flags:
   1. `VITE_PUBLIC_REFERRALS_ENABLED`
   2. `REFERRALS_ENABLED`

## 5. Out of Scope (MVP)

1. Automated on-chain verifier/indexer.
2. Scheduled verification pipeline (cron/action).
3. Reward payout mechanics.
4. Anti-fraud beyond basic self/duplicate checks.
5. Strong cryptographic wallet-proof auth for referral submission.

## 6. Functional Requirements

1. If user lands with `?ref=0x...`, client stores normalized lowercase address.
2. On wallet connect, client submits referral once and clears local referral on success or duplicate.
3. Server enforces unique `referee_address`.
4. Leaderboard includes only verified entries where `has_played=true` and `games_played>0`.
5. Points formula: `games_played ^ 1.3` aggregated by referrer.
6. Admin verification endpoint accepts batch updates for `games_played` and optional `last_checked_block`.
7. Verify endpoints require `REFERRAL_VERIFY_API_KEY`.

## 7. Data Model (MVP)

`referrals` table:

1. `id`
2. `referee_address` (unique)
3. `referrer_address`
4. `referee_username` nullable
5. `referrer_username` nullable
6. `source`
7. `has_played` (bool)
8. `games_played` (int)
9. `last_checked_block` nullable
10. `verified_at` nullable
11. `created_at`
12. `updated_at`

## 8. Success Metrics (MVP)

1. Referral capture rate: `% sessions with ref that create row`.
2. Submission success rate: `% captured referrals successfully persisted`.
3. Verification coverage: `% referrals with has_played=true after ops runs`.
4. Dashboard query reliability: error rate under 1% for leaderboard/stats endpoints.

## 9. Acceptance Criteria

1. A valid `?ref=` landing results in stored referral.
2. Connecting wallet creates referral record exactly once.
3. Duplicate referee returns conflict and does not create second row.
4. Self-referral is rejected.
5. Admin batch verify updates stats and leaderboard output.
6. Disabling either feature flag removes functional behavior cleanly.
7. Wallet dashboard displays link, stats, and leaderboard without breaking existing wallet UI.

## 10. Launch Plan

1. Deploy migration and APIs to staging.
2. Enable flags in staging.
3. Run manual verify updates and validate end-to-end flow.
4. Deploy to production with flags off.
5. Enable backend flag.
6. Enable frontend flag.
7. Monitor for 48 hours.

## 11. Immediate Post-MVP TODOs

1. Add wallet signature/session-proof auth for `POST /api/referrals`.
2. Implement automated on-chain verification worker.
3. Add scheduled verifier orchestration.
4. Add route-level integration tests and E2E referral journey test.
5. Add alerts for verification failures and unverified backlog growth.
