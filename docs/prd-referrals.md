# PRD: Referrals In Eternum

Date: 2026-02-13

## Objective

Port the Loot referral program into Eternum with:

1. Backend APIs and storage in `client/apps/realtime-server`
2. Referral capture + dashboard UX in `client/apps/game`
3. Controlled rollout via feature flags

## User Flow

1. Referrer shares `/?ref=<wallet>` link.
2. New player lands on Eternum with `ref` query param.
3. Client stores referral locally and waits for wallet connect.
4. On wallet connection, client submits mapping to `/api/referrals`.
5. Referrals appear on leaderboard once verified (`has_played=true`, `games_played>0`).

## Core Rules

1. Wallet address format: `0x` + 1-64 hex chars.
2. Self-referral is rejected (case-insensitive).
3. One referral per referee wallet (`referee_address` unique).
4. Leaderboard points formula per referee: `gamesPlayed^1.3`.
5. Referrer total points: sum of all verified referees' points.

## API Surface

1. `POST /api/referrals`
2. `GET /api/referrals/leaderboard`
3. `GET /api/referrals/stats`
4. `POST /api/referrals/verify` (admin)
5. `GET /api/referrals/verify/status` (admin)

## Feature Flags

- Game client: `VITE_PUBLIC_REFERRALS_ENABLED`
- Realtime server: `REFERRALS_ENABLED`

## Non-Goals (Current Slice)

1. Automated on-chain game verification logic inside realtime-server.
2. Reward distribution pipeline.
