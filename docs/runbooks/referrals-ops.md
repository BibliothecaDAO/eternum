# Referrals Ops Runbook

Date: 2026-02-13

## Scope

Referral endpoints live in `client/apps/realtime-server` under `/api/referrals`.

## Required Env Vars

- `REFERRALS_ENABLED` (optional): Set to `false` to disable referral endpoints.
- `REFERRAL_VERIFY_API_KEY` (optional but required for verify endpoints): Shared secret for `/api/referrals/verify*`.

## Public Endpoints

- `POST /api/referrals`
- `GET /api/referrals/leaderboard?limit=50`
- `GET /api/referrals/stats?referrerAddress=0x...`

## Admin Endpoints

- `POST /api/referrals/verify`
- `GET /api/referrals/verify/status`

Both admin endpoints require either `x-referral-verify-key` or `x-verify-key` matching `REFERRAL_VERIFY_API_KEY`.

## Manual Verification Update

Use this when an external verifier computes updated game counts.

```bash
curl -X POST "$REALTIME_URL/api/referrals/verify" \
  -H "Content-Type: application/json" \
  -H "x-referral-verify-key: $REFERRAL_VERIFY_API_KEY" \
  --data '{
    "updates": [
      {
        "refereeAddress": "0xabc",
        "gamesPlayed": 3,
        "lastCheckedBlock": 1270000
      }
    ]
  }'
```

## Health Check

```bash
curl -s "$REALTIME_URL/api/referrals/verify/status" \
  -H "x-referral-verify-key: $REFERRAL_VERIFY_API_KEY"
```

Expected payload:

```json
{
  "data": {
    "total": 120,
    "verified": 68,
    "unverified": 52
  }
}
```
