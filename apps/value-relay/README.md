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

Frontier receipts are reported as debt before wallet lookup. Every payment then requests an independent co-signature for
the exact receipt, recipient, amount and prize rank/count. The box service reads confirmed shard evidence, funding and
identity itself; the relay cannot supply source URLs or a digest to sign. Payments have no added timer or rate limit.
Batches retain the ledger's cumulative unlock and custody checks. A refused or unavailable signature leaves only that
claim queued; verified siblings can proceed. The relay journals its own signed recipient decisions before broadcast for
the monitor's historical audit. Missing wallets appear deferred; unknown accounts retry from receipts. A confirmed
closed season removes unpaid claims from retries. Claims are keyed by shard and withdrawal transaction hash.

`POST /api/value/labor?chainId=<official shard>` accepts only a Realm in its body. Identity supplies the signed-in
Realms id and account. The Worker reads the UTC day from the shard and `owner_of` from identity's configured L2 chain.
The shard owns labor eligibility and limits. No daily cap is copied into services.

The independent monitor checks `WithdrawalReported` against raw L3 receipts. An unknown account cannot hide a forged
amount or block later reports. It audits paid recipients against identity's signed decision journal, plus results and
conservation. It neither signs payouts nor submits approval transactions. The co-signer separately verifies settlement
against confirmed post-end state and exact L2 paid totals, requiring complete payment before the claim deadline and
allowing unpaid/no-wallet treasury returns after it.

