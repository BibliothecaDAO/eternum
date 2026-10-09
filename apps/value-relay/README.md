# Value relay

The relay and independent payout monitor are Cloudflare Workers, with one durable relay cursor per official chain. They
never run on a shard host. Services use Effect; contract operations sit behind typed ports in `src/ports.ts`.

The cursor stores the last confirmed block hash with durable withdrawal and result obligations in one transaction. Every
pass rechecks that block. A changed ancestor changes this hash; a mismatched next parent or a regressed confirmed head
also halts the relay. Pre-confirmed blocks are refused. A halted cursor requires investigation and has no automatic
reset. Withdrawals without an eligible wallet remain pending; retries keep the withdrawal transaction hash as claim id.
The ledger scopes that claim to the shard and enforces its unlock and pause rules.

The identity binding uses the `ValueIdentity` entrypoint. `payoutWallet(realmsId)` supplies the same 24-hour decision as
the account endpoint; `linkedWallet(realmsId)` is used for the live Realms ERC721 ownership check. Labor requests use an
internal port with a trusted account and day; no public labor route exists until the shard grant adapter and
authenticated request mapping are ready. The shard must enforce first write per Realm/day.

The monitor independently scans every paid claim and posted result on each pass, through paginated ports. It compares
receipt season and amount as well as identity, and compares result commitments. A mismatch persists a stop condition
before requesting the ledger pause, so a failed pause is retried. The pauser adapter checks the ledger's pause state
before submitting a transaction and never unpauses it.

The published Frontier `pay`, Blitz `apply_results`, ledger event enumeration and ERC721 `owner_of` adapters are
implemented. Result retries first check the stored game commitment; event cursors pin a confirmed L2 head. Shard
receipts, result decoding and labor grants are pending their published schemas. Those ports fail explicitly and both
health routes return 503 with `interfaces: pending`. This skeleton is not ready to move value.

Relay runtime values: `SHARD_CHAIN_ID`, `LEDGER_RPC_URL`, `LEDGER_ADDRESS`, `LEDGER_OPERATOR_ADDRESS`, `REALMS_ADDRESS`.
`LEDGER_OPERATOR_PRIVATE_KEY` is a Worker secret for the Starknet operator. The shard ledger-operator adapter will use
its own Worker secret when the grant interface arrives; no host-held signing key is reused. Monitor runtime values:
`LEDGER_RPC_URL`, `LEDGER_ADDRESS`, `PAUSER_ACCOUNT_ADDRESS`; its separate Worker secret is `PAUSER_PRIVATE_KEY`. Do not
place either credential in variables, source, logs, deployment artifacts or shard files.

`wrangler.jsonc` describes the relay and `monitor.wrangler.jsonc` the independent monitor. No deployment is part of this
change. The new persistence replaces an otherwise lossy block poll; no existing relay existed to remove.
