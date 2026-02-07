# HEARTBEAT

Define cron-like recurring jobs for the agent here.
The scheduler hot-reloads this file while the app is running, so edits apply without restart.

```yaml
version: 1
jobs:
  - id: market-check
    enabled: true
    schedule: "*/10 * * * *"
    mode: observe
    timeoutSec: 90
    prompt: |
      Check market conditions and summarize opportunities.
      In observe mode, do not submit on-chain actions.
```
