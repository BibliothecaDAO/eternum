# Stage-1 game operator

The operator attests between the mainnet value plane and the S2 game while validity settlement is postponed. It runs two
independent loops:

- mainnet `GameLedger.Registered` → S2 `entry_systems.register_from_l2`
- S2 `LedgerResultRowReady` + `LedgerResultsReady` → mainnet `GameLedger.apply_results`

Both loops checkpoint the next block in the same Postgres `operator_cursors` table. Registration writes are idempotent,
and the result loop reads the ledger's finalized flag before writing, so a crash after submission but before the cursor
commit does not duplicate state.

The two operator keys are trusted during stage 1. They relay registrations and final results; proofs replace that trust
in stage 3. Keep the mainnet operator separate from the ledger admin and treasury, and provision the S2 operator at its
own address on the game chain.

Required environment:

```text
DATABASE_URL
LEDGER_ADDRESS
LEDGER_RPC_URL
LEDGER_START_BLOCK
LEDGER_OPERATOR_ADDRESS
LEDGER_OPERATOR_PRIVATE_KEY
S2_CHAIN=madara|appchain
S2_MANIFEST_PATH
S2_OPERATOR_ADDRESS
S2_OPERATOR_PRIVATE_KEY
S2_RPC_URL
S2_START_BLOCK
```

The mainnet and S2 writers use separate accounts because deployment on one chain says nothing about the same address on
the other. `LEDGER_RPC_URL` is refused unless its chain id is Starknet mainnet, and `S2_RPC_URL` must match `S2_CHAIN`.
Set both start blocks to the deployment block of their source contract; they are intentionally required so a first boot
cannot silently skip events or scan from genesis.
