# Frontier ring vectors v1

The header of `frontier-ring-v1.txt` is version (1), then row count. Every following record is realm trait id, ring,
inner column, inner row, all unsigned decimal felts, one per line for snforge’s text reader. The generator reads the
native preset `structures.upgrade_limits.realm_max + 1`: levels are zero based, so Frontier supports rings 1 through 4
(6/18/36/60 cumulative plots). All 48 rows are reachable; ring 5 is excluded. Both Cairo and the frontend read this
file.

The selected index is `PoseidonHashSpan([realm_id, ring]) % (6 * ring)`. Start at `(10 + ring, 10)`, index 0, and walk
the literal directions `[2, 3, 4, 5, 0, 1]`, `ring` steps per side, until reaching that index. Use the existing offset
coordinate rule: directions 1/2 increase row, directions 4/5 decrease row, and even rows shift those diagonals east. No
timestamp, epoch or random root enters the derivation.

Regenerate from the repository root:

```sh
bun contracts/l3/world-native/scripts/frontier-ring-vectors.ts
```

Then run `building_ring_matches_shared_vectors_through_the_highest_castle_ring` and
`marked_ring_plot_doubles_output_capacity_and_population_without_neighbor_bonuses` with snforge on the coordinated box
under `athanor.slice`. The first checks the shared plots; the second executes building commands to verify doubled
production, capacity and population, neighbor independence and demolition refunds.
`castle_ring_limit_accepts_four_and_rejects_five` also executes a fourth-ring build at the maximum castle level and
rejects a fifth-ring build without changing resources or creating a building.
