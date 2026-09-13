# Web Push transport preview

This milestone registers devices and sends explicit server test notifications. It does not consume Herald events or send
automatic closed-app game alerts. Existing local game notifications continue while a game page runs, including on a
device registered for push tests. The next milestone must connect the confirmed-history consumer and durable outbox
before describing automatic game alerts as available with the app closed.

## Deployment

Apply the `notification_push_subscriptions` declaration through `pnpm --dir packages/db push` against the identity
database before enabling this feature. Drizzle is the only schema source. Sending defaults off and unrelated identity
routes do not require push keys.

Set these server-only variables to enable the preview:

- `WEB_PUSH_ENABLED=true`
- `WEB_PUSH_VAPID_PUBLIC_KEY` and `WEB_PUSH_VAPID_PRIVATE_KEY`: one persistent matching P-256 VAPID key pair
- `WEB_PUSH_VAPID_SUBJECT`: a contact `mailto:` or HTTPS URL

Generate the key pair once using the installed web-push library and store it in the deployment's secret manager. Never
commit it or rotate it on every deploy. The public key is returned by the configuration API; the private key never
leaves the server. An enabled deployment with missing/mismatched keys fails at startup. Setting the flag false stops
sending and new registrations, while device revocation remains available. Keep the database/table available until all
registered devices have been removed.

## HTTP contract

All routes live under `/api/notifications/push/`, use existing identity CORS policy and return `no-store` JSON.

- `GET config`: `{enabled:false}` or `{enabled:true,publicKey}`.
- `POST subscribe`: authenticated `{owner,id,token,subscription:{endpoint,keys:{p256dh,auth}}}`. UUID device ID/token
  are generated and persisted in the service worker before subscribing. Repeats are idempotent; endpoint takeover and
  mismatched IDs/keys/tokens fail with 409. Accounts have at most ten registrations, enforced under a database lock.
- `POST status`: authenticated `{owner,id}` → `{registered}`.
- `POST test`: authenticated `{owner,id,target}` → `{status:"accepted"}`. Sends server-owned test text only. This is an
  explicit transport diagnostic, independent of the account's automatic notification level. At most five tests per
  account per minute; requests are bounded to 4 KiB. A 404/410 push provider result removes the expired registration.
- `POST revoke`: `{id,token}` → `{revoked:true}`. This device-only capability can remove its own registration after
  logout without a still-valid session. The database stores only the token's SHA-256 digest. Unknown/wrong capabilities
  are indistinguishable from successful deletion. The endpoint cannot send notifications or read registrations.

Authenticated operations revalidate the session and require the expected owner. Subscription URLs are restricted to
HTTPS browser-provider hosts (Google, Mozilla, Apple and Windows); credentials, fragments and non-default ports are
rejected. Sending revalidates stored endpoints, forbids redirects, encrypts with aes128gcm, signs with VAPID and times
out after ten seconds. Provider responses and subscription endpoints/keys/tokens must not be logged. Acceptance is not
proof of device receipt. Tests are not queued or automatically retried; the durable game-notification outbox is a later
milestone.

## Device lifecycle

Settings exposes the preview only when enabled by the server, or when an existing registration needs removal. Permission
starts in a click gesture. A browser Web Lock serializes setup and removal across tabs. The worker persists preparation
before network registration and activates only after the server acknowledges it. Account changes invalidate setup.
Revocation marks the local registration inactive before calling the server; a failed cleanup retains the capability in
IndexedDB and exposes a retry. On a subsequent app open, mismatched accounts and pending revocations are reconciled.
Revoking also closes that registration's displayed push tests. Removal remains possible when server sending is disabled.
Session expiry alone does not wake a closed app to revoke a subscription; opening signed out reconciles it.

The v2 IndexedDB upgrade preserves local devices and durable delivery claims. Push envelopes carry a registration ID and
the shared bounded notification payload; only the active matching registration/account may display or handle a click.
Claims are shared with local delivery, survive worker restarts, and commit before native display. Old/expired payloads
are rejected. As with local delivery, a crash after claiming can lose an alert rather than display a duplicate.

## Closed-page verification

1. Deploy the identity API/schema and production client with the preview enabled.
2. Sign in on the production game origin, install the PWA where required, and enable background tests in Settings.
3. Send the in-app test to verify permission, identity cookies, registration and provider acceptance.
4. Close every game tab/PWA window. An operator obtains the intended device ID from the owner-scoped subscription row
   (do not copy endpoint/key/token fields) and runs on the identity server:

   `pnpm --dir apps/realms push:test <owner> <subscription-id> /enter/madara/<game>`

5. Verify an actual OS banner on Android Chrome and an installed iOS Home Screen app; tap it and verify normal game
   entry.
6. Repeat after revocation, account change and reinstallation. Verify old-account tests do not display. Test a failed
   network detach and its retry before rollout.

Automated checks cover API ownership, caps/races in real PostgreSQL, actual VAPID request encryption, storage upgrade
and claims with IndexedDB fixtures, no-page worker delivery, revoked/expired payloads and setup/account-change races.
Physical Android/iOS receipt, production-origin cookies and OS click behavior remain separate release gates. A simulated
browser push cannot close those gates.

References: [Web Push library](https://github.com/web-push-libs/web-push),
[Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API),
[WebKit Home Screen requirements](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
