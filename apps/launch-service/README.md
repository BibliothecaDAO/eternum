# Launch service

The launch Worker serves `/api/factory/*` and `/api/slots/*` beside identity. Identity owns sessions and official shard
membership. `IDENTITY` supplies the directory; `VALUE_RELAY` supplies confirmed, chain-guarded ledger reads and economic
writes. A request can select `?chainId=<official shard>`; with one live shard the selection is unique. Multiple live
shards require a chain. No Worker shard URL or separate ledger URL/address is configured.

Every Worker write requires the operator token. The operator opens Blitz slots; players register on the ledger. The
schedule's `frontier-<start timestamp>` names are reserved. There is no general factory create-run route or wallet
authority; the dev shard's test Blitz route is the one exception. The timetable exposes `slotId`; completed game
directory rows carry that same field: null for every game outside a paid slot (Frontier, Eternum, and a dev shard's test
Blitz). The environment address book supplies the ledger and L2 chain. No directory row carries economic addresses or a
free/paid entry payload.

Blitz registration belongs to an uncapped ledger slot. It closes five minutes before the common game start; official
games start every 90 minutes on the UTC grid: 00:00, 01:30, 03:00, through 22:30, every day. The minute cron publishes
the next slot still open for registration. Preparation, the preset's full game duration and strictly more than ten
minutes for result settlement must fit inside the calendar window; the relay checks the same bounds against the
confirmed ledger season before signing. A calendar extension cannot extend that ledger season. Published slots keep
their original times when the timetable changes. At close, the relay reads confirmed registrations in pages of 100.
Identity history resolves each payer at its registration block time. The earliest registration for each account gets a
seat; unlinked and duplicate payers become refundable. Balanced groups retain registration order and contain at most 24
players. An empty slot creates no game. D1 keeps schedule and job metadata, never a copy of a paid roster: a paid game's
players are re-read from the ledger. The one roster D1 holds is a test Blitz's, named by the operator in its run
request, because that request is its only source. Paid operator one-offs use the same `/api/slots` route; the general
factory create-run route is removed.

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

A dev shard also runs test Blitz games, so Blitz can be played and tested with no mainnet transaction and no funds. The
operator posts `POST /api/factory/test-blitz {"name": "test-<label>", "players": ["0x<account>", ...]}` (1 to 24
distinct gameplay accounts), or runs `OPERATOR_TOKEN=<token> pnpm test-blitz test-<label> 0x<account> ...`, which waits
for the game and prints its id and address. A player's account is the one a signed-in client sends as `?player=` on its
`/api/directory` request.

The name is the request's identity. The first request queues the run; the same name and roster again (after a lost
response or an interrupted wait) returns that run; the same name with another roster, or a name a slot's game already
holds, is refused with 409. The run is an ordinary Blitz game run with no slot: the same preset, creation, seating,
start one preparation window after the first request, and ranked results. Each seat's wallet is its own account, because
nothing is paid. It takes no entry, its result is not posted, and it moves no rating.

Only a dev shard runs one, and the check reads the shard chain itself, not the Worker's configuration. The shard deploy
names every chain at genesis `<ENVIRONMENT>_<time>` (`DEV_…`, `PRODUCTION_…`), every shard write is signed for that
chain, and the launcher checks the RPC's chain before each write. The route answers 404 unless the Worker's selected
shard is a `DEV_` chain, and the executor refuses a slotless Blitz run on any other chain before creating it, so
production bindings stay refused even under a misleading `ENVIRONMENT`.

To recover a named paid slot, POST `/api/slots/:name/refund?chainId=0x...` with the operator Bearer token. This enables
ledger refunds by cancelling before close or aborting after end; players then claim their own refund. Between close and
end it returns 409 with `retryAfterSeconds`; retry after that delay. A 200 with `refundsEnabled: true` confirms refunds
are enabled (repeating is safe). A linked wallet alone cannot use this recovery route.
