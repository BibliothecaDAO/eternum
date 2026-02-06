---
domain: diplomacy
---

# Diplomacy Tasks

## Guild Management

- Use `create_guild` if you are not in a guild and have at least 3 ticks of stable economy. Set `isPublic: false` to control membership.
- Use `join_guild` to join an existing allied guild if invited. Prefer guilds with active members near your territory.
- Use `leave_guild` only if the guild is inactive, hostile, or strategically irrelevant.

## Whitelist Management

- Use `update_whitelist` to grant trusted players access to your guild. Only whitelist players you have verified as allies through consistent non-aggression.
- Remove players from the whitelist (`whitelist: false`) if they attack any guild member or violate agreements.
- Review the whitelist every 20 ticks. Remove inactive or irrelevant addresses.

## Alliance Strategy

- Identify players near your territory who are not attacking you. These are natural alliance candidates.
- Allies share a key benefit: mutual non-aggression frees troops from border defense, allowing more explorers and economic focus.
- Track ally behavior. If an ally moves armies toward your structures or raids your neighbors without coordination, reconsider the alliance.

## Hyperstructure Contributions

- Use `contribute_hyperstructure` to send surplus resources to allied hyperstructures. Contributions earn leaderboard points.
- Only contribute when you have more than 150% of your maintenance resource needs in reserves.
- Prioritize contributing to hyperstructures that are close to completion (progress > 70%) for faster point returns.
- Check hyperstructure access before contributing. Use `observe_game` to verify you have access or that the hyperstructure is public.

## Coordination Signals

- When sending resources to an ally via `send_resources`, note it in your reflection as a diplomatic action.
- When an ally is under attack (enemy armies near their structures), consider diverting an explorer to assist or raid the attacker's exposed structures.
- Avoid attacking structures belonging to whitelisted players or guild members unless explicitly re-evaluating the alliance.

## Decision Criteria

- Diplomacy actions are lower priority than defense and economy but higher priority than offensive military.
- Guild membership provides access to shared hyperstructures and reduces the number of potential threats.
- Hyperstructure contribution becomes high priority when you are falling behind on leaderboard points and have economic surplus.
- Never sacrifice defense for diplomacy. A dead ally cannot help you.
