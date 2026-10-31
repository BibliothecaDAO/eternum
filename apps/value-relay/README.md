# Value relay

The relay and independent payout monitor run as Workers outside the shard hosts. Identity's private
`ValueIdentity.shards()` method is the only membership source. Active and draining shards can produce payouts and labor.
Herald's `/manifest` supplies each registered chain's current RPC and Games address. Retired rows remain available for
readonly historical audits.

Each official shard has its own durable confirmed cursor. A tick reads at most 100 blocks and one Games event page, then
journals withdrawal and result obligations with the cursor. An unfinished page retains its confirmed anchor. Changed
hashes, parents or regressed heads halt ingestion. One environment-wide durable ledger actor serializes reports,
payments, results, season settlement and chest finishes under the operator key. Another shard's failure does not
suppress these jobs.

Frontier receipts are reported as debt before wallet lookup. Normal chest claims pay immediately from the ledger's
shared allowance; exhaustion remains retryable as `ledger_payout_allowance_spent`. The relay reads capacity, available
allowance and slow-lane delay from a confirmed L2 head and budgets batches across seasons. Prizes and claims above
capacity first bind identity's linked wallet, wait the ledger's one-hour slow lane and require the separate monitor's
approval, plus confirmation and scheduling. Preparation records the signed recipient decision before broadcast; a
recipient change restarts that wait. Missing wallets remain queued and appear as deferred in health; unknown accounts
are retried from their confirmed receipts. Permanent refusals are recorded separately. A confirmed closed season with
the claim unpaid removes it from retries, including accounts without wallets. A claim is keyed by its shard and
withdrawal transaction hash.

`POST /api/value/labor?chainId=<official shard>` accepts only a Realm in its body. Identity supplies the signed-in
Realms id and account. The Worker reads the UTC day from the shard and `owner_of` from identity's configured L2 chain.
The shard owns labor eligibility and limits. No daily cap is copied into services.

The independent monitor checks `WithdrawalReported` events against raw L3 receipts before resolving any identity. An
unknown account cannot hide a forged amount or block checking the next report. A prepared recipient also needs a
matching signed identity decision. The monitor submits `approve_payment` for that exact verified report using its own
`PAUSER_ROLE` account. Normal claims can already be paid, bounded by the allowance; slow claims require both the hour
and approval. Changing the recipient clears approval. A monitor outage cannot release forged slow claims. Before signing
either approval, the monitor reads current terms and approval state at one confirmed L2 block. Already approved, paid,
closed, voided or superseded reports need no transaction. Page retries and lost acknowledgments therefore reuse
confirmed approvals; recipient changes, voids and replacement proposals still require fresh verification and approval.

The monitor verifies `SettlementReported` against confirmed post-end balances, full prize issuance and exact receipt
totals, then submits `approve_settlement`. Early closure requires this approval and the hour. Proven mismatches persist
a halt and retry the pause immediately. Read or approval failures make health unhealthy from the first failure and
withhold approval for that report. Each report stream retains its cursor and retries; ten continuous minutes with a
known report awaiting verification or approval persist a halt and retry the pause. A successful page clears that
stream’s timer. Later rows on the page still get checked for proven mismatches. Unreadable history without an observed
waiting report makes health unhealthy without starting a pause timer. Availability recovery rechecks the row without
waiving it. Paid claims, results and conservation retain independent cursors; unavailable historical checks make health
unhealthy. Later wallet changes cannot rewrite an earlier payment decision. The monitor never uses the relay's queue as
proof and never unpauses the ledger. Its serialized tick also serializes approval, challenge and pause transactions.

Chest discovery and the monitor retain a ledger block hash through pagination and between ticks. A replaced or regressed
checkpoint restarts enumeration from block zero; chest discovery discards orphaned pending requests and rebuilds them
from canonical events. Old cursors without a hash also replay once. Each tick still reads at most one 100-event page. A
head that changes during a read fails that tick without advancing its cursor. These checks recover event discovery; they
do not make `ACCEPTED_ON_L2` irreversible or reconcile relay payments already acknowledged before an L2 rewrite.

The ledger address and chain come from `contracts/common/addresses/dev.json` or `production.json` through the shared
environment reader. The ledger runtime settings are the secret `L2_RPC_URL`, `LEDGER_OPERATOR_ADDRESS` and the
`LEDGER_OPERATOR_PRIVATE_KEY` secret. Labor uses the fixed relay bot account enrolled through
`POST /api/value/operator/shard/enrol` and the `SHARD_LEDGER_OPERATOR_PRIVATE_KEY` secret. The operator route accepts
only `{chainId,heraldUrl}` for an official shard, returns `{chainId,ledgerOperatorAccount}`, and shares the shard
signing lock with labor grants. The monitor has its own `PAUSER_ACCOUNT_ADDRESS` and `PAUSER_PRIVATE_KEY`. All ledger
jobs verify the identity environment's L2 chain. No signing key belongs on a shard host.

