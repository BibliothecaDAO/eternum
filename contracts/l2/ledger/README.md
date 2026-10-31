# Game ledger

The Starknet ledger holds separate liabilities for Frontier withdrawals, unallocated Blitz slots, each season's chest
reserve and season prizes. Slots use `{ shard: felt252, slot_id: u32 }`; results use `{ shard, game_id }`. Withdrawals
use the shard chain ID and confirmed transaction hash. The ledger has no deployed state to migrate. The live MMR token
remains unchanged.

Frontier is funded once, before its end, and unlocks through the end of the current seeded game day. Funding after the
start immediately unlocks elapsed days and the current day; it never unlocks future days.
`fund_frontier(shard, season_id, preset_id, start, end, seed, amount)` takes the start, end and seed from the confirmed
shard game. The preset supplies `day_unit_seconds` and the claim window; it carries no season length. The supplied
window must be positive and contain a whole number of five-day bags, each lasting `20 * day_unit_seconds`; each bag
holds the lengths 2..6 once. Unlock and the claim deadline use the stored end. Frontier keeps its own window,
independent of Blitz/MMR season windows. Ledger time is its Starknet block timestamp; shard time is Madara's block
timestamp. Numeric day boundaries match exactly for equal launch inputs and timestamps. There is no documented hard
bound on cross-chain clock lag: the relay must retain a confirmed claim while L2's unlocked amount is insufficient and
submit once the independent L2 gate fits. Do not trust a relay-supplied future timestamp or unlock future days to
conceal clock lag. Operator payments are retry-safe and bounded by the cumulative unlock. Normal chest withdrawals pay
immediately from a ledger-wide token bucket, initialized in the constructor with 5,000 LORDS capacity and 5,000
LORDS/hour refill. `payout_allowance()` returns capacity, hourly refill, available balance and slow-lane delay. The cold
admin can change capacity and refill through `set_payout_allowance`, each between 1 and 5,000 LORDS; changing settings
never replenishes the bucket. A depleted allowance defers a claim until refill. These limits apply across all Frontier
seasons and shards using this ledger. Payments carry no treasury cut.

Prizes and single claims above the current capacity use a one-hour slow lane instead of the bucket. The separate monitor
checks reports and recipient authority during that interval and can pause before payment. The pauser can pause; only the
admin unpauses. A monitor outage can expose all unlocked custody once slow-lane claims mature: the allowance bounds
instant payments, not every payment after an hour.

## Frontier settlement and carry

Players can withdraw LORDS manually during the season. The immutable `claim_window_seconds` preset defaults to seven
days; the shard's manual withdrawal cutoff remains one hour before `season.end + claim_window_seconds`. That window does
not limit automatic sweeps or ledger reporting while open. Its deadline bounds how long unpaid claims can hold
settlement.

After the game ends, the relay sweeps each realm's remaining LORDS to its owner through `sweep_lords`, producing the
same withdrawal receipt as a manual withdrawal. An empty realm is a no-op. The relay reports and pays these receipts
alongside the season prizes through the existing ledger path. Chest reports remain accepted while the season is open,
including after the manual claim window. Reports move no money; an unpaid-report counter prevents early closure while
any recorded claim remains unpaid; payment remains bounded by the pool's unlocked amount. There is no administrative
report correction entry.

For slow-lane claims only, `prepare_payment(shard, claim_id, wallet)` binds the linked recipient and emits its reported
claim again. `pay` requires that recipient and waits one hour from preparation. Changing the recipient restarts the
delay; an identical preparation is a no-op. The relay records the signed recipient decision through identity before
broadcast, and the separate monitor checks it before payment. Binding prevents redirection of an already mature large
claim or prize, which would bypass the instant allowance. Normal claims need no preparation transaction. Missing-wallet
claims remain reported without a recipient; their slow-lane wait starts once a wallet is prepared.

The relay checks a confirmed post-end snapshot with no remaining realm LORDS and chest receipts equal to the consumed
world budget. Before the claim deadline, it settles only when the prize pool is fully issued and all chest and prize
receipts match confirmed L2 paid totals. A missing wallet or unknown account stays deferred and retries. If no prize
winners qualify, the unallocated prize reserve waits for the deadline too.

