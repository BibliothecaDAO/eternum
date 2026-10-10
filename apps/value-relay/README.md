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

Frontier receipts are reported as debt before wallet lookup. Payments use identity's ready payout wallet at signing time
and record that decision before broadcast. A new wallet waits 24 hours. Missing or held wallets remain queued; permanent
refusals are recorded separately. A confirmed closed season with the claim unpaid removes it from retries, including
accounts without wallets. A claim is keyed by its shard and withdrawal transaction hash.

`POST /api/value/labor?chainId=<official shard>` accepts only a Realm in its body. Identity supplies the signed-in
Realms id and account. The Worker reads the UTC day from the shard and `owner_of` from identity's configured L2 chain.
The shard owns labor eligibility and limits. No daily cap is copied into services.

The independent monitor reads confirmed ledger events through checked-through cursors, verifies receipts, recorded
payment authority, result commitments and shard conservation, and pauses on disagreement or repeated unavailable
verification. Later wallet changes cannot rewrite an earlier payment decision. It never uses the relay's queue as proof
and never unpauses the ledger.

The ledger address and chain come from `contracts/common/addresses/<network>.json` through the shared environment
reader. The ledger runtime settings are the secret `LEDGER_RPC_URL`, `LEDGER_OPERATOR_ADDRESS` and the
`LEDGER_OPERATOR_PRIVATE_KEY` secret. Labor uses the fixed relay bot account enrolled through
`POST /api/value/operator/shard/enrol` and the `SHARD_LEDGER_OPERATOR_PRIVATE_KEY` secret. The operator route accepts
only `{chainId,heraldUrl}` for an official shard, returns `{chainId,ledgerOperatorAccount}`, and shares the shard
signing lock with labor grants. The monitor has its own `PAUSER_ACCOUNT_ADDRESS` and `PAUSER_PRIVATE_KEY`. All ledger
jobs verify the identity environment's L2 chain. No signing key belongs on a shard host.

## Restored shard recovery

`POST /api/value/operator/reset` requires the operator bearer token and `{chainId,row,reason}`. It walks down to a
retained hash still matching the restored chain, checks that anchor again, drops queued rows above the fork, records
already-paid claims from discarded blocks, and replays from fork + 1. If no anchor survives, replay starts at genesis. A
changed anchor refuses reset. The ledger's claim identity prevents a second payment.

`POST /api/operator/monitor/reset` requires `{row,reason}` and the operator token. It records the exact fault and
advances past only that row. An availability reset retries its checkpoint. Neither reset unpauses the ledger.

## Season prizes and mystery chests

At season end the relay reads frozen seasonal MMR and posts the complete ordered top list in one transaction. The
monitor independently computes the same list and challenges that season if a better participant was omitted. Seasonal
read failures are reported in health without pausing Frontier payouts. Participant history is read in bounded event
pages; rankings are computed from the ledger at one confirmed head and are not persisted.

Blitz results carry ranks only. The ledger mints tradeable rank-band chests and owns their draws. Each keeper tick reads
one 100-event page, persists its continuation and rotates through 25 unfinished requests. It calls `open_finish` once
the later block is readable and recognizes an already-finished retry. The monitor reports requests overdue by five
minutes after eligibility. Pending/overdue counts describe the checked page, with `checked` identifying its size; these
warnings do not pause payouts.

A Frontier pool is funded with `season_id = shard game id`; the relay verifies that binding against the game start and
seed.
