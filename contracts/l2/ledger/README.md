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

The immutable `claim_window_seconds` preset defaults to seven days. The shard accepts withdrawals only before
`season.end + claim_window_seconds`; the ledger exposes this boundary as `frontier_claim_deadline` and refuses
`close_frontier` until that timestamp. Closing returns unused funds to the treasury. No withdrawal created at or after
the deadline can produce a valid shard receipt. Delivery of an older confirmed receipt can still be delayed: payments
remain possible until closure, so the admin must drain the relay's confirmed withdrawal backlog before closing. After
closure a previously paid claim remains a harmless retry; an unseen claim refuses with `Ledger: season closed`.

Blitz settlement takes one `protocol_cut_bps` treasury cut on the whole incoming game pot: entries, paid swords/shields
and sponsorship. The default is 2000 bps. The remaining pot splits by `chest_lords_bps` into the season's chest reserve
and season prize pool. Refunds return the original payment before any settlement cut. Chest and season payouts have no
second cut. Frontier's configuration preset keeps its cut at zero.

Each registration names its shard account explicitly: `register(key, account, sword, shield)`,
`register_with_pass(key, account, pass_id)` or `register_village(key, account, village_pass_id)`. The ledger stores the
paying wallet/account pair and rejects a zero account or a second seat for that account in the same shard/game. The
launcher freezes the ordered pairs from `get_registered_player(key, index)`; the old wallet-only roster view is removed.
No mutable identity link is consulted when the game starts. Results, MMR, refunds and prizes remain keyed by the paying
wallet. Changing a payout-wallet link afterward cannot rewrite that game's paid roster.

Registration does not prove ownership of a shard account. Naming another person's account or a nonexistent nonzero
address buys that exact seat and gives the payer no ability to sign plays as that account. It neither grants a role nor
transfers an account. The payer has spent their entry or burned their pass for a seat they cannot control; a holder of
the named account may still play it, and another wallet cannot buy a duplicate seat for that account in this game. No
cross-chain account-ownership oracle or identity lookup is introduced. The cost is one account field and one duplicate
seat map, replacing freeze-time off-chain wallet resolution.

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

A LORDS outcome pays `min(band.lords_amount, season.chest_reserve)`. It cannot touch Frontier, other seasons, unfinished
games or season-prize custody. The first valid season top-list post after season end sweeps the reserve into the prize
pool before allocating shares. Later openings still deliver cosmetics or credits; LORDS then pays zero against the empty
reserve. Outstanding chest requests are not a debt for their nominal amount.

Rehearsal presets propose LORDS amounts 700 / 200 / 100 / 50 / 20 by best-to-worst band, with LORDS probabilities 10% /
10% / 5% / 4% / 0%. For 24 untied players, the bands contain 5 / 5 / 4 / 5 / 5 players. At 500 LORDS per entry, 20%
treasury and 5% chest share: `24*500*0.8*0.05 = 480`. Nominal expected chest rewards are
`5*0.10*700 + 5*0.10*200 + 4*0.05*100 + 5*0.04*50 = 480`. Actual expected chest payments can be lower because of reserve
caps, late openings, ties and other lobby sizes; every remainder joins season prizes. Paid flags and sponsors increase
funding without multiplying chests. Changing the treasury to 10% yields 540 per reference game: the owner can retune the
reward presets, or let the extra reserve join season prizes. The full odds table and test inventory live in
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
one hour. A short or challenged list cannot pay. Winners then pull their geometric preset share once. Pause blocks
withdrawals, refunds, chest finishes and season claims; registrations, incoming funding, result settlement, chest
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
`SEPOLIA_CHEST_BAND_1_CID` through `SEPOLIA_CHEST_BAND_5_CID`, `SEPOLIA_COSMETIC_CID`, `SEPOLIA_SEASON_PASS_ADDRESS` and
`SEPOLIA_VILLAGE_PASS_ADDRESS`. Pass addresses are required constructor dependencies; the paid-entry rehearsal does not
invoke them. Choose a start far enough ahead to complete declarations and setup.

Run only when the owner authorizes deployment:

```sh
pnpm --dir contracts/l2/ledger/scripts deploy:sepolia
```

Use the resulting `target/sepolia-deployment.json` to configure the relay and launcher. Match the shard's Frontier
season window and pool to the deployed ledger. Mint test LORDS to test wallets, approve the ledger, and register on L2;
feed that roster into the shard. Play a withdrawal and a Blitz match, then relay the actual confirmed withdrawal hash
and the actual wallet/rank rows. Verify `get_payment`, wallet balances, `get_game.result_commitment`, minted chest IDs,
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
`(admin, operator, treasury, lords, mmr_token, season_pass, village_pass, loot_chest, cosmetics)`.
