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

Play checks HTML and the same-origin main module. Accounts checks identity D1 readiness and the guardian public-key
read, not email/Discord delivery or a real sign-in. Chat checks the existing global ChatRoom's SQLite. Directory and
slots validate their public responses. Worlds check manifest identity, Herald health and node headers matching both
confirmed heads, and the admission HTTP listener (a deliberately unknown RPC method must be rejected, never enqueued).
This listener check does not claim end-to-end action sequencing. A directory outage retains known world targets. Public
hostnames name worlds because the directory has no separate display-name fact.

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
