# Game ledger

The game ledger is the Sepolia value-plane contract for registration fees, prize payouts, and MMR. Its constructor ABI
is frozen in phase 3 B.1.

## Sepolia deployment

Deploy fresh B.1 prerequisites first. Each command builds the current Cairo package and updates
`contracts/common/addresses/sepolia.json`:

```sh
pnpm seasonpass:deploy:sepolia
pnpm villagepass:deploy:sepolia
pnpm mmr:deploy:sepolia
pnpm collectibles:loot-chests:deploy:sepolia
pnpm collectibles:elite-invite:deploy:sepolia
pnpm collectibles:cosmetics:deploy:sepolia
```

The Sepolia environment must define `STARKNET_ACCOUNT_ADDRESS`, `STARKNET_ACCOUNT_PRIVATE_KEY`, `LEDGER_ADMIN_ADDRESS`,
`LEDGER_OPERATOR_ADDRESS`, and `LEDGER_TREASURY_ADDRESS`. The deployment account must be the fresh MMR and Village Pass
admin so the final role-grant multicall can succeed.

The registrar commands additionally require `LEDGER_ADMIN_PRIVATE_KEY` for preset registration and
`LEDGER_OPERATOR_PRIVATE_KEY` for opening games. Their addresses must match the constructor roles.

Then deploy the ledger:

```sh
pnpm ledger:deploy:sepolia
```

The command validates every constructor address before submitting a transaction, deploys the frozen ABI, grants the
ledger `UPDATER_ROLE` on MMR and `DISTRIBUTOR_ROLE` on Village Pass, writes `ledger` to the common Sepolia address
table, and exports the public value-plane addresses to the ignored `deploy/madara-lab/.env` file.

Preset registration remains one cross-chain command:

```sh
bun config/deployer/clean/registrar/register-preset.ts --preset-id <id> --environment appchain.blitz \
  --balance-profile official-60 --ledger <ledger-address> --ledger-rpc-url <sepolia-rpc>
```
