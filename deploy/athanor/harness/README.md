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

`pnpm lab:self-check` creates one throwaway development game and approves one bot device. Its immutable fixture preset
103 copies Eternum's balance and mode rules, exposing all generated commands so each reaches its real domain guard.
Normal presets are unchanged. Setup uses the deployment's owner/launcher account on `HARNESS_ADMIN_RPC_URL`; each play
uses that account or the bot's account on the public stamping RPC. It checks the constructor's launcher, owner, VRF
point and gas bound against the deployment document before sending. The freshly generated schema must already be
deployed and served by Herald; this command never generates or deploys contracts.

The fixture requires 14 applied routes: settlement, naming, explorer creation/exploration/movement/removal, guild
creation/whitelist/removal/join/leave, six regional banks, and the two legitimate no-op lifecycle/faith routes. It tests
the other 58 routes with typed missing-state or mode-specific domain refusals taken from the contract guards. Every
refusal needs its exact `GAMEPLAY_REJECTED` receipt and matching Herald `REJECTED` reason, followed by unchanged
serialized game facts. A disabled mask, malformed command, admission revert or internal library failure cannot pass.
These refusal tests establish route dispatch and rollback; they do not establish successful bridge token transfers,
Blitz finalisation or every domain's funded happy path.

Missing cases, wrong scope, unexpected outcomes, timeouts, fact failures and teardown failure refuse the listing gate.
It prints public JSON with `passed`, `firstFailedRoute`, `completed`, `applied`, `refused`, `gameId` and `elapsedMs`;
exit 0 means this complete route smoke passed. Setup and receipt polling stop when the check ends. A deployment needing
different domain prerequisites can supply `--fixture <module.ts>` implementing `DeploymentCheckPort`; the complete
generated route catalogue remains mandatory. Entity identifiers always come from Herald facts.

## Ops timing commands

`pnpm lab:harness:burst --out <public-result.json> --receipt-checkpoint <checkpoint.json>` releases 2,000 ordinary
signed invokes with the spike's warmed worker barrier. The built-in `wave-fixture.ts` creates an independent real game,
approved accounts, each player's Herald client, generated command and domain assertions. `heraldConfirmations` comes
from `connectHarnessGameClient`. No spike contracts, probe counters, simulations or synthetic forwarded IPs are used.
Setup requires the normal harness identity/launcher environment plus `SHARD_NODE_IMAGE`, recorded as public timing
evidence. `--fixture <module.ts>` supplies another typed `WaveFixturePort` for a different registered preset or action
route.

`pnpm lab:harness:quiet --out <quiet.json> --checkpoint <checkpoint.json> --offset-ms 250` uses 24 distinct accounts in
an independent CreateExplorer game. Offsets are 0, 250 or 1,000 ms after the primary checkpoint. Alternatively use
`--close-log <node.log>` to release on an executed nonempty close-worker start. `--ready-file <ready.json>` marks that
the sender workers are warmed. These commands preserve public send timestamps, percentiles, completion counts, trigger
offsets and round trips. Visibility is measured at Herald's first transaction notice rather than a private node
WebSocket; the file declares that observer. Every pass also requires confirmed Herald facts and real domain assertions.
Request bodies and signing material stay in worker memory.

## 96 bots

`pnpm lab:harness:96 --rpc-url <public-rpc> --herald-url <herald>` plays four legal 24-player Blitz rosters for 10
minutes at 15-second cadence, retaining the existing 3,500-action acceptance gate. The contract caps a Blitz roster at
24; the driver does not relax it. `pnpm lab:harness:96:frontier` plays all 96 bots in one Frontier season with six
workers. Each prepared account is checked once, assigned to its own worker group and reads its own Herald store.
Duplicate accounts, duplicate bot IDs, missing participants and mismatched game assignments fail before workers start.
Prepared credential files remain private; public result files contain neither device keys nor signed bodies.
