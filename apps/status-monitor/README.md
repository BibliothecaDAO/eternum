# Public status observations

This is a separate, one-minute Worker. It probes public HTTPS, never a service binding or a box. The page lives in its
own Pages project. Its `/status.json` function reads the monitor's R2 object directly; neither the app nor the monitor
must be running to serve the latest observation. A missing, invalid, over-five-minute-old or more-than-one-minute future
observation returns 503 with no-store. The page must also age a retained document locally between refreshes.

`state.json` contains the public version 1 document, private daily counters and the last known shard targets. One
conditional R2 write commits them together. Delayed/overlapping runs cannot overwrite a newer document or count one
minute twice. A failed publication is loud; there is no retry journal. Missing samples yield null daily uptime and reset
status continuity. Degraded samples count unavailable. History has 90 UTC days; automatic incidents retain every open
incident,100 recent resolved incidents and ten updates each. They describe observations, never human investigation.

Play checks HTML and the same-origin main module. Accounts checks identity D1 readiness, not email/Discord delivery or a
real sign-in. The guardian row reads identity’s existing `/api/guardian` response and checks its public key and account
class. Chat checks the existing global ChatRoom's SQLite. Directory and slots validate their public responses. Worlds
check manifest identity, Herald health and node headers matching both confirmed heads, and the stamping RPC listener (a
deliberately unknown RPC method must be rejected, never enqueued). This listener check does not claim end-to-end action
sequencing. A directory outage retains known world targets. Public hostnames name worlds because the directory has no
separate display-name fact.

Whole-path latency over 1000ms is degraded. Bad HTTP/schema or a five-second probe deadline is down. Confirmed head age
over 30s or Herald lag over two blocks is degraded; over 120s or ten blocks is down. Future clocks over 30s, Herald
ahead of the node or incomplete decoding are down. These samples are not gameplay p95 measurements. The monitor costs
one cron and one conditional R2 publication a minute, plus the public reads; the page costs an R2 read per refresh. A
Cloudflare-wide outage takes both down; independent-provider uptime is not claimed.

Before deployment, the owner creates:

- Pages project `realms-status`, root `apps/status`, assets `public`, with the frontend's standalone `index.html`.
- Custom domain and DNS `status.realms.world` on that Pages project.
- R2 bucket `realms-status`; bind it as `STATUS_BUCKET` to Pages and the monitor.
- Worker `realms-status-monitor` with the committed one-minute cron. The Worker has no public route or service binding.
- A protected, scoped Cloudflare deployment token/account id for the chosen separate deployment. No player, signer,
  database or watched-service secret is needed.

Nothing is deployed by adding this package. Deploy this Worker separately after those resources exist; it is not added
to the game client's or identity Worker's automatic release. Local checks: `pnpm --dir apps/status-monitor test` and
`pnpm --dir apps/status-monitor typecheck`. Repository service validation runs both. Tests use mocked public HTTP and
local R2; they do not probe live hosts.

`BASE_URL` and `ENVIRONMENT` are committed per environment; `L2_RPC_URL` is the one Alchemy URL supplied by the owner
and distributed by the deployment script. The environment selects the shared address book. The three health addresses
come from `BASE_URL`: `/api/guardian`, `/api/value/health` and `/api/operator/monitor/health`. No additional hostname or
health secret is required. Relay and value-monitor health must report the correct service and a completed check within
five minutes. Guardian signing stays private to service bindings.

The ledger probe reads the confirmed node head and `is_paused` at that same block, independently of the relay parser.
Its `paused` fact is true, false or null on failed decoding. A paused ledger is degraded; a failed or stale L2 head is
down. The monitor imports no guardian, relay or ledger service code and has no watched-service binding or signing key.

Use `wrangler deploy --env staging` for dev, with the isolated `realms-status-staging` bucket. Its play probes use
`play.dev-realms.party`. An undeployed ledger is published as down with an unknown pause flag; it does not suppress the
other probes. The independent R2/Pages resources and standalone frontend page must also be deployed.

Staging selects `contracts/common/addresses/dev.json`; production selects `mainnet.json`. Both run on `SN_MAIN`, with
separate ledger and value-token addresses. Dev uses the no-value test token, never production LORDS.
