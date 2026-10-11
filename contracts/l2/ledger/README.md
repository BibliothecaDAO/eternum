# Game ledger

The Starknet ledger holds separate liabilities for Frontier withdrawals, unallocated Blitz slots, each season's chest
reserve and season prizes. Slots use `{ shard: felt252, slot_id: u32 }`; results use `{ shard, game_id }`. Withdrawals
use the shard chain ID and confirmed transaction hash. The ledger has no deployed state to migrate. The live MMR token
remains unchanged.

Frontier is funded once, before its end, and unlocks through the end of the current seeded game day. Funding after the
start immediately unlocks elapsed days and the current day; it never unlocks future days.
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

Blitz settlement takes one `protocol_cut_bps` treasury cut on the whole incoming game pot: entries and paid
swords/shields. The default is 2000 bps. The remaining pot splits by `chest_lords_bps` into the season's chest reserve
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

Results contain only wallet and competition rank, sorted by rank then wallet on ties. The version-3 commitment hashes
`['ETERNUM_BLITZ_RESULT', 3, shard, game_id, count, wallet, rank, ...]`. The shard must not draw chest contents. MMR and
chest bands share the tie-average percentile. Five bands cover 0–20%, 20–40%, 40–60%, 60–80% and 80–100%; the 100%
endpoint stays in the fifth band. A singleton belongs to the first band. Each season uses one immutable preset,
including its games, so a chest needs only its band and season to identify its odds and nominal LORDS amount.

Chests are ordinary transferable NFTs. The holder approves the ledger, then calls `open_request(token_id)`. This burns
the token permanently and records the requester and block B; burning removes custody and cancellation machinery. No
request can be cancelled or repeated. Anyone calls `open_finish(token_id)` once the tip reaches B+11: it reads exactly
block B+1 through `get_block_hash_syscall`, hashes that block hash with the chest ID and season, selects the band's
outcome, and delivers to the requester. A separate hash selects uniformly among that cosmetic rarity's items. No caller,
timestamp, finish block or Cartridge VRF enters the draw. The request never expires, and anyone can finish it later. A
failed delivery can be attempted again, but its fixed entropy cannot change the outcome.

A LORDS outcome pays `min(band.lords_amount, season.chest_reserve)`. It cannot touch Frontier, other seasons,
unallocated slots or season-prize custody. The first valid season top-list post after season end sweeps the reserve into
the prize pool before allocating shares. Later openings still deliver cosmetics or credits; LORDS then pays zero against
the empty reserve. Outstanding chest requests are not a debt for their nominal amount.

Rehearsal presets propose LORDS amounts 700 / 200 / 100 / 50 / 20 by best-to-worst band, with LORDS probabilities 10% /
10% / 5% / 4% / 0%. For 24 untied players, the bands contain 5 / 5 / 4 / 5 / 5 players. At 500 LORDS per entry, 20%
treasury and 5% chest share: `24*500*0.8*0.05 = 480`. Nominal expected chest rewards are
`5*0.10*700 + 5*0.10*200 + 4*0.05*100 + 5*0.04*50 = 480`. Actual expected chest payments can be lower because of reserve
caps, late openings, ties and other lobby sizes; every remainder joins season prizes. Paid flags increase funding
without multiplying chests. Changing the treasury to 10% yields 540 per reference game: the owner can retune the reward
presets, or let the extra reserve join season prizes. The full odds table and test inventory live in
`scripts/chest-preset.js` and are registered as immutable admin presets. They are not approved production values.

The Starknet sequencer can choose/order transactions and influence the target block's contents, timestamp and hash,
foresee the resulting outcomes, or censor requests/finishes. This is a future-block draw, not an unbiased VRF. Ordinary
holders cannot know their draw before consuming the token or select another block afterward. The accepted tradeoff is
for cosmetic rewards and small reserve-capped LORDS amounts; it does not secure Frontier or season prizes.

