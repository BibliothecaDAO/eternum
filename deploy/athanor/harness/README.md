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

## Ops timing commands

`pnpm lab:harness:burst --out <public-result.json> --receipt-checkpoint <checkpoint.json>` releases 2,000 ordinary
signed invokes with the spike's warmed worker barrier. The built-in `wave-fixture.ts` creates an independent real game,
approved accounts, each player's Herald client, generated command and domain assertions. `heraldConfirmations` comes
from `connectHarnessGameClient`. No spike contracts, probe counters, simulations or synthetic forwarded IPs are used.
Setup requires the normal harness identity/launcher environment plus `SHARD_NODE_IMAGE`, recorded as public timing
evidence. `--fixture <module.ts>` supplies another typed `WaveFixturePort` for a different registered preset or action
route.

## 96 bots

`pnpm lab:harness:96:frontier` plays all 96 bots in one Frontier season with six workers. Each prepared account is
checked once, assigned to its own worker group and reads its own Herald store. Duplicate accounts, duplicate bot IDs,
missing participants and mismatched game assignments fail before workers start. Prepared credential files remain
private; public result files contain neither device keys nor signed bodies.
