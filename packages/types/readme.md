# Eternum Types

`@bibliothecadao/types` supplies shared game identifiers, constants, balance configuration and native binding types.

- `src/types`: shared application and gameplay types.
- `src/constants`: resource, troop, building and balance constants.
- `src/native`: the system-call adapter and native schema/event binding types.

Native row and command artifacts are generated from the Cairo package under `contracts/l3/world-native/schema`. Change
their declarations and regenerate them; do not add a second handwritten row definition.

```sh
pnpm --dir packages/types build
```
