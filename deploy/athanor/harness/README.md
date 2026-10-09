# Player-signed bot runs

`pnpm lab:harness` uses each bot's approved device to sign one v3 `Games.play` invoke at its RPC nonce. The manifest
supplies the immutable gas bound. The public proxy adds the randomness proof. There is one action in flight per account
until the receipt and that bot's Herald transaction barrier both finish. Library rejection inside a successful invoke is
reported with the game's reason. A lost submission response is observed by its precomputed hash; the harness never
advances that account to another nonce while its outcome is unknown.

Account creation retains the identity service's bot-device approval route. New game creation needs
`HARNESS_ADMIN_RPC_URL`; player traffic uses `--rpc-url` and the matching Herald manifest. Administration belongs on the
private node, while gameplay goes through the public proxy. `NATIVE_WORLD_MANIFEST` must include `shard.chainId`,
`shard.vrfPublicKey` and `shard.l2GasBound`.

`pnpm lab:harness:test` resolves workspace sources through this directory's tsconfig, so tests and workers use the
checkout's command bindings rather than another checkout's built packages. Run commands under
`flock /tmp/eternum-client.lock` on a shared development machine.

## Deployment listing gate

`pnpm lab:self-check --fixture <module.ts>` runs one throwaway game provided by a typed `DeploymentCheckPort` (see
`self-check.ts`). The deployment fixture creates it through the current launcher, approves its bot devices and prepares
domain prerequisites. Each `RouteCase` supplies a generated command, its signing account and isolated client, and an
assertion over that client's Herald store. Entity identifiers are resolved from facts by the fixture, never guessed from
a namespace layout.

The script checks coverage against every generated command variant, then sends each case through `Games.play`, waits for
both its receipt and Herald facts and checks its effect. Missing cases, rejected commands, wrong scope, timeouts, fact
failures and teardown failure refuse the listing gate. It prints one public JSON result with `passed`,
`firstFailedRoute`, `completed`, `gameId` and `elapsedMs`; exit 0 is the deployment's permission to list. The
launcher/ID regeneration and complete domain fixture binding must land before this can pass on a fresh shard.