Proven mismatches persist a halt and retry the pause immediately. Unavailable report evidence makes health unhealthy on
the first failure; the report cursor retries without advancing. After ten continuous minutes with a known report
waiting, the monitor persists a halt and retries its pause. A verified page clears the timer. Later rows still get
checked for proven mismatches. Unreadable history with no observed waiting report reports unhealthy health without
inventing a pause timer. Paid claims, results and conservation retain independent cursors. The monitor never uses the
relay queue as proof and never unpauses the ledger; its signer serializes challenges and pauses.

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
jobs verify the identity environment's L2 chain. `COSIGNER_URL` and `COSIGNER_TOKEN` reach the separate box service; its
private key never enters Worker settings. Deploy it using the
[box procedure](../../deploy/athanor/README.md#independent-payout-co-signer).

Both Workers validate their required settings before serving HTTP or starting a scheduled tick. The deployment script
supplies generated account keys, account addresses and the shared operator token; the owner supplies one `L2_RPC_URL`.
Health is available on the existing app routes: `GET /api/value/health` and `GET /api/operator/monitor/health`. No
separate health hostname or secret is required. Monitor health includes `fee_balance`: the pauser account, canonical
STRK token, confirmed block number, exact `balance_wei`, `low_balance_threshold_wei` and `warning`. Below 0.1 STRK,
`warning` is `monitor_strk_low` and health is unhealthy; this is replenishment headroom, not a transaction-count
guarantee. A failed balance read exposes `fee_balance_error` and clears the previous balance. Balance warnings alone do
not pause payouts. Replenish the monitor before it cannot submit a pause.

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
everything its check compared. Reports are rechecked after repair; a waived mismatch never authorizes a payment.
Paid/result cursors advance past the cleared row. A rewind with the same evidence stays cleared, and changed evidence on
the same claim or game is checked again. The answer's `waived` names that fact, or is `null` for a fault that recorded
none (a roster check, or one written before facts were recorded): that reset clears the halt and the check runs again,
halting once more, with its fact, if the evidence still disagrees. An availability reset retries its checkpoint. No
reset unpauses the ledger.

For a forged unpaid report, keep the ledger paused, rotate the compromised operator and use the cold admin's
`void_report(shard, claim_id)`. Paid reports are immutable. Voiding releases the claim and prize reservation; the relay
rechecks held `ledger_report_mismatch` receipts and requeues them only once the ledger report is absent. Clear the
monitor's exact recorded fault after the repair, verify the result, then unpause. A corrected report is checked again
and needs an independently verified co-signature before payment.

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
seed. For sweep, deadline settlement and treasury-return rules, follow the ledger's
[Frontier lifecycle](../../contracts/l2/ledger/README.md#frontier-settlement-and-treasury-returns).

Staging selects `contracts/common/addresses/dev.json`; production selects `production.json`. Both run on `SN_MAIN`, with
separate ledger and value-token addresses. Dev uses the no-value test token, never production LORDS.

The box co-signer reads shard RPC and Herald through numeric loopback, never their Cloudflare tunnel hostnames. Its
persistent recipient record holds a changed wallet for 24 hours, while unchanged wallets remain immediate. Known
gameplay accounts cannot be reassigned to another Realms ID to bypass that record. First-seen identity bindings and
sustained identity compromise remain outside this protection; see the box deployment procedure for backup and relink
rehearsal. The relay uses Worker-supported manual redirect handling and refuses every non-success co-signer response.

## When the ledger is read

Payments and shard reads run every minute. The ledger side (season posts, chests, the monitor's audit) is read in two
cases only: the hour (`isLedgerReadTick`, `packages/chain/src/ledger-reads.ts`), and the minute after the relay wrote to
the ledger (a paid or reported claim, a posted result or season top, a settlement, a deposit or principal). A relay
write calls `ledgerWritten` on the relay's ledger actor and on the monitor (`RosterMonitor`); each keeps a flag the next
minute's tick consumes, so a burst of writes is one read. A lost notice costs at most the hour. A fact that can never
change again (a closed season, a paid principal, a published or matched pool) is read once and kept (`final-facts.ts`);
`read-budget.test.ts` fails if a later tick reads it again.

Deposits follow the same rule. The ledger emits no event for a deposit, so the relay finds one by reading
`deposit_count`; it does that on the hour, while a deposit is pending or failed, and when the player's page reports that
its payment landed (`POST /api/value/deposits/deliver?chainId=`, same-origin and signed in, one pass per ten seconds per
shard). A deposit nobody reported waits for the hour.

A cause is kept until the work it asked for is finished: an audit or ledger tick that failed, or left events, pages or
chests still to read, asks again after five minutes (`LEDGER_RETRY_SECONDS`), not on the next hour. A halted monitor is
not retried: it waits for its operator. After an admin voids a forged report, the operator's `monitor/reset` (or the
relay's `operator/reset`) asks the relay to ask the ledger about its held claims at the next tick; the hourly pass is
the safety net. A stored deposit anchor whose block Ethereum never accepted is dropped when the chain replaced it, and
the next payment is decided from the canonical chain; one whose block Ethereum accepted stays a fault.

Nothing a page can poll reads the chain. The deposit history route answers from the deposits the relay already read
(`deposit-row:` keys, written when a pass discovers a deposit and when it delivers or cancels it; deposits found before
history was kept are read once). A report that a payment landed (`POST /api/value/deposits/deliver`) is stored as a
cause before anything is tried, shared with reports made at the same time, kept if the pass fails, and retried by the
next minute's tick. The identity service keeps each rating board and wallet answer for an hour and drops them when the
relay says it posted results (`ratingsChanged`). `rpc-budget.test.ts` counts every call the ledger URL receives beneath
the real readers and derives the month from those counts.

## What the relay owes, and when it stops owing it

Everything the relay owes the chain or a player (a deposit to deliver or refund, a principal to return, a withdrawal to
pay, a reported cause to act on) is one shape (`obligations.ts`): an obligation, an idempotent attempt, and evidence. It
is durable from the moment it is known until the accepted chain proves its outcome. It is never removed because a call
returned, a receipt was accepted on L2, or a pass ended: the only removal is `settle`, which takes the evidence (the
block Ethereum accepted and its hash). An obligation is to do (attempted every minute), awaiting proof (attempted again
only in a proof pass: the hour, or an operator's request), or settled. A replaced block shows the work gone at the head,
and the next attempt does it again, because the obligation was never removed. A cause (`ledger-cause.ts`) follows the
same rule: beginning work does not remove it, only completing and publishing does, and only if no newer report arrived.
`obligations-matrix.test.ts` kills the worker after every durable write of every pass, for every kind of obligation and
every chain event (blocks replaced, a deposit vanishing, the accepted block unreadable, replies lost, the node failing),
and replaces the unaccepted blocks at every stage; it asserts one canonical payment or refund each, settlement, and a
history that says what the chain says.

A deposit is identified by its commitment, not its id: the ledger can give a vanished deposit's id to a different one. A
deposit the shard credited that the ledger no longer has (vanished, or replaced under its id) leaves the work queue and
is kept as a fault under its commitment, with the row it had, apart from the history row its id is given to next. It is
reported on every pass and stops nothing: the deposit that takes the id is its own obligation, resolved if it conflicts
with nothing on the shard and failing loudly (`deposit_resolution_unconfirmed`) for itself alone if it does.
`POST /api/value/operator/deposit-fault` (operator token, `{chainId, commitment, reason}`) clears that one fault, once
the shard's credit has been dealt with, and keeps the cleared record.