The existing collectible allows five new metadata kinds, 0x301–0x305 in the test preset. Each needs its own nonempty
IPFS image CID and rank-band art; the metadata updater should name packed trait position 0 as Rank band (values 1–5) and
position 1 value 3 as the new seasonal chest family. Season identity lives in `get_chest`, not the packed image kind.
Every cosmetic item also needs its image mapping and rarity metadata. A default image alone does not satisfy minting.
The chest collection needs the existing storage-compatible `mint_with_id` upgrade and MINTER_ROLE for the ledger.
Cosmetics use the existing `mint` API. Neither collectible storage nor the old opening contracts change; legacy kinds
0x101 and 0x201 retain their current claim path and randomness.

The new request/odds maps replace fixed contents and shard reward draws. One shared reserve per season replaces
per-chest LORDS liabilities. The cost is band/inventory preset storage, request state and two opening transactions;
there is no new token collection, oracle, cancellation path, expiry timer or per-movement fee rule.

Season ratings freeze at the end. The operator posts the top list; anyone may challenge a missing better participant for
one hour. Posting writes the complete list and its allocations in one transaction. A short or challenged list cannot
pay. Winners call `claim_season(season_id, position)` with their zero-based list position; the ledger checks the caller
at that position and pays its geometric preset share once. Pause blocks withdrawals, chest finishes and season claims;
refunds and expired Frontier returns remain available; registrations, Frontier funding, result settlement, chest
requests and challenges remain available. Settlement's input treasury transfer continues to its fixed address.

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

## Deploy once, fund each Frontier game separately

The owner-run Sepolia deployment is `scripts/commands/deployment/sepolia.js`. It refuses any provider whose chain ID is
not `SN_SEPOLIA`, deploys a publicly mintable **Test LORDS**, a fresh MMR token, two collectible collections and the
ledger. As soon as those contracts exist, it writes `contracts/l2/ledger/target/sepolia-deployment.json` and merges
`ledger` and `mmrToken` into `contracts/common/addresses/sepolia.json`, preserving the Realms address and other entries.
The manifest survives a later setup failure; inspect the receipt and these existing contracts before any redeployment.
There is no automatic resume or redeployment on failure.

Setup grants updater/minter/pauser roles, configures metadata, registers Blitz (1) and Frontier (2) presets, and opens
Blitz season 1. Deployment neither reads nor funds a Frontier game. Its only season window is the separate Blitz
season's existing start/end inputs; no Frontier clock, seed, pool or shard is a deployment input.

Build release artifacts first, using each package's pinned toolchain:

```sh
(cd contracts/l2/ledger && flock /tmp/eternum-scarb.lock scarb build --release)
(cd contracts/l2/mmr && flock /tmp/eternum-scarb.lock scarb build --release)
(cd contracts/l2/collectibles && flock /tmp/eternum-scarb.lock scarb build --release)
```

For deployment supply `SEPOLIA_RPC_URL`, `SEPOLIA_ACCOUNT_ADDRESS`, `SEPOLIA_ACCOUNT_PRIVATE_KEY`,
`SEPOLIA_OPERATOR_ADDRESS`, `SEPOLIA_PAUSER_ADDRESS`, `SEPOLIA_SEASON_START`, `SEPOLIA_SEASON_END` (the **Blitz**
window, Unix seconds), `SEPOLIA_CHEST_BAND_1_CID` through `SEPOLIA_CHEST_BAND_5_CID`, and `SEPOLIA_COSMETIC_CID`.
Blitz's `open_season` enforces its own valid window on chain. Run only with the owner's deployment authorization:

```sh
pnpm --dir contracts/l2/ledger/scripts deploy:sepolia
```

Review and commit the public address-book changes, then rebuild/redeploy services and client. Identity reads this
`mmrToken` and the existing `realms` address from the same book; its rating-history source must describe that rating
deployment. The manifest's `seasonId: 1` refers only to Blitz.

### Fund a Frontier season

After the shard confirms creation, take the actual game ID from the launch result or Herald directory. The deployment
check may have consumed earlier IDs. The funding command works on Sepolia or mainnet without redeploying contracts. It
reads the ledger from that network's address book and LORDS from `ledger.lords()`.

