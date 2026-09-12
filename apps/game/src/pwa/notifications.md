# Local game notifications

Local delivery is opt-in per identity account on this device. Settings separates the account's
Off/Important/Standard/All level from device enablement and browser permission. Enabling requests permission in the
button gesture. Spectators do not see permission controls; anonymous preferences stay local, but device delivery
requires sign-in. Home Screen guidance follows
[WebKit's installation and gesture requirements](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

The transport's `confirmedAfterAttach` flag is true only for confirmed events newer than the head advertised when that
socket connected. Local delivery deliberately skips initial catch-up and all events confirmed during a disconnect, even
if the outage was brief. This avoids a notification burst after reconnect; those events remain in activity history.
Account, gameplay recipient, preference state, game scope and permission are checked before delivery, and account/game/
preference changes invalidate asynchronous work. Successful account saves notify other same-origin tabs to reload the
server-owned preference, without putting its value in browser storage. Delivery remains paused during refresh, including
when invalidation arrives during an existing read or save. Refresh failures keep delivery paused and surface in
Settings; focus and browser-online events also reload preferences. Focused activity stays in the feed; a matching
focused tab suppresses OS output from background tabs too. A browser PushSubscription suppresses local delivery so a
later push transport can own it.

The worker receives bounded version-1 display envelopes: source/logical ID, account owner, title/body, an allowlisted
game entry path, and creation/expiry times. There are no gameplay entity rows or arbitrary URLs. Local payloads expire
after two minutes. Game entry always uses the normal bootstrap. Clicks focus an existing matching game without
navigating it, or open a separate entry flow; an existing game's transactions are never interrupted by forced
navigation.

Shared logical identity groups paired battle and delayed-transfer records using the first of their adjacent UUIDs. The
current Cairo emitters allocate the sender/attacker record first. The locked
[Dojo 1.8.0 UUID implementation](https://github.com/dojoengine/dojo/blob/v1.8.0/crates/dojo/core/src/world/world_contract.cairo#L984)
increments its counter once per call; emitting the record does not advance it. Behavioral fixtures cover mirrored
records and distinct actions; policy inventory is checked against the generated StoryEvent manifest. Distinct actions in
one transaction retain distinct IDs. Ambiguous perspectives are rejected rather than guessed. Feed battle grouping and
audio cues use the same identity as notification delivery.

IndexedDB stores one enabled owner/token and at most 4,096 unexpired delivery IDs. Enablement rotates the token.
Disablement checks the owner and closes its displayed notices. A serialized worker queue accepts at most 64 pending
requests. Delivery claims and device/token checks commit atomically across tabs and worker versions. Expired IDs are
pruned; unexpired IDs are never evicted to make room. Focused activity is claimed too, preventing a delayed copy after
blur from showing an alert. A failed account detach is visible with a retry control. The dispatcher still rejects work
from the previous account.

Claims commit before showNotification. This deliberately favors suppression of repeated alerts: a crash or OS error
after the claim may lose a local alert, and the same ID will not retry within its lifetime. Browser acceptance is not
proof of an OS banner. Local delivery stops when the page is frozen, discarded, or closed; server push remains
unimplemented.

Verification uses dispatcher, worker, policy and permission-control unit fixtures. The deploy-time browser lifecycle
runner and its Playwright dependency have been removed to match the current deployment pipeline. Physical Android/iOS
installation, actual OS banners, live battle notification delivery and production-origin cookie checks remain release
gates. No VAPID keys, PushSubscription mutation, push listener, or durable server notifier is implemented here.
