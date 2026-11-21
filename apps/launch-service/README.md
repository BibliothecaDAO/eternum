# Launch service

The launch Worker serves `/api/factory/*` and `/api/slots/*` beside identity. Identity owns sessions and official shard
membership. `IDENTITY` supplies the directory; `VALUE_RELAY` supplies confirmed, chain-guarded ledger reads and economic
writes. A request can select `?chainId=<official shard>`; with one live shard the selection is unique. Multiple live
shards require a chain. No Worker shard URL or separate ledger URL/address is configured.

Every Worker write requires the operator token. No route opens a paid Blitz slot. The
schedule's `frontier-<start timestamp>` names are reserved. There is no general factory create-run route or wallet
authority; the dev shard's test Blitz route is the one exception. The timetable exposes `slotId`; completed game
directory rows carry that same field: null for every game outside a paid slot (Frontier, Eternum, and a dev shard's test
Blitz). The environment address book supplies the ledger and L2 chain. No directory row carries economic addresses or a
free/paid entry payload.

A paid Blitz slot the ledger already holds never freezes or launches; its only way out is the refund. Before
close the operator's refund cancels it, after its end it aborts it, and every registrant then reclaims the exact payment
from the ledger. D1 keeps schedule and job metadata, never a copy of a paid roster.

The registrar serializes its device's shard writes and creates open-entry games. The launch service records no game
results, and nothing posts one: the value monitor pauses payouts on any result the ledger records. Migration 0015
deletes every paid-slot game run that never launched, so none can run or be continued as an open-entry game.

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
