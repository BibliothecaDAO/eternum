---
domain: reflection
---

# Reflection Tasks

## Post-Tick Review

- After each tick's actions complete, briefly assess: Did the actions achieve their intended effect? Check
  `result.success` on every executed action.
- If an action failed, identify why. Common causes: insufficient resources, invalid target, explorer out of stamina,
  structure already guarded.
- Track consecutive failures on the same action type. If 3 or more in a row, the strategy needs revision.

## Economy Review

- Every 5 ticks, compare current resource balances to 5 ticks ago. Are resources growing, stable, or declining?
- If any resource has declined more than 30% in 5 ticks without deliberate spending, investigate: production paused?
  Arrivals unclaimed? Raided?
- If all resources are growing steadily, consider shifting some economy budget toward expansion or military.

## Military Review

- After every combat action (attack, raid, guard defense), evaluate the outcome. Did you gain or lose troops? Was the
  resource gain worth the troop cost?
- Maintain a mental kill/loss ratio. If you are losing more troops than the enemy in engagements, your force composition
  or target selection is wrong.
- If a specific enemy consistently defeats your attacks, stop attacking them and focus elsewhere.

## Exploration Review

- Every 10 ticks, assess map coverage. How many tiles are explored relative to your total territory radius?
- If exploration has stalled (no new tiles in 5 ticks), redirect explorers to new directions.
- Evaluate whether discovered resource tiles have been acted upon. Unexploited discoveries are wasted scouting.

## Strategy Effectiveness

- Every 10 ticks, check your leaderboard rank. Is it improving, stable, or declining?
- If rank is declining, identify the gap: are top players ahead on military points, economic output, or hyperstructure
  contributions?
- Adjust the priority stack in `priorities.md` based on what is actually earning points in the current game state.

## Self-Update Protocol

- If a pattern of failure persists across 5+ ticks, update the relevant task file with revised criteria or a new
  approach.
- If a new opportunity type is discovered (new hyperstructure, abandoned enemy realm, favorable bank prices), create a
  temporary priority note.
- Never update `soul.md` unless fundamental assumptions about the game mechanics prove wrong. Task files are the right
  place for tactical adjustments.

## Decision Criteria

- Reflection should consume minimal tick budget. Read state, compare to expectations, note deviations.
- Prioritize identifying negative trends early. A 10% resource decline is easier to fix now than a 50% decline in 5
  ticks.
- Use reflection to prune ineffective actions from your repertoire. Every failed action is a wasted tick.