`settle_frontier(shard, season_id, chest_withdrawn, prize_withdrawn)` is the only closure entrypoint. It requires an
unpaused ledger, the operator role, the season's end and supplied totals equal to `paid` and `prize_paid`. Before the
deadline it also requires no unpaid reports, the entire prize pool paid and a matching `report_settlement` proposal at
least one hour old. `get_settlement` exposes the proposed chest/prize totals and earliest close timestamp. Identical
proposal retries preserve that timestamp; changed totals restart it. The independent monitor checks each
`SettlementReported` event against a confirmed post-end shard snapshot, zero remaining realm LORDS, complete prize
issuance and exact receipts, and pauses on disagreement. The ledger cannot independently prove shard history; preventing
a forged early close depends on the monitor completing this check and landing a pause within the hour.

Once the claim deadline passes on the confirmed L2 head, the relay settles with the L2 paid totals even if claims remain
unpaid. Closure voids those claims, including missing-wallet claims, for both chests and prizes. New chest or prize
reports and unpaid payments then refuse; already paid retries remain harmless. A pause blocks settlement at either time.

Settlement credits chest `pool - paid` to carry once. At or after the deadline it also credits
`prize_pool - prize_paid`, so an unpaid or unallocated prize reserve reaches the next season. It transfers nothing to
the treasury. Repeating settlement with the same totals is harmless. Funding an eligible later season consumes available
carry; for an already funded season, use:

```sh
pnpm --dir contracts/l2/ledger/scripts carry:frontier <dev|production> <previous-game-id> <next-game-id>
```

The command requires the previous season to be closed, then calls only `apply_frontier_carry`. The destination must be
open, not yet ended, and start at or after the carried season's end. Applying carry consumes its balance once; zero
carry is a no-op. Settled carry does not wait for the manual claim deadline.

This lifecycle requires the new Games root, matching libraries and release, fresh ledger, relay and client together. The
existing dev ledger retains its deployed behavior; the updated carry command still refuses an open previous season there
and never initiates its legacy close. Rehearse sweep, payment, settlement and carry against compatible contracts before
enabling production value.

## Blitz custody and rewards

Blitz settlement takes one `protocol_cut_bps` treasury cut on the whole incoming game pot: entries and paid
swords/shields. The default is 2000 bps. The remaining pot splits by `chest_lords_bps` into the season's chest reserve
and season prize pool. Refunds return the original payment before any settlement cut. Chest and season payouts have no
second cut. Frontier's configuration preset keeps its cut at zero.

Registration custody is keyed by `{ shard, slot_id }`. Slots have no player cap. Each wallet registers once and pays its
entry and optional flags. The launcher resolves identity at slot close and creates groups of at most 24 on the shard.
The ledger stores only paying wallets, in registration order. The operator marks unseated wallets refundable; refunds
return their exact payment and credits when unpaused. Cancelling or aborting a slot opens refunds for all remaining
unconsumed entries.

`apply_results(slot, game_id, ranked)` settles one actual game. Its pot includes only those players' payments, which are
subtracted from the slot's remaining custody. Each registration records its consuming game, so another result or refund
cannot spend it again. The result commitment remains keyed by `{ shard, game_id }`. Slot opening leaves one settlement
tick between the scheduled game end and the season cutoff.

Results contain only wallet and competition rank, sorted by rank then wallet on ties. The version-3 commitment hashes
`['ETERNUM_BLITZ_RESULT', 3, shard, game_id, count, wallet, rank, ...]`. The shard must not draw chest contents. MMR and
chest bands share the tie-average percentile. Five bands cover 0–20%, 20–40%, 40–60%, 60–80% and 80–100%; the 100%
endpoint stays in the fifth band. A singleton belongs to the first band. Each season uses one immutable preset,
including its games, so a chest needs only its band and season to identify its odds and entry-fee shares.

`preview_mmr(slot, ranked)` is a public read-only view for a running game's leaderboard. Pass the actual game's complete
roster of `{ wallet, rank }` rows, using the paying L2 wallets (not shard signer addresses), sorted by rank then numeric
wallet address within ties. Ranks use competition positions: `1, 1, 3`, not `1, 1, 2`. The slot key selects the
immutable MMR preset and each registration's sword/shield purchases; no game ID or caller account is needed. The roster
may be a subset of the slot because a slot can contain several games.

The result is an array, in input order, of `{ wallet, mmr_before: u128, mmr_after: u128, delta: i32 }`. Ratings and
deltas are whole MMR points, after truncating the token's 18 decimal places, just as in settlement. `delta` is signed;
use the ABI's signed-integer decoder (raw negative felts are field-modulus encoded). Disabled MMR and single-player
games return zero deltas. The view uses the same calculation as settlement, including median, ties, regression, limits
and purchased flags. It writes no state and emits no events.

