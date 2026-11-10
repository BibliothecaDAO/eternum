# Local game notifications

Local delivery is opt-in per identity account on this device. Settings separates the account's Off/Important/All level
from device enablement and browser permission. Enabling requests permission in the button gesture. Spectators do not see
permission controls; anonymous preferences stay local, but device delivery requires sign-in. Home Screen guidance
follows
[WebKit's installation and gesture requirements](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

The transport's `confirmedAfterAttach` flag is true only for confirmed events newer than the head advertised when that
socket connected. Local delivery deliberately skips initial catch-up and all events confirmed during a disconnect, even
if the outage was brief. This avoids a notification burst after reconnect; those events remain in activity history.
Account, gameplay recipient, preference state, game scope and permission are checked before delivery, and account/game/
preference changes invalidate asynchronous work. Successful account saves notify other same-origin tabs to reload the
server-owned preference, without putting its value in browser storage. Delivery remains paused during refresh, including
when invalidation arrives during an existing read or save. Refresh failures keep delivery paused and surface in
Settings; focus and browser-online events also reload preferences. For local delivery, visible activity stays in the
feed; a matching visible tab suppresses OS output from background tabs too. Automatic push owns OS alerts on devices
that explicitly enable game alerts. While any game window is visible, it refreshes a short server lease that suppresses
automatic sends; hiding or leaving the game clears the lease, and expiry covers crashes or lost connections.
Preview-only devices retain local delivery. Both paths share logical identity and durable claims.

In the iOS app (apps/ios) the web view has no service worker or Web Push, so **This device** is the app's own push
(`ios-app-push.ts`): turning it on asks iOS, registers the APNs token the app's push plugin returns (lowercased) with
the identity service under a new device id and revocation token kept in the page's storage, and sends the first push. At
launch and at each sign-in, sign-out or account switch the registration is checked: another account's, or one whose
alerts were turned off in iOS Settings, is revoked; a changed APNs token registers the phone again after revoking the
old registration. A registration is on only once the identity service answered it. One still unanswered or not yet
acknowledged as revoked keeps its id and revocation token in the page's storage, and the next check revokes it, even for
the same account and token. The service makes an acknowledged revocation final: it records the revoked id for a day and
refuses a registration of that id still on its way (a request the page timed out on, or one sent before a restart), so
the page drops the credentials once its revocation is acknowledged. It refuses a registration still on its way for a
deleted account the same way, in the same insert (`account_deletions`, from any device). A tapped alert opens what it
names by the service worker's rules (`isChatClient`, `notificationMatchesGame`), only when it is the signed-in account's
alert for this registration; a chat alert tapped from a cold start waits for the chat drawn after it. iOS shows no alert
while the app is in front. APNs receives the alert's title and body and its envelope (owner, device id, target, tag,
times) as readable JSON over TLS, where Web Push encrypts its payload for the device.

Direct-message push begins only after chat persistence. The realtime service sends the identity server message/thread
identity, recipient, sender display name and timestamp, but never private message content. The device sees a "Message
from …" alert, repeated messages collapse per thread, Off suppresses them, and the game foreground lease keeps them in
the live chat UI while the player is active. DM delivery requires explicit consent on a compatible device. Existing
subscriptions can enable DM alerts in Settings; the server excludes registrations that have not completed that upgrade.

The worker receives bounded version-1 display envelopes: source/logical ID, account owner, title/body, an allowlisted
game entry path, creation/expiry times, its kind and its tag. There are no gameplay entity rows or arbitrary URLs. Each
kind lives while it is news (`packages/notifications/src/notification-kinds.ts`): a Day open push until an hour before
its day ends, rested armies until their day ends, results a day, fights, deliveries and messages an hour; a notice with
no kind two minutes. One tag per game and kind, and the matching Web Push Topic, let a newer alert replace the one shown
or still waiting at the push service. Every alert is shown by one call (`showAlert`) with the installed app's icon,
which the build stamps into the worker per environment, and the small globe in white as Android's status bar badge. Game
entry always uses the normal bootstrap. Clicks focus an existing matching game without navigating it, or open a separate
entry flow; an existing game's transactions are never interrupted by forced navigation.

Shared logical identity groups paired battle and delayed-transfer records by their action identity. The native emitters
and notification rules must agree on perspective and ordering; behavior tests cover mirrored records and distinct
actions. Policy inventory is checked against the compiled native Story enum. Distinct actions in one transaction retain
distinct IDs. Ambiguous perspectives are rejected rather than guessed. Feed battle grouping and audio cues use the same
identity as notification delivery.

IndexedDB stores one enabled owner/token and at most 4,096 unexpired delivery IDs. Enablement rotates the token.
Disablement checks the owner and closes its displayed notices. A serialized worker queue accepts at most 64 pending
requests. Delivery claims and device/token checks commit atomically across tabs and worker versions. Expired IDs are
pruned; unexpired IDs are never evicted to make room. Focused activity is claimed too, preventing a delayed copy after
blur from showing an alert. A failed account detach is visible with a retry control. The dispatcher still rejects work
from the previous account.

Claims commit before showNotification. This deliberately favors suppression of repeated alerts: a crash or OS error
after the claim may lose a local alert, and the same ID will not retry within its lifetime. Browser acceptance is not
proof of an OS banner. Local delivery stops when the page is frozen, discarded, or closed. Explicitly enabled automatic
delivery continues through the server notifier, which sends only from the shards in our directory, by the account's
latest preference. A story that reaches a device both from the live page and by push is one alert: both claim the same
ID.

Verification uses dispatcher, worker, policy and permission-control unit fixtures. The deploy-time browser lifecycle
runner and its Playwright dependency have been removed to match the current deployment pipeline. Physical Android/iOS
installation, actual OS banners, live battle notification delivery and production-origin cookie checks remain release
gates. Subscriptions, VAPID sending and the durable game-event notifier have separate server and device opt-in. Pending
automatic activation remains locally deliverable until the server is acknowledged.
