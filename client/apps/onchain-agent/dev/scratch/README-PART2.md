## Tools

| Category   | Tools                                                                    |
| ---------- | ------------------------------------------------------------------------ |
| Map        | `map_tile_info` `map_nearby` `map_entity_info` `map_find` `map_briefing` |
| Movement   | `move_army`                                                              |
| Combat     | `simulate_attack` `attack_target` `attack_from_guard` `raid_target`      |
| Armies     | `create_army` `reinforce_army` `transfer_troops` `open_chest`            |
| Guards     | `guard_from_storage` `guard_from_army` `unguard_to_army`                 |
| Resources  | `send_resources` `transfer_to_structure` `transfer_to_army`              |
| Automation | `automation`                                                             |
| Buffs      | `apply_relic`                                                            |
| Memory     | `update_memory`                                                          |
| Status     | `status`                                                                 |

## Configuration

### Required

| Variable            | Description                                       |
| ------------------- | ------------------------------------------------- |
| `CHAIN`             | `mainnet`, `sepolia`, `slot`, `slottest`, `local` |
| `WORLD_NAME`        | Cartridge world slug (e.g. `slotty-test-1`)       |
| `ANTHROPIC_API_KEY` | LLM API key                                       |

### Optional

| Variable               | Default                    | Description           |
| ---------------------- | -------------------------- | --------------------- |
| `MODEL_PROVIDER`       | `anthropic`                | `anthropic` or `x402` |
| `MODEL_ID`             | `claude-sonnet-4-20250514` | Model identifier      |
| `TICK_INTERVAL_MS`     | `60000`                    | Ms between ticks      |
| `TORII_URL`            | auto                       | Skip discovery        |
| `WORLD_ADDRESS`        | auto                       | Skip discovery        |
| `RPC_URL`              | per-chain                  | Override RPC          |
| `VRF_PROVIDER_ADDRESS` | hardcoded                  | Override VRF          |

### x402

| Variable                 | Default                | Description                |
| ------------------------ | ---------------------- | -------------------------- |
| `X402_PRIVATE_KEY`       | —                      | Hex key for permit signing |
| `X402_ROUTER_URL`        | `https://ai.xgate.run` | Router endpoint            |
| `X402_MODEL_ID`          | `kimi-k2.5`            | Model                      |
| `X402_NETWORK`           | `eip155:8453`          | CAIP-2 network             |
| `X402_PERMIT_CAP`        | `10000000`             | Max per permit             |
| `X402_PAYMENT_SIGNATURE` | —                      | Static auth                |
