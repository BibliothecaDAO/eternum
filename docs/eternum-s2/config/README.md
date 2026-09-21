# Initial-playtest configuration

`initial-playtest.json` is the complete selected machine configuration for the Eternum S2 initial playtest. It applies
to Eternum only and is deliberately independent of working documents or external references.

## What the file contains

| Section              | Meaning                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `parameters`         | Selected scalar, enum, formula text and policy values keyed by stable domain name          |
| `acceptance_targets` | Balance and operational corridors to measure during validation and playtests               |
| `assets`             | Precision, mass, capacity family, bridge, transfer and market rules                        |
| `recipes`            | One row per recipe component, including amount formula, rounding and destination           |
| `transitions`        | State-machine summaries for admission, debit, credit, timer, partial and failure behaviour |
| `presentation_order` | Canonical resource and building order for generated tables and tools                       |

The root `counts` object is a validation aid. It must match the actual rows.

## Parsing rules

Most numeric values are encoded as strings. This is intentional: consumers must choose the correct integer, fixed-point
or arbitrary-precision representation from `unit` and `precision` instead of passing through a JavaScript floating-point
number.

- `integer` and integer-like precision values must parse without a fractional remainder.
- `basis_points` means 10,000 equals 100%.
- asset quantities are display units unless the unit explicitly says raw or scaled units.
- durations identify their unit in the key or `unit`; do not infer seconds from an unlabelled number.
- enums and rules remain strings and must be validated against the target contract's accepted values.
- a missing key is an error. There are no gameplay defaults outside this file.

## Recipes

`recipes` is a component ledger, not a list with one object per whole recipe. Group rows by `recipe_id`. Within a
recipe, use `component_index`, `asset` and `direction` to build the ordered debits and credits.

`amount_formula` is either a literal amount or an expression that names keys in `parameter_keys`. Resolve those keys
from `parameters`, apply the declared rounding rule and then perform the transition's capacity and admission checks.
Never round an aggregate when the row requires per-component rounding.

A generated recipe should preserve these fields in its test fixture:

```ts
type RecipeComponent = {
  recipe_id: string;
  component_index?: string;
  asset: string;
  direction: "debit" | "credit";
  amount_formula: string;
  rounding: string;
  disposition: string;
  destination: string;
  capacity_family: string;
};
```

Multiple recipe rows can share an ID because each row describes one component. Do not deduplicate by `recipe_id` alone.

## Transitions

Transitions are implementation contracts, not executable code. They provide a completeness check for each state change:

```text
caller + source state + preconditions
                  │
                  ▼
       debits / escrows / timers
                  │
                  ▼
       capacity and partial rule
                  │
                  ▼
          credits + canonical event
```

The design scope controls behaviour when a transition summary is intentionally compact. Generated contract tests should
still assert every field represented by the transition.

## Village ownership and capture

`mint_village` charges the parent Realm Owner and makes that wallet the first Village Owner. There is no separate
Manager authority. The current Owner has complete Village authority, and `transfer_village` moves that authority to
another wallet. `capture_village` does the same after decisive combat while preserving the Village's immutable parent
link and complete entity-bound state. The 5% bridge-out tax always goes to the current owner of that parent Realm.

The resource draw is not uniform. Use the 22 `village.resource_roll.weight.*` parameters as integer weights and
`village.resource_roll.total_weight` as their required sum. Never convert rounded display percentages back into weights.

The selected config contains no raid transition or raid properties on assets. Do not generate a dormant Eternum raid
path from older code. Hostile settlement play resolves through combat and complete capture.

## Activation

Compile the selected file into versioned Eternum preset rows. Stage and read back all rows before activating one config
hash for a season. A partial write must never become playable, and the activated version must remain frozen for that
season.

The repository's current `Config` type does not express every S2 domain. Extend the Eternum preset schema or add typed
S2 config models; do not discard rows that do not fit the current shape and do not put S2 values into Blitz patches.

## Deliberate exclusions

The file contains no:

- previous candidates or superseded values;
- design iteration labels or workbook lineage;
- external documentation dependencies;
- Agent parameters, assets, recipes or transitions; or
- raid, Village immunity or Village rebellion rules; or
- production deployment addresses except where an asset rule itself selects a contract address.

Run the package validator after any edit:

```bash
node docs/eternum-s2/validate.mjs
```

## Map coordinates and derived counts

`world.map.coordinate_system` is signed axial logical hex space. Decode storage offsets before calculating
`max(abs(q),abs(r),abs(q+r))`; do not treat pixel positions or storage integers as hex radii. Realm steps span 15
Primary hexes, and paired Ethereal Spire coordinates multiply by 15. The old base-coordinate-step and per-Realm-area
aliases are removed. The map generator consumes these explicit rules from this file's selected JSON.

Inclusive mountain bounds 32–35 produce four occupied rings. The outer six-spaced lattice includes side positions.
Bank/Spire halos are set unions. Primary fixed reveals exclude later holding reveals. Ethereal core counts refer to
radius 24 (the unchanged Bitcoin probability core), while transport reaches radius 30 and complete reveal halos
reach 31. Never use the new transport extent to rebase either discovery probability curve.
