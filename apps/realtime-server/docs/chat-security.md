# Chat security contract

HTTP and WebSocket callers are identified only by the Better Auth session returned by
`IDENTITY_URL/api/auth/get-session`. The service forwards the incoming `Cookie`; identity headers and query parameters
are ignored. Browser origins must be explicitly listed in `CORS_ORIGIN`.

The verified identity is the owner wallet, while game rows are keyed by its gameplay account. The service resolves that
link from `PLAYER_REGISTRY_ADDRESS.account_of(owner)` on `GAME_RPC_URL`; it never accepts a gameplay address from the
browser.

Blitz channel membership comes from Herald's game directory. That directory folds `GameRegistry` and `WorldConfig`, and
derives `player_state.registered` / `player_state.settled` from `BlitzSettlement` and `Structure`. The chat service
accepts only `game:<id>` channels for the Blitz MVP and checks the cached Herald result on read, join, and publish.

Message metadata is untrusted data. Input is limited by key count, encoded byte size, and nesting depth. Every renderer
must continue to treat content and metadata as data: React text interpolation or equivalent escaping is required;
injecting either field into HTML is forbidden.
