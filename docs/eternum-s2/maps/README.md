# Reproducible central-bank design maps

These standalone SVGs reproduce the topology of the two supplied reference images, then apply the proposed S2
central-bank design. They describe the design; they do not prove production gameplay behavior.

| File                  | Purpose                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `primary-before.svg`  | Primary reference: six banks on Realm ring21; spacing-six spire lattice through ring24                |
| `ethereal-before.svg` | Ethereal reference: 61 spires, including the origin                                                   |
| `primary.svg`         | Proposed primary map through Realm ring30; one origin bank and 96 spires                              |
| `ethereal.svg`        | Proposed ethereal map with pre-exploration halos and reserved origin                                  |
| `primary-closeup.svg` | Individual primary hexes through radius45: bank, inner spires, mountain barrier and first Realm sites |
| `metadata.json`       | Parameters, exact counts, coordinate arrays and interpretive notes                                    |

Run from the repository root:

```sh
pnpm run generate:eternum-s2-maps
pnpm run validate:eternum-s2
```

`geometry.mjs` is the geometry authority for these artifacts. It uses pointy-top axial coordinates, hex radius
`max(abs(q), abs(r), abs(q+r))`, and the spatial equivalence `primary = ethereal × 15`. The full spacing-six lattice in
the reference images is retained, extended through radius30, and supplemented by six radius2 corner spires. All original
spires except the origin remain at identical coordinates.

The mountain interpretation follows the explicit inclusive ring range 32–35: four occupied hex rows, 804 cells. The
explicit bounds take precedence over the informal three-hex-depth description. Ring31 remains clear, including all
inner-spire neighbors.

Pre-explored halos include coordinates beyond the outer spire ring, because each outer spire also requires all six
neighbors. The ethereal map shows ring31 for these halos. Realm dots represent schematic eligible lattice sites; other
settlement eligibility rules still apply.

The validator independently flood-fills actual primary neighbor connectivity to establish that the mountain band
separates origin from the first Realm sites. It also checks paired-spire coordinates, all pre-exploration halos, inner
routes and exact counts. The generated SVGs contain titles and descriptions for accessibility and preserve text for
selectable labels.