An empty or malformed ranking, duplicate/unregistered/refundable/already-settled wallet, or missing/cancelled slot
reverts. The view intentionally does not enforce the settlement clock or operator role: it answers a hypothetical
ranking before the game ends. It cannot verify shard scores or roster completeness. It reads current token ratings;
settling another game can change a later preview. Equality with settlement assumes the same roster, ranks, preset, flags
and token ratings at execution. After settlement, display `get_player_result` instead of previewing again.

Chests are ordinary transferable NFTs. The holder approves the ledger, then calls `open_request(token_id)`. This burns
the token permanently and records the requester and block B; burning removes custody and cancellation machinery. No
request can be cancelled or repeated. Anyone calls `open_finish(token_id)` once the tip reaches B+11: it reads exactly
block B+1 through `get_block_hash_syscall`, hashes that block hash with the chest ID and season, selects the band's
outcome, and delivers to the requester. A separate hash selects uniformly among that cosmetic rarity's items. No caller,
timestamp, finish block or Cartridge VRF enters the draw. The request never expires, and anyone can finish it later. A
failed delivery can be attempted again, but its fixed entropy cannot change the outcome.

A LORDS outcome pays `band.lords_shares * preset.entry_fee` only when the season's chest reserve holds the whole amount.
Otherwise the same draw entropy selects among the band's non-token weights, normalized without LORDS. No partial or zero
token reward is delivered. The reserve cannot touch Frontier, other seasons, unallocated slots or season-prize custody.
The first valid season top-list post sweeps the reserve into the prize pool; late chest openings still deliver cosmetics
or credits.

Both the treasury cut and chest share use the whole pot, including paid sword and shield flags: 10% treasury, 10% chest
reserve, 80% prize pool. Presets whose two shares exceed 100% are refused. Chest token rewards by best-to-worst band are
4 entries at 5%, 2 entries at 10%, 1 entry at 10%, then no tokens in the bottom two bands. Non-token odds keep their
relative proportions. With equally populated bands, expected token rewards are 10% of an entry per player; actual
payments depend on rank ties, lobby size and available reserve. Paid flags fund the pot without adding chests. The odds
and cosmetic inventory are registered as immutable presets through `scripts/chest-preset.js`.

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
at that position and pays its geometric preset share once. Pause blocks withdrawal reports/payments, Frontier
settlement, registrations, refunds, result settlement, chest finishes and season claims. Frontier funding, chest
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

## First deployment

Use the single [first deployment command](../../../deploy/first/README.md) for dev or production. It defaults to a
read-only dry run, creates the owner's three accounts, resumes fixed-address deployments and setup, and continues
through the shard, Workers, client and funded season. Its README is the deployment procedure. Dev uses test tokens on
Starknet mainnet; only public addresses enter `contracts/common/addresses/dev.json`.

All three value-plane packages use the root Scarb 2.13.1 and Starknet Foundry 0.51.2 pins. The command builds them on
the box under its shared lock. The ledger tests declare the production collectible implementation.

### Fund a Frontier season

Set the Frontier calendar first. When the shard confirms creation, take the actual game ID from the launch result or
Herald directory and fund it at once. The deployment check may have consumed earlier IDs. The funding command takes
`dev` or `production`, never a network name. Both run on `SN_MAIN`; `dev` selects `dev.json` through the shared staging
reader and `production` selects `production.json`. It reads the ledger and token from that environment's book, then
verifies `ledger.lords()` matches the token before approving anything. An undeployed address fails; it never falls back
to the other environment.

Supply the ledger admin's `STARKNET_ACCOUNT_ADDRESS` and `STARKNET_ACCOUNT_PRIVATE_KEY` as secrets, `STARKNET_RPC` for
Starknet mainnet, `NATIVE_WORLD_MANIFEST` for the shard, `RPC_URL` for that shard's public RPC, and `HERALD_URL` for its
HTTPS Herald. Give the command the amount to deposit as a positive whole number of LORDS (devLords for dev). The admin
must hold that amount in the selected environment's token and enough real mainnet STRK for fees. For dev, call
devLords's public `mint(recipient, amount)` to mint test tokens to the admin before funding; production uses real LORDS.
The command converts whole tokens to wei and refuses a deposit that does not fit u128 wei. For example, the argument
1000000 deposits exactly 1000000000000000000000000 wei.

