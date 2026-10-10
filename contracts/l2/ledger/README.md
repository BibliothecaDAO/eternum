# Game ledger

The Starknet ledger holds separate liabilities for Frontier withdrawals, unfinished Blitz games, each season's chest
reserve and season prizes. Games use `{ shard: felt252, game_id: u32 }`; withdrawals use the shard chain ID and
confirmed transaction hash. The ledger has no deployed state to migrate. The live MMR token remains unchanged.

Frontier is funded once and unlocks through the end of the current seeded game day, from that day's first second.
`fund_frontier(shard, season_id, preset_id, start, seed, amount)` reads the same native preset's `day_unit_seconds` and
`season_bags` as the shard. Start and seed come from the funded game's single launch record; there is no independent end
argument. End derives as `start + season_bags * 20 * day_unit_seconds`. The shared calendar's five-day bags hold each
length 2..6 once. Frontier keeps its own window, independent of Blitz/MMR season windows. Ledger time is its Starknet
block timestamp; shard time is Madara's block timestamp. Numeric day boundaries match exactly for equal launch inputs
and timestamps. There is no documented hard bound on cross-chain clock lag: the relay must retain a confirmed claim
while L2's unlocked amount is insufficient and submit once the independent L2 gate fits. Do not trust a relay-supplied
future timestamp or unlock future days to conceal clock lag. Operator payments are immediate, retry-safe and bounded by
the cumulative unlock. They carry no treasury cut. Only the admin unpauses; the pauser can pause payouts.

The immutable `claim_window_seconds` preset defaults to seven days. The shard stops new withdrawals one hour before
`season.end + claim_window_seconds`, leaving the constant 3600-second reporting grace period. The ledger accepts a first
report strictly before that deadline. Reports move no money and have no aggregate cap or counter; payment remains
bounded by the pool's unlocked amount. There is no administrative report correction entry.

`close_frontier` runs at or after the deadline, voids every unpaid report without scanning individual claims, and
returns `pool - paid` to the treasury. The existing closed season plus payment record determines whether the report is
void; the relay must recover that fact from the views and stop retrying voided claims. Paid retries remain harmless;
unpaid payments after closure refuse.

Blitz settlement takes one `protocol_cut_bps` treasury cut on the whole incoming game pot: entries and paid swords/shields. The default is 2000 bps. The remaining pot splits by `chest_lords_bps` into the season's chest reserve
and season prize pool. Refunds return the original payment before any settlement cut. Chest and season payouts have no
second cut. Frontier's configuration preset keeps its cut at zero.

Registration custody is keyed by `{ shard, slot_id }`. Slots have no player cap. Each wallet registers once and pays its
entry and optional flags. The launcher resolves identity at slot close and creates groups of at most 24 on the shard.
The ledger stores only paying wallets, in registration order. The operator marks unseated wallets refundable; refunds
return their exact payment and credits, even while paused. Cancelling or aborting a slot opens refunds for all remaining
unconsumed entries.

`apply_results(slot, game_id, ranked)` settles one actual game. Its pot includes only those players' payments, which are
subtracted from the slot's remaining custody. Each registration records its consuming game, so another result or refund
cannot spend it again. The result commitment remains keyed by `{ shard, game_id }`. Slot opening leaves one settlement
tick between the scheduled game end and the season cutoff.

## Package checks

Run only these package checks for this ledger work; do not run the world suite:

```sh
cd contracts/l2/ledger
flock /tmp/eternum-scarb.lock bash -c 'scarb fmt --check && scarb build && snforge test'
cd ../collectibles
flock /tmp/eternum-scarb.lock bash -c 'scarb fmt --check && scarb build && snforge test'
```

Clients read `lords()` and `chest_collection()` from the ledger before balance, allowance, transfer or opening calls.
These public views return the constructor's addresses on every network, including while paused; a mainnet token address
is not a rehearsal dependency.

## Sepolia rehearsal

The owner-run path is `scripts/commands/deployment/sepolia.js`. It was written for this change and has not been
executed. It refuses any provider whose chain ID is not `SN_SEPOLIA`, deploys a publicly mintable **Test LORDS** token,
a fresh MMR contract and two fresh collectible collections, then deploys the ledger. It grants the ledger the existing
MMR updater and collection minter roles, configures test metadata, registers separate Blitz (ID 1) and zero-cut Frontier
(ID 2) test presets, opens a Blitz season and funds Frontier once using all six ABI arguments. The public manifest reads
all eight `FrontierSeason` fields from the ledger; its derived Frontier end is independent of `SEPOLIA_SEASON_END`,
which schedules Blitz. It writes only public addresses, season data and transaction hashes under the ignored `target/`
directory.

After the package build, `node --test scripts/commands/deployment/frontier.test.js` checks rehearsal calldata and
Frontier response parsing against the package's actual built ABI without loading a signer or deploying.

Build release artifacts first, under the same lock. These commands compile each package using its pinned toolchain:

```sh
(cd contracts/l2/ledger && flock /tmp/eternum-scarb.lock scarb build --release)
(cd contracts/l2/mmr && flock /tmp/eternum-scarb.lock scarb build --release)
(cd contracts/l2/collectibles && flock /tmp/eternum-scarb.lock scarb build --release)
```

The owner supplies `SEPOLIA_RPC_URL`, `SEPOLIA_ACCOUNT_ADDRESS`, `SEPOLIA_ACCOUNT_PRIVATE_KEY`,
`SEPOLIA_OPERATOR_ADDRESS`, `SEPOLIA_PAUSER_ADDRESS`, `SEPOLIA_SHARD_CHAIN_ID` (a non-zero felt), `SEPOLIA_GAME_SEED`
(the funded shard game seed), `SEPOLIA_SEASON_START`, `SEPOLIA_SEASON_END` (Unix seconds), `SEPOLIA_FRONTIER_POOL_WEI`,
`SEPOLIA_CHEST_BAND_1_CID` through `SEPOLIA_CHEST_BAND_5_CID`, `SEPOLIA_COSMETIC_CID`. Choose a start far enough ahead to complete declarations and setup.

Run only when the owner authorizes deployment:

```sh
pnpm --dir contracts/l2/ledger/scripts deploy:sepolia
```

Use the resulting `target/sepolia-deployment.json` to configure the relay and launcher. Match the shard's Frontier
season window and pool to the deployed ledger. Mint test LORDS to test wallets, approve the ledger, and register on L2;
feed that roster into the shard. Play a withdrawal and a Blitz match, then relay the actual confirmed withdrawal hash
and the actual wallet/rank rows. Verify `get_payment`, wallet balances, `get_result_commitment`, minted chest IDs,
`get_chest` and the growing season pool. Trade a chest, approve its burn, call `open_request`, then call `open_finish`
at least eleven blocks later from another wallet. Verify delivery to the requester and reserve conservation. Setup
registers all five band CIDs and one test cosmetic attribute per rarity. The test chest share and curve numbers are
presets for rehearsal, not approved production balance values.

## Mainnet prerequisites

No mainnet deployment or live upgrade is performed by this package check. Before value is enabled, the owner must
complete the design's contract audit and Sepolia withdrawal/result rehearsal, supply constructor addresses and deployer
credentials, grant the ledger `UPDATER_ROLE` on the existing MMR token, and grant collection mint roles. The live MMR
implementation remains unchanged. The chest collection needs an authorized, storage-compatible upgrade exposing
`mint_with_id`, plus metadata for all five new band kinds. Use the existing mainnet deployment path only after these
gates; its constructor is
`(admin, operator, treasury, lords, mmr_token, loot_chest, cosmetics)`.
