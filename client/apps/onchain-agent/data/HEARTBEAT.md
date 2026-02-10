# Heartbeat - Recurring Tasks

```yaml
version: 1
jobs:
  - id: observe-state
    schedule: "* * * * *"
    prompt: "Observe the current game state. Check all structures have guards. Check for enemy armies within 5 tiles of any structure. Check explorer stamina levels and whether they can explore or attack. Report any urgent threats."
    mode: observe

  - id: resource-review
    schedule: "*/5 * * * *"
    prompt: "Review resource balance trends across all structures. Check for unclaimed resource arrivals and claim them. Check which production buildings are paused or depleted. Identify resources running low that need purchasing or trading."
    mode: act

  - id: exploration-check
    schedule: "*/3 * * * *"
    prompt: "Check all explorers. For any explorer with sufficient stamina (canExplore=true), move them to explore unexplored tiles using their unexploredDirections. Prioritize explorers near frontier tiles."
    mode: act

  - id: defense-audit
    schedule: "*/10 * * * *"
    prompt: "Audit all structure defenses. Ensure every structure has guards in at least slots Alpha and Bravo. If any guard slots are empty and we have troops available, fill them. Check guard stamina levels."
    mode: act

  - id: strategic-review
    schedule: "*/15 * * * *"
    prompt: "Conduct a strategic review. Check leaderboard position. Assess whether to upgrade realms, contribute to hyperstructures, or focus on military expansion. Review market prices for trading opportunities. Update reflection.md with current assessment."
    mode: act
```
