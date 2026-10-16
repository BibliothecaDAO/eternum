# Eternum Provider

`@bibliothecadao/provider` encodes typed native commands from the compiled Cairo ABI and submits them through the game's
recorded-intent admission path. Set up a playable client with `createGameClient` from `@bibliothecadao/eternum`, which
installs the manifest, ABI, signing and submission dependencies together.

Each gameplay action is signed as its own invoke. The shared client submission queue is keyed by chain and account:
sends leave in nonce order after the previous send's answer, with up to four actions awaiting inclusion. A refusal or
unknown answer pauses later sends until reconciliation; an action with an unknown outcome is never resent automatically.
The provider does not add another account-wide lock.

A successful invoke does not by itself establish that the gameplay action succeeded. Herald's transaction stream
supplies the action outcome, while its ordered fact updates supply the resulting game state through the native store.

`native-command.ts` defines the command payload types, backed by the generated contract ABI. Provider methods with UI
callers delegate to these commands. Administrative commands use the typed deployer and launch-service paths.

From the repository root:

```sh
pnpm --dir packages/provider build
pnpm --dir packages/provider exec vitest run
```
