# Game ledger

The Starknet ledger holds separate liabilities for Frontier withdrawals, unfinished Blitz games, fixed chest rewards and
Blitz season prizes. A game key is `{ shard: felt252, game_id: u32 }`; a withdrawal key is the shard chain ID and its
confirmed transaction hash. The ledger has no deployed state to migrate.

The added custody and replay maps replace a missing withdrawal payment path. Season pool, rating and claim storage
replace immediate game allocation and treasury transfers; chest contents and two credit counters replace repeated
opening draws and separate flag items. Frozen ratings cost one recorded value per participant per season because the
live MMR token must remain unchanged. Dormant prediction-market fields and the unused invite dependency are removed.

Frontier seasons are funded once. The pool unlocks linearly from `start` to `end`; operator payments are immediate and
retry-safe, and their cumulative total cannot exceed the unlock. The admin can return remaining funds to the treasury at
season close. Funding and accounting accept at most `u128::MAX` wei so their arithmetic stays within `u256`.

Blitz entries, purchased swords/shields and sponsorship join the season pool when a game is finalized. Each result row
contains one fixed chest: a cosmetic's packed attributes, one sword/shield credit, or LORDS. Chest LORDS are reserved at
mint and cannot exceed the preset share of entry fees; purchases and sponsorship do not enlarge that share. Unused chest
allocation joins the season pool. Requested flags spend available credits before charging LORDS, and cancelled games
restore consumed credits once.

New chests open through `GameLedger.open_chest` after approving the ledger to burn the NFT. Their contents follow the
NFT when it transfers. No opening call draws randomness. The existing collectibles implementation adds `mint_with_id`
without changing storage. New chest metadata must differ from the legacy random chest kinds `0x101` and `0x201`; the
test preset uses `0x301`. Legacy claims retain their existing behavior.

The operator posts a season top list against frozen ledger ratings. The paid fraction rounds up and allocations use the
preset geometric decay; integer rounding remainder goes to the last winner. Equal ratings use wallet order. Anyone may
challenge an omitted participant during the one-hour review. Short or challenged lists cannot pay; corrections restart
the hour. After review, winners pull once and the operator cannot restart a valid completed review. Admin MMR
corrections invalidate the list and cannot run after payout starts.

The admin manages presets, funding, roles and upgrades. `OPERATOR_ROLE` opens games, posts results and pays withdrawals.
`PAUSER_ROLE` can only pause. Only the admin unpauses. Pause blocks outgoing payouts, refunds and chest openings;
registration, funding, results and challenges remain available.

## Package checks

Run only these package checks for this ledger work; do not run the world suite:

```sh
cd contracts/l2/ledger
flock /tmp/eternum-scarb.lock bash -c 'scarb fmt --check && scarb build && snforge test'
cd ../collectibles
flock /tmp/eternum-scarb.lock bash -c 'scarb fmt --check && scarb build && snforge test'
```

## Sepolia rehearsal

The owner-run path is `scripts/commands/deployment/sepolia.js`. It was written for this change and has not been
executed. It refuses any provider whose chain ID is not `SN_SEPOLIA`, deploys a publicly mintable **Test LORDS** token,
a fresh MMR contract and two fresh collectible collections, then deploys the ledger. It grants the ledger the existing
MMR updater and collection minter roles, configures test metadata, registers a test preset, opens a Blitz season and
funds Frontier once. It writes only public addresses and transaction hashes under the ignored `target/` directory.

Build release artifacts first, under the same lock. These commands compile each package using its pinned toolchain:

```sh
(cd contracts/l2/ledger && flock /tmp/eternum-scarb.lock scarb build --release)
(cd contracts/l2/mmr && flock /tmp/eternum-scarb.lock scarb build --release)
(cd contracts/l2/collectibles && flock /tmp/eternum-scarb.lock scarb build --release)
```

The owner supplies `SEPOLIA_RPC_URL`, `SEPOLIA_ACCOUNT_ADDRESS`, `SEPOLIA_ACCOUNT_PRIVATE_KEY`,
`SEPOLIA_OPERATOR_ADDRESS`, `SEPOLIA_PAUSER_ADDRESS`, `SEPOLIA_SHARD_CHAIN_ID` (a non-zero felt),
`SEPOLIA_SEASON_START`, `SEPOLIA_SEASON_END` (Unix seconds), `SEPOLIA_FRONTIER_POOL_WEI`, `SEPOLIA_CHEST_CID`,
`SEPOLIA_SEASON_PASS_ADDRESS` and `SEPOLIA_VILLAGE_PASS_ADDRESS`. Pass addresses are required constructor dependencies;
the paid-entry rehearsal does not invoke them. Choose a start far enough ahead to complete declarations and setup.

Run only when the owner authorizes deployment:

```sh
pnpm --dir contracts/l2/ledger/scripts deploy:sepolia
```

Use the resulting `target/sepolia-deployment.json` to configure the relay and launcher. Match the shard's Frontier
season window and pool to the deployed ledger. Mint test LORDS to test wallets, approve the ledger, and register on L2;
feed that roster into the shard. Play a withdrawal and a Blitz match, then relay the actual confirmed withdrawal hash
and actual fixed result rows. Verify `get_payment`, wallet balances, `get_game.result_commitment`, minted chest IDs,
`get_chest` and the growing season pool. Opening a LORDS chest must leave season custody intact. Cosmetic demonstrations
must use configured cosmetic metadata; setup seeds `0x207050c01` as one test attribute. The test chest share and curve
numbers are presets for rehearsal, not approved production balance values.

## Mainnet prerequisites

No mainnet deployment or live upgrade is performed by this package check. Before value is enabled, the owner must
complete the design's contract audit and Sepolia withdrawal/result rehearsal, supply constructor addresses and deployer
credentials, grant the ledger `UPDATER_ROLE` on the existing MMR token, and grant collection mint roles. The live MMR
implementation remains unchanged. The chest collection needs an authorized, storage-compatible upgrade exposing
`mint_with_id`, plus metadata for the new fixed chest kind. Use the existing mainnet deployment path only after these
gates; its constructor is
`(admin, operator, treasury, lords, mmr_token, season_pass, village_pass, loot_chest, cosmetics)`.
