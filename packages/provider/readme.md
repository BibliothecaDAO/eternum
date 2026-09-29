# Eternum Provider

`@bibliothecadao/provider` encodes typed native commands from the compiled Cairo ABI and submits them through the game's
recorded-intent admission path. Set up a playable client with `createGameClient` from `@bibliothecadao/eternum`, which
installs the manifest, ABI, signing and submission dependencies together.

The provider serializes a player's pending commands and waits for the ticket's own outcome. Several players' tickets may
share one transaction; transaction success alone does not establish that an individual action succeeded. Herald's
transaction stream supplies confirmation, while the native fact store supplies resulting game state.

`native-command.ts` defines the command payload types, backed by the generated contract ABI. Provider methods with UI
callers delegate to these commands. Administrative commands use the typed deployer and launch-service paths.

From the repository root:

```sh
pnpm --dir packages/provider build
pnpm --dir packages/provider exec vitest run
```
