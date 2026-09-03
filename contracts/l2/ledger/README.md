# Game ledger

The game ledger is the mainnet value-plane contract for LORDS registration fees, sponsored prize pools, payouts, and
MMR. Its constructor ABI is frozen in phase 3 B.1.

## Mainnet deployment

Do not run a deployment until the owner has supplied the mainnet RPC and deployer credentials in the root `.env` and all
constructor addresses in `contracts/common/addresses/mainnet.json` are non-zero. In particular, the live Elite Invite
address is not recorded yet, so the command currently fails closed before submitting a transaction.

The environment must define `LEDGER_RPC_URL`, `STARKNET_ACCOUNT_ADDRESS`, `STARKNET_ACCOUNT_PRIVATE_KEY`,
`LEDGER_ADMIN_ADDRESS`, `LEDGER_OPERATOR_ADDRESS`, and `LEDGER_TREASURY_ADDRESS`.

```sh
pnpm ledger:deploy:mainnet
```

The command declares and deploys `GameLedger`, writes `ledger` to `contracts/common/addresses/mainnet.json`, and exports
the public value-plane addresses to the ignored `deploy/madara-lab/.env`. It does not upgrade live dependencies or grant
roles. The MMRToken, Season Pass, and Village Pass upgrades and their ledger role grants are one ordered B.2 operation.

The shared deployment runtime loads public network defaults from `contracts/common/.env.mainnet`, then overlays secrets
from the root `.env`. Before upgrading live assets, configure the authorized accounts there:

```text
MMR_ADMIN_ADDRESS
MMR_ADMIN_PRIVATE_KEY
MMR_UPGRADER_ADDRESS
MMR_UPGRADER_PRIVATE_KEY
SEASON_PASS_OWNER_ADDRESS
SEASON_PASS_OWNER_PRIVATE_KEY
STARKNET_ACCOUNT_ADDRESS
STARKNET_ACCOUNT_PRIVATE_KEY
LEDGER_RPC_URL
VILLAGE_PASS_ADMIN_ADDRESS
VILLAGE_PASS_ADMIN_PRIVATE_KEY
VILLAGE_PASS_UPGRADER_ADDRESS
VILLAGE_PASS_UPGRADER_PRIVATE_KEY
```

The check builds all three contracts, refuses a non-mainnet RPC, verifies every live address and onchain authority, and
does not submit a transaction. The execute command declares the three classes, upgrades MMRToken then Season Pass then
Village Pass, grants the ledger `UPDATER_ROLE` and `DISTRIBUTOR_ROLE`, and verifies class hashes and grants afterwards.
It is rerunnable after a partial failure.

Before the first `--execute` against live assets, run the same upgrade plan on a mainnet fork. For both pass contracts,
read a known token owner before the upgrade, verify the same owner afterwards, approve the ledger, and complete a burn
round-trip. Class-hash and role checks do not prove storage-layout compatibility; the fork rehearsal is a required
live-gate artifact.

```sh
pnpm ledger:check-live-assets:mainnet
pnpm ledger:upgrade-live-assets:mainnet
```

## Sponsored first games

Register a dedicated zero-entry-fee ledger preset, then launch a game with a target sponsored pool. Funding is
idempotent: retries top the game up only to the requested pool.

```sh
bun config/deployer/clean/registrar/register-preset.ts \
  --preset-id <id> \
  --environment madara.blitz \
  --balance-profile official-60 \
  --ledger <ledger-address> \
  --ledger-rpc-url <mainnet-rpc> \
  --sponsored

bun config/deployer/clean/cli/create.ts \
  --environment madara.blitz \
  --game <game-name> \
  --start-time <unix-or-iso> \
  --version <id> \
  --ledger <ledger-address> \
  --ledger-rpc-url <mainnet-rpc> \
  --lords <lords-address> \
  --sponsored-pool-lords <whole-lords>
```

The funding account comes from `LEDGER_TREASURY_ADDRESS` and `LEDGER_TREASURY_PRIVATE_KEY`.
