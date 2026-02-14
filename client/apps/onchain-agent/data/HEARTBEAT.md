---
version: 1
jobs: []
---

<!-- HEARTBEAT.md — Cron-style recurring jobs

Add jobs to automate periodic checks. The agent can also edit this file at runtime. Use strict yaml ONLY (no extra commenting or formatting. It's YAML.)

Format:
  - id: unique-job-name
    enabled: true
    schedule: "*/15 * * * *"    # Standard 5-field cron (min hour dom mon dow)
    mode: observe               # "observe" (read-only) or "act" (can execute actions)
    timeoutSec: 90
    prompt: |
      Description of what the job should do.

Example jobs:

  - id: economy-check
    enabled: true
    schedule: "*/10 * * * *"
    mode: observe
    timeoutSec: 60
    prompt: |
      Check Wheat production vs consumption across all structures.
      Flag any structure running low. Summarize in tasks/economy.md.

  - id: guard-audit
    enabled: true
    schedule: "*/30 * * * *"
    mode: observe
    timeoutSec: 60
    prompt: |
      Inspect guard strength on all owned structures.
      Flag any structure with guards below threshold.

Changes to this file are hot-reloaded (no restart needed).
-->
