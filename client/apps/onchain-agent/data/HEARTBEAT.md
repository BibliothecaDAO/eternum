---
version: 1
jobs:
  - id: military-check
    enabled: true
    schedule: "*/6 * * * *"
    mode: observe
    timeoutSec: 30
    prompt: |
      Full military status check. This is wartime.
      Use inspect_explorer on each of your explorers and inspect_realm
      on each structure to get current data. Assess:
      - Are any explorers idle with stamina? They should be moving.
      - Are troops in the field in good defensive/offensive positions?
      - Are any enemy armies nearby that should be attacked or avoided?
      - Are guard slots at all structures adequately filled?
      - Are there exploration targets (unexplored tiles) within reach?
      Write findings and recommended actions to tasks/learnings.md.
      Do NOT execute actions.
  - id: upgrade-check
    enabled: true
    schedule: "2-59/6 * * * *"
    mode: observe
    timeoutSec: 30
    prompt: |
      Use inspect_realm on each structure to check current resources
      and building status. Assess:
      - Can any realm level up? (check Elixir and other upgrade costs)
      - Are there buildings that should be upgraded to higher tiers?
      - Is production net-positive or are inputs being consumed faster
        than produced?
      Write upgrade opportunities to tasks/learnings.md. Do NOT execute actions.
  - id: build-check
    enabled: true
    schedule: "4-59/6 * * * *"
    mode: observe
    timeoutSec: 30
    prompt: |
      Use inspect_realm on each structure to check free slots, population
      headroom, and resource balances. Assess:
      - Are there free building slots? What should be built next per
        the Phase 2 sprint targets in soul.md?
      - Is population near capacity? Build WorkersHut first if so.
      - Are input resources balanced for current production buildings?
      Write build recommendations to tasks/learnings.md. Do NOT execute actions.
  - id: study-handbooks
    enabled: true
    schedule: "1-59/20 * * * *"
    mode: observe
    timeoutSec: 60
    prompt: |
      Re-read the reference handbooks to refresh your game knowledge.
      Use the read tool to load each of these files:
        - tasks/game.md
        - tasks/economy.md
        - tasks/exploration.md
        - tasks/combat.md
      After reading, update tasks/learnings.md with any new insights,
      corrections to previous assumptions, or strategy refinements.
      Focus on rules you may have been violating or mechanics you
      haven't been leveraging. Do NOT overwrite existing learnings —
      append or revise specific entries.
---

<!-- HEARTBEAT.md — Cron-style recurring jobs

Stagger schedule (6-min cycle, 2-min offset):
  military-check: 0, 6, 12, 18, 24, 30, 36, 42, 48, 54
  upgrade-check:  2, 8, 14, 20, 26, 32, 38, 44, 50, 56
  build-check:    4, 10, 16, 22, 28, 34, 40, 46, 52, 58
  study-handbooks: 1, 21, 41

Changes to this file are hot-reloaded (no restart needed).
-->
