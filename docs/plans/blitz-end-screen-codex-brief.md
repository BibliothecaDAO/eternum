# Blitz End Screen Codex Brief — Winner From Trial Ranks, Zero Ops

Context: owner decision 2026-08-14. On the appchain, blitz games end purely by clock — `season_close` is eternum-only
(`assert!(blitz_mode_on == false)`), and the blitz finalization path (`blitz_prize_claim` → `PlayersRankFinal`) will not
run until phase-2 mainnet/prize wiring, **which stays as-is**. The client must therefore derive the end-of-game
experience from facts already live in RECS. Timing: lands after S4 merges, in the same deploy as the playtest push.
Branch `feat/blitz-end-screen` off the post-S4 base. Scope is client-only; no contract or ops changes.

## The defect (from the 2026-08-14 playtest report, game 15 `bltz-blip-186`)

The final in-game leaderboard rendered, but no end-of-game moment fired and the winner never displayed. On-chain: zero
`SeasonEnded` rows and zero `PlayersRankFinal` rows exist for ANY game on the dev world — both are unreachable for blitz
by design. Everything that gates on them shows nothing forever.

## The work

1. **Winner derivation goes mode-aware.** Post-S4, `SeasonWinnerStoreManager`
   (`client/apps/game/src/ui/store-managers.tsx:525`) already sets `gameWinner` from the RECS-streamed `SeasonEnded`
   event (`sqlApi.fetchSeasonEnded` is `deleted-s4`) — but that event is eternum-only, so blitz still resolves no winner
   ever. Add the blitz arm: derive the winner from RECS trial ranks — top rank by registered points at or after
   `gameEndAt` (the same facts the in-game leaderboard renders — `PlayerRegisteredPoints` / `PlayersRankTrial` are
   streamed by the runtime). The SeasonEnded event path stays as the eternum arm unchanged.
2. **The endgame modal becomes the blitz end screen.** `endgame-modal.tsx` already triggers on
   `currentBlockTimestamp >= gameEndAt`; investigate why the report says nothing displayed at T=0 (prime suspect: the
   dismissal-key persistence around `endgame-modal.tsx:49-57`, or a gate on `gameWinner` that blitz never satisfies).
   When it fires in blitz it must show the final leaderboard (ranks, points, HS breakdown — reuse the existing
   leaderboard components, do not duplicate them) and name the derived winner.
3. **Hide the End Season button in blitz** (`end-season-button.tsx`): it is the eternum affordance; on blitz every click
   reverts on the contract assert. Gate on the game-modes registry (`getIsBlitz`), not on a new flag.
4. **Landing "winner" card** (`No winner available yet`): optional secondary — deriving a leader for ended blitz games
   needs an SQL aggregate over registered points (landing has no RECS). Flag the adjudication in the PR; don't build it
   without the owner's yes.

## Constraints

- Facts from RECS only, in-session (fact-ownership rule); no new SQL reads inside the game.
- No prize/finalization logic of any kind — phase-2 territory, explicitly out of scope.
- Regression pin: the eternum-mode season-close flow (button, congrats popup, SeasonEnded-driven winner) must keep
  working — this brief is additive for blitz, not a rewrite of eternum's end.
- Verify against the playtest report's symptom: with a clock past `gameEndAt` on a blitz game, the end screen must
  appear without ANY on-chain finalization existing.
