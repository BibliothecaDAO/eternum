# Native game launch

The launcher creates games inside a persistent native world. The launch service owns free Regular Blitz slots:
registration closes, the roster splits into balanced games of at most 24, and each game settles before play begins. Use
the factory UI to schedule a slot, inspect creation/result progress and retry failed work.

Eternum uses its existing entitlement policy and single-game launch path:

```bash
bun config/deployer/clean/cli/create.ts \
  --environment madara.eternum \
  --game eternum-playtest \
  --start-time 1789819200
```

Required configuration is `NATIVE_WORLD_MANIFEST`, `ADMISSION_URL`, `RPC_URL`, `DEPLOYER_ACCOUNT_ADDRESS` and
`DEPLOYER_PRIVATE_KEY`. Start time accepts Unix seconds, milliseconds or ISO 8601. `--version` selects an immutable
registered preset. Per-game balance overrides cannot mutate a registered preset.

Launch state is durable in the service's PostgreSQL store. Creation schedules a result job atomically, using the actual
game end and grace period after auto-settlement. Result jobs checkpoint remaining points, submit bounded rank and VP
batches, and resume from chain progress after an interruption. No ledger relay or reward mint is required.
