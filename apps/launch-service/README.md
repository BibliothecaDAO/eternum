# Launch service

The launch Worker serves `/api/factory/*` and `/api/slots/*` beside identity. Identity owns sessions and official shard
membership. `VALUE_IDENTITY` supplies the directory; `VALUE_RELAY` supplies confirmed, chain-guarded ledger reads and
economic writes. A request can select `?chainId=<official shard>`; with one live shard the selection is unique. Multiple
live shards require a chain. No Worker shard URL or separate ledger URL/address is configured.

Launch mutations require an allowlisted linked wallet or the operator token. Public reads expose declared entry terms
from the launch record. Frontier entries are free. Paid game entries are
`{kind:"paid",ledger:{address,chainId,shard,gameId}}`. They carry no token. LORDS comes from `lords()` and the network
fee token from the client's chain table. A missing opening record is unavailable and cannot become free.

The old HTTP free registration path and its D1 player table are deleted. D1 slot rows contain scheduling metadata,
scoped by chain. Player registration belongs on the ledger. The owner's uncapped-slot revision still needs its published
slot opening, registration paging, refund and per-game allocation ABI; the preceding per-game reader must be replaced
with that revision before enabling the new slot flow. Historical wallet resolution uses identity history at registration
time, without the payout hold. Balanced groups retain registration order and have at most 24 players.

The registrar serializes its device's shard writes. It reads the runtime class ABI, creates games through the native
registry and adopts an already-seated shard roster on retry. Paid runs retry transient failures with backoff until the
ledger's stored end; unavailable deadline reads never trigger an early refund. Result jobs keep retrying and never
cancel a played game. Final points and ranks come from the shard's unit `RecordBlitzResults` command. The relay alone
posts the committed ranks and finishes mystery chest requests.

Normal game names cannot start with `check-`. Operator-only `/api/factory/operator/launcher/enrol` and `/check` prove
the Worker's own enrollment and a fixed check-game creation. The deployment registers the shard as pending in identity
first, enrolls the Worker, hands it the launcher role and confirms the check before activation. Pending shards stay
invisible to players.

Runtime settings include `BASE_URL`, `ENVIRONMENT`, `LAUNCHER_ALLOWLIST`, `DEPLOYER_ACCOUNT_ADDRESS`, and the
`DEPLOYER_PRIVATE_KEY` and `OPERATOR_TOKEN` secrets. `wrangler.jsonc` declares the identity, relay, D1 and registrar
bindings. No hosting, secret provisioning or live deployment is performed by this change.
