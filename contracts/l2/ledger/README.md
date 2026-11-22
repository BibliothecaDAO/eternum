# Game ledger

The Starknet ledger holds separate liabilities for Frontier withdrawals, unallocated Blitz slots, each season's chest
reserve and season prizes. Slots use `{ shard: felt252, slot_id: u32 }`; results use `{ shard, game_id }`. Withdrawals
use the shard chain ID and confirmed transaction hash. This revision deploys to a fresh ledger; it does not migrate
existing obligations. The live MMR token remains unchanged.

Frontier is funded once, before its end, and unlocks through the end of the current seeded game day. Funding after the
start immediately unlocks elapsed days and the current day; it never unlocks future days.
`fund_frontier(shard, season_id, preset_id, start, end, seed, amount)` takes the start, end and seed from the confirmed
shard game. The preset supplies `day_unit_seconds` and the claim window; it carries no season length. The supplied
window must be positive. Seeded five-day bags keep their lengths 2..6 once each, with the final day clipped at the
stored end. A final stub under two units joins the preceding day; a season shorter than its first day has one clipped
day. Unlock and the claim deadline use the stored end. Frontier keeps its own window, independent of Blitz/MMR season
windows. Ledger time is its Starknet block timestamp; shard time is Madara's block timestamp. Numeric day boundaries
match exactly for equal launch inputs and timestamps. There is no documented hard bound on cross-chain clock lag: the
relay must retain a confirmed claim while L2's unlocked amount is insufficient and submit once the independent L2 gate
fits. Do not trust a relay-supplied future timestamp or unlock future days to conceal clock lag. Payments carry no
treasury cut and remain bounded by cumulative unlock and custody.

Every Frontier payment, including prizes and swept balances, requires both the operator account and an independent
co-signature. The co-signer checks the confirmed shard receipt, funding binding and identity's currently linked wallet
on demand. The ledger checks Stark-curve ECDSA over the exact shard, season, claim ID, recipient, amount and prize
rank/count, domain-separated by operation, L2 chain, ledger address and key-rotation epoch. Claim IDs can pay only once.
There is no additional payout timer or rate limit; unavailable verification leaves the claim queued. The relay checks
confirmed paid state before retrying, so a lost acknowledgment does not pay twice.

The constructor requires the co-signer's public key. `cosigner()` returns that key and its epoch; cold-admin
`set_cosigner(public_key)` rotates it and increments the epoch, invalidating old signatures even if the same key later
returns. The private key stays in a mode-0600 file in a separate process on the production box, outside the relay's
Cloudflare account. See
[the co-signer deployment procedure](../../../deploy/athanor/README.md#independent-payout-co-signer). Only the cold
admin can unpause.

## Frontier closure

Nothing off chain closes a Frontier season: the relay runs no sweep and sends no `settle_frontier`, and the co-signer
signs no settlement. Season 1 funds no Frontier pool; its LORDS leave through [`RaceRewards`](#race-rewards).

For a monitor-proven forgery, the cold admin can call `void_report(shard, claim_id)` only while paused. It clears an
unpaid report and pending count, and frees its prize rank. The fixed prize count resets only when no reported ranks
remain, including paid ranks. Absent-report retries are harmless; paid reports cannot be voided. Rotate the compromised
operator, void the forged report, clear the monitor's exact recorded fault, then unpause after checking the repair. The
relay rereads held conflicting receipts and reports them again once their ledger entry is absent.

The relay records its signed recipient decision through identity before broadcast for the monitor's payment audit. The
co-signer independently reads the receipt account's current linked wallet from identity; it accepts no recipient
assertion from the relay. Missing-wallet claims remain deferred until the player links a wallet.

The independent monitor still checks raw reports, payments, results and conservation. Proven mismatches pause at once;
unavailable report evidence retries and makes health unhealthy immediately, pausing after ten continuous minutes with a
known report waiting. Its confirmed STRK balance appears in health, with a warning below 0.1 STRK. The co-signer needs
no STRK because it signs messages rather than submitting transactions.

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

## Race rewards

`RaceRewards` (`src/race.cairo`) is a separate class that holds one race's LORDS apart from deposit custody. It
configures nothing of its own: the operator role, the co-signer key and epoch, and the pause are read from the ledger,
and its treasury is fixed at construction to the ledger's. The holder of the ledger's `DEFAULT_ADMIN_ROLE` funds it and
may upgrade it in place, so a fix never moves a funded pool.

The owner runs three steps from `contracts/l2/ledger/scripts`, each with `--addresses dev` or `--addresses production`.
Without `--execute` a step reads the chain and prints the transaction it would send; with it, it sends that one
transaction. A step already applied prints so and sends nothing.

```sh
pnpm race declare --addresses dev
pnpm race deploy --addresses dev
pnpm race fund --addresses dev --shard 0x… --game 7 --amount 500000
pnpm race status --addresses dev --shard 0x… --game 7
```

- `declare` builds the class and declares it.
- `deploy` refuses a ledger whose stored treasury differs from the address book's, deploys the class bound to that
  ledger and treasury, and writes `raceRewards` into `contracts/common/addresses/<book>.json`. Commit that file and
  redeploy the relay and the co-signer box from it: until then the relay skips races and the co-signer refuses race
  signatures. If the step stops after its deployment printed the address, write that address into the book by hand
  rather than deploying a second class.
- `fund` approves and funds one race in a single transaction, once, in whole LORDS, from the ledger admin account.
- `status` prints the race as the class answers it and, with `VALUE_RELAY_URL` set to the game's origin, the relay's
  receipt of the rewards that were still unpaid when it closed (home, amount, reason).

The relay sends everything after funding. Once Herald confirms a race's result it posts the total, pays each home's
linked wallet, at most 20 homes a pass, and closes when every reward is paid. A home with no payout wallet is tried
again every pass for seven days after the post; then the relay keeps the receipt and closes, and what is left goes to
the treasury. An unfunded race is skipped on staging and reported as a fault on production. No script posts, pays or
closes: the relay is the only sender, under the co-signer's recomputation.

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
through the shard, Workers, client and season calendar. Its README is the deployment procedure. Dev uses test tokens on
Starknet mainnet; only public addresses enter `contracts/common/addresses/dev.json`.

All three value-plane packages use the root Scarb 2.13.1 and Starknet Foundry 0.51.2 pins. The command builds them on
the box under its shared lock. The ledger tests declare the production collectible implementation.

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
| Monitor L2 signer (`PAUSER_ACCOUNT_ADDRESS` / `PAUSER_PRIVATE_KEY`)            | Pauses proven mismatches or reports unverifiable for ten minutes, and challenges incorrect season tops. Reads require RPC access, not transaction gas.                               |
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
