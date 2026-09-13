# Notification preferences

The identity service stores one account notification level: `off`, `important`, `standard`, or `all`. Shared policy and
recipient rules live in `@bibliothecadao/notifications`. Device delivery is not enabled by choosing a level. The game
client offers a separate device opt-in for local delivery while its page runs. The
[Web Push transport preview](./web-push.md) adds subscriptions, VAPID, and explicit server test delivery; automatic
game-event push and its durable notifier remain separate work. See `apps/game/src/pwa/notifications.md` for local
behavior.

The table has one schema source: `packages/db/src/schema/notifications.ts`. Apply it before deploying this API through
the existing database workflow: `pnpm --dir packages/db push` against the intended identity database. There is no
parallel handwritten SQL migration. The table has level/revision constraints and a cascading reference to the identity
user.

`GET /api/notifications/preferences` returns `{owner, level, revision}` for the authenticated account. An account
without a saved preference reads `off` at revision zero. `POST` accepts the same shape with the desired level and last
read revision. The session establishes ownership; the body owner is an account-switch precondition. Wrong owners return
403, stale revisions return 409, unauthenticated requests return 401, and malformed JSON/values return 400. POST
requires JSON, reads at most 1 KiB, and shares a 60-request/minute account limit with GET. Responses are `no-store`.
Existing identity CORS rules apply. Sessions are revalidated without the authentication library's cookie cache.

The client uses the existing identity transport, including credentialed cookies and its loopback bearer support. It
loads account preferences on login and refreshes on focus/reconnect. Settings and the local dispatcher share the same
acknowledged preference state. Anonymous choices stay in their own browser storage key and are never uploaded on login.
Saves update the selected level only after acknowledgment; conflicts and failed requests require reload before another
save. Account changes discard late responses.

Run integration tests against a disposable PostgreSQL database with `IDENTITY_TEST_DATABASE_URL` set:

```sh
pnpm --dir apps/realms test server/main.test.ts server/notification-preference-store.integration.test.ts
```

Tests create and remove unique schemas, generate table DDL from the Drizzle declaration, race first saves and updates,
verify persistence, enforce owner isolation and constraints, and check deletion cascades. The notifications PR workflow
supplies PostgreSQL. Browser cookie behavior across production origins and physical-device permission UX remain release
gates.

The preference store is an Effect service with an injectable layer and typed storage failures. The HTTP adapter runs the
effect at the request boundary and maps validation/authentication/storage failures to explicit no-store responses.
Writes are not automatically retried: revision conflicts and ambiguous failures require the client to reload.
