---
domain: military
---

# Military Tasks

## Guard Management

- Every structure must have at least one guard slot filled at all times. Check guard status each tick.
- Use `add_guard` to assign troops to a structure's guard slot. Prefer higher-tier troops for primary realms.
- Only use `delete_guard` when replacing with stronger troops or when consolidating forces for an offensive.

## Explorer Training

- Use `create_explorer` to train new explorer armies from a structure. Specify category, tier, and amount based on
  available resources and current needs.
- Maintain at least 2 active explorers at all times: one for scouting, one as a rapid response force.
- Use `add_to_explorer` to reinforce an existing explorer rather than creating a new one when the explorer is still
  healthy but below full strength.

## Troop Swaps

- Use `swap_explorer_to_guard` to convert a returning explorer into a structure guard when that structure needs defense.
- Use `swap_guard_to_explorer` to mobilize a guard into an explorer for offensive operations, but only if the structure
  has a replacement guard available.
- Use `swap_explorer_to_explorer` to consolidate two weak explorer armies into one strong one.

## Defensive Operations

- When an enemy army is detected within 3 tiles of a structure, immediately reinforce that structure's guards.
- Use `guard_attack_explorer` when an enemy explorer is adjacent to a guarded structure. The guard can attack without
  leaving their post.
- If a structure has no guards and an enemy is approaching, prioritize `swap_explorer_to_guard` or `add_guard` over all
  other actions.

## Offensive Operations

- Before any attack, use `simulate_action` to estimate the outcome. Only proceed if simulated strength advantage is 2x
  or greater.
- Use `attack_explorer` for explorer-vs-explorer combat when you encounter a weaker enemy army in the field.
- Use `attack_guard` to assault an enemy structure's defenses. Only attempt this with a strong explorer army.
- Use `raid` to steal resources from enemy structures without fully defeating their guards. Raiding is lower risk than a
  full assault.

## Resource Raiding Strategy

- Identify enemy structures with high resource balances using `observe_game`.
- Move an explorer to an adjacent tile using `travel_explorer` or `move_explorer`.
- Simulate the raid. Specify which resources to steal in `stealResources`.
- Execute the raid. Retreat the explorer immediately after if the structure still has active guards.

## Decision Criteria

- Defense is always higher priority than offense. Never launch an attack if any owned structure is unguarded.
- Prefer raiding over full assaults. Raids extract value with less troop loss.
- Retire severely weakened explorers by swapping them to guard duty. Do not waste troops by keeping them in the field at
  low strength.
- Track battle outcomes across ticks. If attacks against a target consistently fail in simulation, blacklist that
  target.
