# Launch service

The launch Worker serves `/api/factory/*` and `/api/slots/*` beside identity. Identity owns sessions and official shard
membership. `IDENTITY` supplies the directory; `VALUE_RELAY` supplies confirmed, chain-guarded ledger reads and economic
writes. A request can select `?chainId=<official shard>`; with one live shard the selection is unique. Multiple live
shards require a chain. No Worker shard URL or separate ledger URL/address is configured.

Every Worker write requires the operator token. The operator opens Blitz slots; players register on the ledger. The
schedule's `frontier-<start timestamp>` names are reserved. There is no factory create-run route or wallet authority.
The timetable exposes `slotId`; completed game directory rows carry that same field (null outside Blitz). The
environment address book supplies the ledger and L2 chain. No directory row carries economic addresses or a free/paid
entry payload.

Blitz registration belongs to an uncapped ledger slot. It closes five minutes before the common game start; official
games keep their 11:00 and 20:00 UTC starts. At close, the relay reads confirmed registrations in pages of 100. Identity
history resolves each payer at its registration block time. The earliest registration for each account gets a seat;
unlinked and duplicate payers become refundable. Balanced groups retain registration order and contain at most 24
players. An empty slot creates no game. D1 keeps schedule and job metadata, never a roster copy. Operator one-offs use
the same paid `/api/slots` route; the factory create-run route is removed.

The registrar serializes its device's shard writes. Each game is created with its complete roster, then the existing
automatic realm seating completes. A retry re-resolves the historical cohort and verifies an existing game's roster
before resuming. Paid launches retry transient failures with backoff until success or slot cancellation. Result jobs
keep retrying and never cancel a played game. The shard's unit `RecordBlitzResults` command computes final ranks. The
independent monitor re-resolves the complete slot cohort and checks every frozen pair before the relay posts a game's
results; mismatches pause payouts, unavailable evidence cannot pass. Each result allocates only its own registrations.

Normal game names cannot start with `check-`. Operator-only `/api/factory/operator/launcher/enrol` enrolls the Worker's
own signer. Deployment registers the shard as pending, enrolls the Worker, hands it the launcher role, and reads that
role back on chain before activation. Pending shards stay invisible to players.

Runtime settings include `BASE_URL`, `ENVIRONMENT`, and the `LAUNCH_DEPLOYER_PRIVATE_KEY` and `OPERATOR_TOKEN` secrets.
`wrangler.jsonc` declares the identity, relay, D1 and registrar bindings. No hosting, secret provisioning or live
deployment is performed by this change.

To recover a named paid slot, POST `/api/slots/:name/refund?chainId=0x...` with the operator Bearer token. This enables
ledger refunds by cancelling before close or aborting after end; players then claim their own refund. Between close and
end it returns 409 with `retryAfterSeconds`; retry after that delay. A 200 with `refundsEnabled: true` confirms refunds
are enabled (repeating is safe). A linked wallet alone cannot use this recovery route.
