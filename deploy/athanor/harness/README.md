# Player-signed bot runs

`pnpm lab:harness` uses each bot's approved device to sign one v3 `Games.play` invoke at its RPC nonce. The manifest
supplies the immutable gas bound. The public proxy adds the randomness proof. There is one action in flight per account
until the receipt and that bot's Herald transaction barrier both finish. Library rejection inside a successful invoke is
reported with the game's reason. A lost submission response is observed by its precomputed hash; the harness never
advances that account to another nonce while its outcome is unknown.

Account creation retains the identity service's bot-device approval route. Bots join and new games are created through
`HARNESS_ADMIN_RPC_URL`; player traffic uses `--rpc-url` and the matching Herald manifest. Administration belongs on the
private node, while gameplay goes through the public proxy. `--create-game` creates the Frontier game as the shard's
launcher instead of playing the directory's; only a measurement shard, whose runner made the harness its launcher,
accepts it. `NATIVE_WORLD_MANIFEST` must include `shard.chainId`, `shard.vrfPublicKey` and `shard.l2GasBound`.

`pnpm lab:harness:test` resolves workspace sources through this directory's tsconfig, so tests and workers use the
checkout's command bindings rather than another checkout's built packages. Run commands under
`flock /tmp/eternum-client.lock` on a shared development machine.

## Ops timing commands

`pnpm lab:harness:burst --out <public-result.json> --receipt-checkpoint <checkpoint.json>` releases 2,000 ordinary
signed invokes with the spike's warmed worker barrier. The built-in `wave-fixture.ts` creates an independent real game,
approved accounts, each player's Herald client, generated command and domain assertions. `heraldConfirmations` comes
from `connectHarnessGameClient`. No spike contracts, probe counters, simulations or synthetic forwarded IPs are used.
Setup requires the normal harness identity/launcher environment. `--fixture <module.ts>` supplies another typed
`WaveFixturePort` for a different registered preset or action route.

## 96 bots

`pnpm lab:harness:96:frontier` plays all 96 bots in one Frontier season with six workers. Each prepared account is
checked once, assigned to its own worker group and reads its own Herald store. Duplicate accounts, duplicate bot IDs,
missing participants and mismatched game assignments fail before workers start. Prepared credential files remain
private; public result files contain neither device keys nor signed bodies.

## Season 1 groundwork

Run the existing Frontier path with `--game-type frontier --functional --preset <preset id>` against a shard carrying
the matching release and registered preset. Resolve the Season 1 id from
[`FRONTIER_S1_PRESET_ID`](../../../config/source/common/native-preset-modes.ts); its starting stock and calendar live in
[`season-one.ts`](../../../config/source/frontier/season-one.ts). The earlier presets retain their own definitions. The
harness records the player actions and resulting Herald facts in its existing reports. It distributes free homes across
the Aspect catalog when `AspectRules` exists. Settlement sends the chosen `aspect`; held Realms may omit it and inherit
their Order's Aspect. Read `HomeAspect` and `AspectMembers` from the shared native store. Settlement also fields the
preset's starting armies. The harness reads the existing `ExplorerTroops` and `ArmySlot` facts and uses these armies
without raising replacements.

For the daily quest, `client.views.dailyQuest(home, timestamp)` reads the current objective, target, progress,
completion and collection from native facts. Collect a finished quest with
`client.setup.systemCalls.claim_daily_quest({ signer, home, day })`. The persisted receipt is `LaborGrant`; repeating
collection cannot pay twice. `QuestRules` replaces the old `LaborRules` in S1. The lifecycle quest regression drives
settlement, reveals and collection through player commands. On a world bane day this view returns the replacement quest
and the Aspect's completion count. `BaneProgress.ended_at` closes the effect interval; the quest remains for the day.
Collect again after the Aspect succeeds: `BaneGrant` records the second payment and prevents a third. Production and
stamina readers split accrual at both interval edges. The lifecycle world-bane regression settles homes, completes the
Lights and collects through the same player commands. The resource regression and client tests share the boundary and
remainder vectors. The Slice 1 dev preset is `FRONTIER_S1_DEV_PRESET_ID`; its Kingdom and Empire bane targets are capped
at City. Team issuance must record `FirstTeamBane` in the same transaction as the issued bane.

The home reward administration path is `Games.grant_labor`, with `Games.labor_grant` reading the recorded result. Both
dispatch to the existing Prizes class. `bash contracts/l3/check-native.sh` checks their compiled routing and runs the
lifecycle claim regressions; the integration fold owns this gate before further reward rules are added.
