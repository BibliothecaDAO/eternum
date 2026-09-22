# Automatic game notifications

Automatic delivery runs inside the identity server and uses its existing Web Push transport. It consumes confirmed
StoryEvent history from one configured persistent world, resolves the event-time gameplay recipients through
PlayerRegistry, and delivers according to the account's latest saved preference. No live entity rows are copied into
notification storage. The shared notification builder owns source/logical identity and display content for the page and
server paths.

## Enablement and rollout

Apply `pnpm --dir packages/db push` against the identity database before deploying this server version. This adds the
subscription source/opt-in timestamp, checkpoint and delivery tables through their single Drizzle declarations. Deploy
Herald's cursor endpoint before enabling automatic delivery. Existing Herald progress markers remain trusted; this
change does not force a genesis backfill or alter leaderboard/review readiness.

Keep the VAPID configuration described in [Web Push setup](../web-push.md), and add:

- `WEB_PUSH_AUTOMATIC_ENABLED=true` (defaults off; requires `WEB_PUSH_ENABLED=true`)
- `NOTIFICATION_HERALD_URL=https://herald.realms.party`
- `NATIVE_WORLD_MANIFEST=<path to the shard deployment document>`

The source response must match the manifest chain/world. The worker checks the gameplay RPC chain against the manifest
identity before each pass. PlayerRegistry reads use the identity server's `GAME_RPC_URL` and `PLAYER_REGISTRY_ADDRESS`;
do not point them at a different gameplay deployment. Owner reads explicitly use the latest confirmed block, and RPC
calls have a ten-second timeout.

Existing test subscriptions are not upgraded automatically. Players explicitly choose **Enable game alerts** on an
existing device, or **Enable background notifications** on a new device. Setup checks worker compatibility and activates
the local automatic capability before enabling server fan-out. The device records this as pending and keeps local alerts
available until server acknowledgement. Reopening resumes either interrupted branch; a valid matching game push also
acknowledges activation atomically with its claim, even with the page closed. Both the device and server enforce the
opt-in and its chain/world scope. Records older than the subscription's automatic opt-in timestamp are excluded. Manual
transport tests remain independent of the account level.

## Confirmed source and recovery

`GET /<chain>/history/story-events?limit=100&after=<block>:<transaction>:<event>` returns ascending receipt positions,
source scope, a fixed complete head, and `next_cursor`. An omitted cursor returns the current complete head without
historical events; the notifier uses that only to initialize a source with no checkpoint. This avoids an initial alert
flood. Restarts resume the saved cursor instead.

Pages never read beyond the durable history marker. The cursor remains unavailable until startup history backfill has
finished and while the current Herald process reports decode failures. Other existing history consumers keep their
behavior. The new cursor and its notifier consumer ship together. The position index supports the world-wide scan; there
are no per-game sockets or detach races. Final events from ended/settled games are drained with the same scan. The
directory supplies immutable game names for normal entry URLs; missing/invalid targets prevent checkpoint advance.

Each page holds at most 100 events; HTTP responses are capped at 2 MB and time out after ten seconds. Recipient
resolution has a fifteen-second effect deadline and checks interruption between RPC calls. Its owner map lives for one
page only; there is no persistent binding cache whose lifetime could silently retarget players. Invalid source order,
regressed heads, wrong scope, malformed data and lookup failures leave the checkpoint unchanged.

## Durable queue and delivery

Enqueue and checkpoint advance commit in one PostgreSQL transaction. A source lock and cursor comparison make duplicate
page consumers harmless. Delivery IDs combine the existing logical story identity and subscription ID, including paired
battle/transfer deduplication. Source progress, subscriptions and queue records survive process restarts.

The queue holds at most 10,000 records. Capacity pressure leaves source progress unchanged, while delivery and
expiration continue. At most eight sends run concurrently. Workers claim rows with `SKIP LOCKED`, thirty-second leases
and fresh lease tokens; stale acknowledgments cannot complete a newer worker's lease. Interrupted sends are recoverable
after lease expiry. Preference level, subscription presence and automatic opt-in are rechecked immediately before
sending. An account set to Off receives no newly authorized automatic send. A request already accepted by the push
service cannot be recalled.

Transient IO/408/429/5xx failures retry with bounded exponential backoff and Retry-After, at most five attempts. Other
provider rejections finish as failed. HTTP 404/410 removes the expired subscription and its queued records. Envelopes
and provider TTL retain the original event's two-minute expiry; retries never make an old event fresh. Expired queue
records are pruned and expired history events advance without notifying. Backlog/transport latency can therefore expire
alerts.

Automatic push owns OS delivery for the acknowledged source on opted-in devices. A visible game window refreshes a
one-minute foreground lease on its device subscription; active leases are excluded both while enqueueing and in the
final eligibility check. Hiding or leaving the game clears the lease when possible, and expiry restores delivery after a
crash or lost connection. This server-side gate avoids sending a Web Push that the service worker would have to consume
silently, preserving the platform's user-visible-push contract. Other chains/worlds retain local delivery, and pending
activation does not suppress it. Preview-only devices retain local delivery. Provider retries use a stable collapse
topic, and the worker's durable claims suppress repeats across worker restarts. Claims precede native display, so the
existing best-effort limitation remains: a crash after claiming can lose an alert. Do not promise exactly-once OS
banners.

## Operations and verification

The identity `/health` response includes automatic notification enablement, recent health, last tick time and the last
structured result. Tick logs include source position/head, events read, queued/accepted/retried/suppressed/failed
counts, expired records, pending queue size and oldest queue age. Ingestion failures identify their phase and do not
stop delivery of already-queued work. Endpoint credentials, addresses of recipients and notification text are not
logged.

Disable `WEB_PUSH_AUTOMATIC_ENABLED` and restart the identity service to stop automatic sends. This retains checkpoints,
subscriptions and preferences. Re-enabling resumes history and expires stale deliveries. Revocation remains available.
Users can disable background notifications on a device to restore local OS delivery while its game page is running. The
worker shuts down with the identity process; it is not a separate unmanaged timer or service.

Automated PostgreSQL tests cover initial attach, paired recipient fan-out, ended-game drain, restart, checkpoint-write
rollback, concurrent claims, lease fencing, foreground suppression, Off/revocation after enqueue, retry, permanent
rejection and expiry. Herald integration tests cover page boundaries inside a block and preserve the existing deployed
checkpoint. Client tests cover explicit upgrade consent, compatibility, automatic-capability claims and local/push
ownership. Additional regressions cover consent timestamps, queue capacity recovery, competing checkpoint commits,
runtime health/shutdown and logout/disable while setup holds a network lock. Local revocation does not wait for that
lock; remote cleanup remains serialized and registration-scoped. Push API requests time out after ten seconds.

Before production enablement, verify a real confirmed battle on the deployed source, production identity cookies, and
actual Android/iOS banners/clicks with the game closed. Also check Safari's visible-push behavior under
duplicate/revoked messages; these failure-path guards must not be confused with a supported silent-background-push
channel. A browser simulation or encrypted-request unit test is not physical-device delivery evidence.
