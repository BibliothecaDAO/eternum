# Native game command proofs

Run the native gate from the repository root:

```sh
/home/djizus/projects/eternum-lanes/cairo-run.sh bash contracts/l3/check-native.sh
```

The command tests send signed game commands through the same dispatcher as a player. Test output records each scenario's
result; class-size, ABI and schema checks run against production artifacts. A targeted town run uses
`snforge test --package world_tests_lifecycle town --max-threads 1` in `world-native/tests`, through the same machine
runner.

| Feature                        | Player command path                                           | Behavioral proof                                                                                                            |
| ------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Castle levels and labor stores | SettleSeason → CreateBuilding Workshop → LevelUp              | `lifecycle/src/tests/town.cairo`: exact prices, four caps, army slots, old-rate settlement, Workshop output retained        |
| Storeroom                      | LevelUp to City → CreateBuilding Storehouse → DestroyBuilding | same: City gate, one standing building, labor/wheat ×2, troop cap unchanged, pre-change settlement, half refund, rebuild    |
| Lore ladder                    | Research Well → Shrine → Depth tier 1 (Spire)                 | same: no skipped or repeated unlock, 2,500/5,000/10,000 Essence, zero labor                                                 |
| World banes                    | SettleSeason → Explore or attack → ClaimDailyQuest            | `lifecycle/src/tests/world_banes.cairo`, `world_bane_combat.cairo`: completion, early effect end, independent capped grants |

Town proofs use the registered Season One preset. Purchase-isolation cases fund fixture stock through the resource
dispatcher; the Workshop/upgrade proof earns its labor through production and sends no fixture grant.