Supply the ledger admin's `STARKNET_ACCOUNT_ADDRESS` and `STARKNET_ACCOUNT_PRIVATE_KEY` as secrets, `STARKNET_RPC` for
the selected L2, `NATIVE_WORLD_MANIFEST` for the shard, `RPC_URL` for that shard's public RPC, and `HERALD_URL` for its
HTTPS Herald. The admin must hold the game's full pool in the ledger's LORDS token and enough STRK for fees. On Sepolia,
that token's public `mint(recipient, amount)` supplies test LORDS; mint to the admin before funding. Amounts are wei.
For example, a confirmed 1,000,000-LORDS chest pool needs exactly 1000000000000000000000000 wei.

```sh
# Replace 42 with the confirmed Frontier game ID; use mainnet instead of sepolia for mainnet custody.
pnpm --dir contracts/l2/ledger/scripts fund:frontier sepolia 42
```

The command checks the shard chain ID, reads Herald's confirmed GameRegistry, ChestRules and SliceRules, and checks the
game against the shard RPC at that same block. It compares the day length, derived end and claim window with ledger
preset (2 on Sepolia; the native preset ID on mainnet), derives the amount from the confirmed chest pool × 10^18, and
submits approval plus funding in one transaction. It waits for confirmation, rereads `get_frontier` and its preset, and
refuses a different start, seed, end, pool or day rule. Its public result includes the transaction hash and verified
funding. A season already running may be funded; a season at or past its end cannot. No caller-entered seed, start, end
or amount can override the confirmed game.

`pnpm --dir contracts/l2/ledger/scripts test` checks deployment publication, setup separation, compiled funding
calldata, confirmed reads, mismatches and readback without a signer or live deployment.

Use the resulting public manifest to verify the deployment and the checked-in address book to configure service and
client builds. Match the shard's Frontier season window and pool to the deployed ledger. Mint test LORDS to test
wallets, approve the ledger, and register on L2; feed that roster into the shard. Play a withdrawal and a Blitz match,
then relay the actual confirmed withdrawal hash and the actual wallet/rank rows. Verify `get_payment`, wallet balances,
`get_result_commitment`, minted chest IDs, `get_chest` and the growing season pool. Trade a chest, approve its burn,
call `open_request`, then call `open_finish` at least eleven blocks later from another wallet. Verify delivery to the
requester and reserve conservation. Setup registers all five band CIDs and one test cosmetic attribute per rarity. The
test chest share and curve numbers are presets for rehearsal, not approved production balance values.

## Mainnet prerequisites

No mainnet deployment or live upgrade is performed by this package check. Before value is enabled, the owner must
complete the design's contract audit and Sepolia withdrawal/result rehearsal, supply constructor addresses and deployer
credentials, grant the ledger `UPDATER_ROLE` on the existing MMR token, and grant collection mint roles. The live MMR
implementation remains unchanged. The chest collection needs an authorized, storage-compatible upgrade exposing
`mint_with_id`, plus metadata for all five new band kinds. Use the existing mainnet deployment path only after these
gates; its constructor is `(admin, operator, treasury, lords, mmr_token, loot_chest, cosmetics)`.

After mainnet ledger deployment, register the shard's Blitz preset through the existing admin preset command. Its
dry-run output includes that preset's ledger calldata. Supply `DEPLOYER_ACCOUNT_ADDRESS`, `DEPLOYER_PRIVATE_KEY`,
`LEDGER_ADMIN_ADDRESS`, `LEDGER_ADMIN_PRIVATE_KEY`, `LEDGER_ADDRESS`, `LEDGER_RPC_URL`, `RPC_URL` and
`NATIVE_WORLD_MANIFEST` for the approved deployment; run this only when the owner authorizes registration:

```sh
bun config/deployer/clean/registrar/register-preset.ts --preset-id 2 --environment madara.blitz --dry-run
bun config/deployer/clean/registrar/register-preset.ts --preset-id 2 --environment madara.blitz
```
