# Game ledger

The game ledger is the mainnet value-plane contract for LORDS registration fees, sponsored prize pools, payouts, and
MMR. Its constructor ABI is frozen in phase 3 B.1.

## Mainnet deployment

Do not run a deployment until the owner has supplied the mainnet RPC and deployer credentials in the root `.env` and all
constructor addresses in `contracts/common/addresses/mainnet.json` are non-zero. In particular, the live Elite Invite
address is not recorded yet, so the command currently fails closed before submitting a transaction.

The environment must define `STARKNET_RPC`, `STARKNET_ACCOUNT_ADDRESS`, `STARKNET_ACCOUNT_PRIVATE_KEY`,
`LEDGER_ADMIN_ADDRESS`, `LEDGER_OPERATOR_ADDRESS`, and `LEDGER_TREASURY_ADDRESS`.

```sh
pnpm ledger:deploy:mainnet
```

The command declares and deploys `GameLedger`, writes `ledger` to `contracts/common/addresses/mainnet.json`, and exports
the public value-plane addresses to the ignored `deploy/madara-lab/.env`. It does not upgrade live dependencies or grant
roles. The MMRToken, Season Pass, and Village Pass upgrades and their ledger role grants are one ordered B.2 operation.

## Sponsored first games

Register a dedicated zero-entry-fee ledger preset, then launch a game with a target sponsored pool. Funding is
idempotent: retries top the game up only to the requested pool.

```sh
bun config/deployer/clean/registrar/register-preset.ts \
  --preset-id <id> \
  --environment appchain.blitz \
  --balance-profile official-60 \
  --ledger <ledger-address> \
  --ledger-rpc-url <mainnet-rpc> \
  --sponsored

bun config/deployer/clean/cli/create.ts \
  --environment appchain.blitz \
  --game <game-name> \
  --start-time <unix-or-iso> \
  --version <id> \
  --ledger <ledger-address> \
  --ledger-rpc-url <mainnet-rpc> \
  --lords <lords-address> \
  --sponsored-pool-lords <whole-lords>
```

The funding account comes from `LEDGER_TREASURY_ADDRESS` and `LEDGER_TREASURY_PRIVATE_KEY`.
