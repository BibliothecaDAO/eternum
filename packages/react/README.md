# Eternum React bindings

`@bibliothecadao/react` provides the game context and hooks that read the native fact store. `useGame` exposes the
active client setup and gameplay account. `useNativeRevision` subscribes to changes in the named models so a view can
derive its current display from `setup.store`.

The store is authoritative. Hooks may derive presentation data, but must not fetch or cache a competing copy of live
rows. The acting component may display a pending indicator while Herald supplies the shared provisional state.

The browser creates its client through `apps/game/src/services/game-client.ts`; the same shared runtime serves the bot
harness. Keep account setup and world selection in that flow.

```sh
pnpm --dir packages/react build
```
