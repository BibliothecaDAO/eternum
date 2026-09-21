# Eternum S2 implementation package

This directory is the self-contained design and configuration authority for the Eternum S2 initial playtest.

It applies to **Eternum only**. It does not change Blitz, a Blitz balance profile or any other game mode. The repository
shares contracts, packages and client code across game modes, so every implementation must preserve that boundary at the
preset and game level.

## Read in this order

1. [Design scope](./design-scope.md) explains the game from first principles and defines the intended player experience.
2. [Implementation guide](./implementation-guide.md) maps that design onto the current repository and orders the work.
3. [Config guide](./config/README.md) defines how to consume the machine-readable configuration.
4. [Initial-playtest config](./config/initial-playtest.json) contains the selected values, recipes, transitions and
   acceptance targets.

`manifest.json` provides the same document map and scope boundary in a small machine-readable entrypoint.

Run `node docs/eternum-s2/validate.mjs` from the repository root before changing or consuming the package.

## Authority and conflict rules

| Question                                                        | Authority                      |
| --------------------------------------------------------------- | ------------------------------ |
| What mechanic exists and how does it behave?                    | `design-scope.md`              |
| What exact value, recipe component or asset permission applies? | `config/initial-playtest.json` |
| Where and in what order should the current stack change?        | `implementation-guide.md`      |
| How should a config row be parsed?                              | `config/README.md`             |

If prose and config disagree on a number, stop and repair this package before implementing either value. Do not choose
silently. If current code disagrees with this package, the current code describes the implementation being replaced; it
does not override the S2 design.

The selected config is one complete baseline. It must not be merged with an earlier candidate, workbook or design
overlay. Those working materials are intentionally absent.

## Scope boundary

The playable baseline includes:

- Realms, purchasable/capturable Villages with delegated management, and Camps;
- Workers, entitlement-based production, maintenance and split storage;
- buildings, settlement progression, logistics, trade and bridging;
- troops, exploration, combat and capture;
- world structures, Research, Relics, Bitcoin Mines, Faith and Wonders;
- Hyperstructures, Tribes, Victory Points, season close and funded prize settlement; and
- the client, indexing, replay, configuration and custody contracts needed to make those mechanics reliable.

Agents are not part of this baseline. Their discovery, classes, messaging, custody and execution remain deferred to the
other development team. The selected config contains no Agent parameters, assets, recipes or transitions.

The package authorises implementation against the initial-playtest design. It does not authorise a production deploy,
fund a prize, create an external liability or advertise a launch. Native Ancient Fragment redemption, the Bitcoin
reserve and any advertised prize must be fully funded and proven before the relevant season is admitted.

## Shared-repository rule

The safest mental model is:

```text
shared engine capability
        │
        ├── Eternum preset ──► S2 rules and selected config
        │
        └── Blitz preset ────► existing Blitz rules and balance
```

Shared primitives may be extended where both modes benefit, but S2 activation belongs to an Eternum preset. Never
rename, reinterpret or rebalance a shared value in a way that changes Blitz merely because the Eternum design uses a
similar concept. Workers are the clearest example: they replace Labor in Eternum S2, while existing Blitz Labor
behaviour must remain intact unless a separate Blitz change explicitly says otherwise.

## Handoff contract for developers and AI assistants

Before implementing a subsystem:

1. read its full section in `design-scope.md`;
2. select every matching parameter, recipe and transition from the machine config;
3. inspect the current paths named in `implementation-guide.md`;
4. write invariants and mode-isolation tests before changing shared behaviour;
5. implement quote, admission, atomic transition, canonical event and read-back together; and
6. verify the resulting client explanation against the same config version used by the contract.

Do not infer missing values from current Eternum, Blitz or an external document. A genuinely missing mechanic or value
is a package defect and should be resolved here before code chooses a default.

## Central Bank geography

The [Banking explainer](./banking-explainer.md) details the single central Bank, Mountains and the Ethereal approach. It
includes two reconstructed reference maps, updated Primary/Ethereal maps and the inner-45-ring close-up. Map rules
consume the selected config; regenerate with `node docs/eternum-s2/maps/generate.mjs` and validate with
`node docs/eternum-s2/maps/validate.mjs`. Geometry validation does not establish deployed gameplay behaviour.
