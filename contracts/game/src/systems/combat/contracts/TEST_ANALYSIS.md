# troop_management Test Analysis

Generated: 2025-01-21

## Test Categories

| Category        | Test Count | Contracts Used                                   |
| --------------- | ---------- | ------------------------------------------------ |
| guard_add       | 8          | troop_management_systems                         |
| guard_delete    | 4          | troop_management_systems                         |
| explorer_create | 8          | troop_management_systems                         |
| explorer_add    | 8          | troop_management_systems                         |
| explorer_delete | 3          | troop_management_systems                         |
| explorer_swap   | 9          | troop_management_systems, troop_movement_systems |

**Total: 40 tests**

## Dependency Matrix

| Test Group      | Needs troop_management | Needs troop_movement | Needs village_systems | Needs realm_internal |
| --------------- | ---------------------- | -------------------- | --------------------- | -------------------- |
| guard\_\*       | Yes (direct call)      | No                   | Yes (auth check)      | Yes (auth check)     |
| explorer_create | Yes (direct call)      | No                   | Yes (auth check)      | Yes (auth check)     |
| explorer_add    | Yes (direct call)      | No                   | Yes (auth check)      | Yes (auth check)     |
| explorer_delete | Yes (direct call)      | No                   | Yes (auth check)      | Yes (auth check)     |
| explorer_swap   | Yes (direct call)      | Yes (1 test uses it) | Yes (auth check)      | Yes (auth check)     |

## Optimization Notes

### Phase 2 Optimization Applied

Removed unused contracts from namespace_def:

- agent_discovery_systems
- hyperstructure_discovery_systems
- mine_discovery_systems
- resource_systems
- troop_movement_util_systems

### Phase 3 Optimization Available

New modular init functions created in helpers.cairo:

- `init_troop_config()` - troop limits, stamina, damage
- `init_resource_config()` - capacity, weight configs
- `init_guard_test_config()` - minimal for guard tests
- `init_explorer_test_config()` - adds map_config

Tests currently use full `init_config()` - could be optimized to use modular versions.

## Potential CI Parallelization (Phase 5)

If needed, tests could be split into parallel jobs:

```yaml
strategy:
  matrix:
    test_group:
      - "guard_" # 12 tests
      - "explorer_create" # 8 tests
      - "explorer_add" # 8 tests
      - "explorer_delete" # 3 tests
      - "explorer_swap" # 9 tests
```

However, this would increase total CI time due to compilation overhead per job. Only recommended if test isolation is
needed or total test count grows significantly.

## Commented Tests Status (Phase 6)

### test_troop_battle.cairo

- **Status**: Entirely commented out
- **Tests**: 19 tests
- **Reason**: Disabled during Dojo 1.8.0 update (commit bdef0fbf8)
- **To re-enable**: Update to new API (spawn_test_world signature, TileOpt, etc.)

### test_troop_movement.cairo

- **Status**: Entirely commented out
- **Tests**: 13 tests
- **Reason**: Disabled during Dojo 1.8.0 update
- **To re-enable**: Update to new API

### quest tests (quest/contracts.cairo)

- **Status**: Behind feature flag `#[cfg(feature: 'budokan_tests')]`
- **Tests**: 43 tests
- **Reason**: Budokan dependency commented out in Scarb.toml
- **To re-enable**: Uncomment budokan dependency and update for API changes

### Total Commented Tests

- test_troop_battle: 19
- test_troop_movement: 13
- quest: 43
- **Total: 75 tests disabled**

Re-enabling these would increase test coverage significantly but requires API migration work.