```sh
# Replace 42 with the confirmed Frontier game ID; production selects the production book.
pnpm --dir contracts/l2/ledger/scripts fund:frontier dev 42 1000000
```

The command checks the shard chain ID, reads Herald's confirmed GameRegistry, ChestRules and SliceRules, and checks the
game against the shard RPC at that same block. It compares the day length and claim window with ledger preset (2 for
dev; the native preset ID for production), and submits approval plus the requested deposit with the game's start and end
in one transaction. The preset carries no pool. It waits for confirmation, rereads `get_frontier` and its preset, and
refuses a different start, seed, end, pool or day rule. Its public result includes the transaction hash and verified
funding. A season already running may be funded; a season at or past its end cannot. No caller-entered seed, start or
end can override the confirmed game.

The relay reads the confirmed ledger deposit and publishes its pool to the shard once, after checking the game start,
end and seed. Before publication the pool is zero and no ruin chest exists. Confirm a positive `LordsBudget.pool` in
Herald before expecting chest payouts. The release uses that deposited pool and the existing day schedule; publication
after the start releases elapsed days immediately, and unused daily tokens roll over.

`pnpm --dir contracts/l2/ledger/scripts test` checks deployment publication, setup separation, compiled funding
calldata, confirmed reads, mismatches and readback without a signer or live deployment.

Use the resulting public manifest to verify the deployment and the checked-in address book to configure service and
client builds. Match the shard's Frontier season window and published pool to the deployed ledger. Mint devLords to dev
wallets, approve the ledger, and register on L2; feed that roster into the shard. Play a withdrawal and a Blitz match,
then relay the actual confirmed withdrawal hash and the actual wallet/rank rows. Verify `get_payment`, wallet balances,
`get_result_commitment`, minted chest IDs, `get_chest` and the growing season pool. Trade a chest, approve its burn,
call `open_request`, then call `open_finish` at least eleven blocks later from another wallet. Verify delivery to the
requester and reserve conservation. Setup registers all five band CIDs and one test cosmetic attribute per rarity. The
test chest share and curve numbers are presets for rehearsal, not approved production balance values.

### Mainnet fee balances

devLords has no value and cannot pay network fees. Fund these accounts with **real mainnet STRK** before use:

| Account/key                                                                    | What needs STRK                                                                                                                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deployer/admin (generated and saved privately by the first deployment command) | Declares and deploys five contracts, sets roles/metadata/presets, opens the Blitz season, mints the dev pool and submits approval plus funding.                                      |
| Relay L2 signer (`LEDGER_OPERATOR_ADDRESS` / `LEDGER_OPERATOR_PRIVATE_KEY`)    | Opens/refunds Blitz slots, reports/pays withdrawals, settles results, posts season tops and finishes chests on mainnet.                                                              |
| Monitor L2 signer (`PAUSER_ACCOUNT_ADDRESS` / `PAUSER_PRIVATE_KEY`)            | Sends a pause for a proven mismatch and challenges an incorrect season top. Reads require RPC access, not transaction gas.                                                           |
| Launch Worker signer (`LAUNCH_DEPLOYER_PRIVATE_KEY`)                           | No mainnet STRK for its current work: it creates/settles games on the fee-free Madara shard and asks the relay to write L2 slots. Those L2 fees are paid by the relay account above. |

The relay's separate `SHARD_LEDGER_OPERATOR_PRIVATE_KEY` likewise signs only on the fee-free shard; it is not its funded
L2 signer. Players also need real mainnet STRK for test-token minting, approvals, registration, refunds and claims, even
though all dev game value is devLords. No fixed STRK amount is promised; fund for the current transaction fee estimates
and replenish the relay/monitor accounts before their balances are exhausted. Keep signing keys in secrets, never in the
address books or public deployment manifest.

## Production prerequisites

Before enabling production value, complete the dev withdrawal/result rehearsal and the review of the live contracts. The
existing chest collection needs an authorized, storage-compatible upgrade exposing `mint_with_id`, metadata for all five
band kinds, and the ledger's minter role. The existing rating token needs the ledger's updater role. The first
deployment command uses the public production book and the owner's cold-admin address; it produces unsigned setup and
funding calls for that account. It never receives its key. Production constructor order remains
`(admin, operator, treasury, lords, mmr_token, loot_chest, cosmetics)`.