Both Workers validate their required settings before serving HTTP or starting a scheduled tick. The deployment script
supplies generated account keys, account addresses and the shared operator token; the owner supplies one `L2_RPC_URL`.
Health is available on the existing app routes: `GET /api/value/health` and `GET /api/operator/monitor/health`. No
separate health hostname or secret is required. Monitor health includes `fee_balance`: the pauser account, canonical
STRK token, confirmed block number, exact `balance_wei`, `low_balance_threshold_wei` and `warning`. Below 0.1 STRK,
`warning` is `monitor_strk_low` and health is unhealthy; this is replenishment headroom, not a transaction-count
guarantee. A failed balance read exposes `fee_balance_error` and clears the previous balance. Balance warnings alone do
not pause payouts. Replenish the monitor before it cannot submit approvals or a pause.

## Restored shard recovery

`POST /api/value/operator/reset` requires the operator bearer token and `{chainId,row,reason}`. It walks down to a
retained hash still matching the restored chain and checks that anchor again. Reset requires a confirmed paused ledger
and refuses if any discarded queued, held or completed withdrawal was paid on L2, including payments whose response was
lost. Failure preserves the cursor and obligations. With no paid claims discarded, it drops queued rows above the fork
and replays from fork + 1; with no surviving anchor, replay starts at genesis.

Keep payouts paused during recovery. Replay the original signed transactions so their withdrawal hashes match, then
verify the restored balances and receipts against L2 before resetting and unpausing. If replay is impossible, recovery
needs an explicitly reviewed reconciliation that debits the restored realm LORDS and preserves the paid receipt
identity. The normal reset has no bypass for that repair. Withdrawing the restored balance again creates a new hash; the
ledger's claim idempotence cannot prevent that second payment.

`POST /api/operator/monitor/reset` requires `{row,reason}` and the operator token. It waives the fault's exact fact,
everything its check compared. Reports are rechecked so corrected evidence can earn approval; a waived mismatch grants
none. Paid/result cursors advance past the cleared row. A rewind with the same evidence stays cleared, and changed
evidence on the same claim or game is checked again. The answer's `waived` names that fact, or is `null` for a fault
that recorded none (a roster check, or one written before facts were recorded): that reset clears the halt and the check
runs again, halting once more, with its fact, if the evidence still disagrees. An availability reset retries its
checkpoint. No reset unpauses the ledger.

For a forged unpaid report, keep the ledger paused, rotate the compromised operator and use the cold admin's
`void_report(shard, claim_id)`. Paid reports are immutable. Voiding releases the claim and prize reservation; the relay
rechecks held `ledger_report_mismatch` receipts and requeues them only once the ledger report is absent. Clear the
monitor's exact recorded fault after the repair, verify the result, then unpause. A corrected report is checked again
and needs fresh approval. No new secret or public approval endpoint is involved.

## Season prizes and mystery chests

At season end the relay reads frozen seasonal MMR and posts the complete ordered top list in one transaction. The
monitor independently computes the same list and challenges that season if a better participant was omitted. Seasonal
read failures are reported in health without pausing Frontier payouts. Participant history is read in bounded event
pages; rankings are computed from the ledger at one confirmed head and are not persisted.

Blitz results carry ranks only. A result is posted for the slot that paid for its game, after the monitor re-verifies
that slot's roster. A dev-shard game the launch directory declares outside any slot (a test Blitz) took no entry, so its
result completes without a ledger write. Any other game without a verified slot (a missing paid cohort, an undeclared
game, or any game on a non-`DEV_` chain) stays unposted and retries. The ledger mints tradeable rank-band chests and
owns their draws. Each keeper tick reads one 100-event page, persists its continuation and rotates through 25 unfinished
requests. It calls `open_finish` once the later block is readable and recognizes an already-finished retry.

A Frontier pool is funded with `season_id = shard game id`; the relay verifies that binding against the game start and
seed. For sweep, deadline settlement and carry rules, follow the ledger's
[Frontier lifecycle](../../contracts/l2/ledger/README.md#frontier-settlement-and-carry).

Staging selects `contracts/common/addresses/dev.json`; production selects `production.json`. Both run on `SN_MAIN`, with
separate ledger and value-token addresses. Dev uses the no-value test token, never production LORDS.
