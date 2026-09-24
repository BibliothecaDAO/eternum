# Recorded sequencer entropy, version 6

Madara owns execution, transaction validation, scheduling and chain recovery. The game adds signed intents, ordered
recorded contexts, committed epoch randomness and ticket attribution. The operator remains trusted to admit fairly.
Epoch verification proves how recorded roots were derived; it does not prove honest secret selection or prevent an
operator from discarding unexecuted work during a restart.

## Canonical representation

Integers are unsigned. Felts are strictly below `2^251 + 17 * 2^192 + 1`, encoded as 32-byte big-endian values including
leading zeros. Decoders reject noncanonical values, unknown versions, truncation and trailing elements.

The signed intent uses version 2:

| Position  | Value                                       | Type       |
| --------- | ------------------------------------------- | ---------- |
| 0         | `ETERNUM_ACTION`                            | felt       |
| 1         | `2`                                         | version    |
| 2         | Chain identity                              | felt       |
| 3         | Games entrypoint address                    | felt       |
| 4         | Game ID                                     | felt       |
| 5         | Gameplay account                            | felt       |
| 6         | Actor nonce                                 | u64        |
| 7         | Command commitment                          | felt       |
| 8         | Game's pinned release ID                    | u32        |
| 9         | Preset commitment                           | felt       |
| 10        | Earliest acceptance time, inclusive         | u64        |
| 11        | Latest acceptance time, inclusive           | u64        |
| 12        | Latest acceptable recorded order, inclusive | u64        |
| 13        | Argument count, at most 256                 | u32        |
| 14 onward | Serialized command arguments                | felt array |

`action_id = poseidon_hash_span(intent_felts)`. A device key of the actor's account signs this identity. The signature
travels as one felt span and is checked only by the actor account's SNIP-6 `is_valid_signature`, so its layout is the
account's (`[device_key, r, s]` for Realms accounts). The native command commitment is
`poseidon_hash_span([ETERNUM_COMMAND, 1, ...canonical_serialized_arguments])`; a mismatch is rejected. Signatures and
transaction hashes are outside the identity. The nonce uniqueness key is `(chain, deployment, game, actor, nonce)`.

The version 6 envelope binds the same release and preset pair:

| Position | Value                                    | Type    |
| -------- | ---------------------------------------- | ------- |
| 0        | `ETERNUM_ENTROPY`                        | felt    |
| 1        | `6`                                      | version |
| 2        | Action identity                          | felt    |
| 3        | Order within the action's game, from one | u64     |
| 4        | Recorded gameplay timestamp              | u64     |
| 5        | Game's pinned release ID                 | u32     |
| 6        | Preset commitment                        | felt    |
| 7        | Randomness epoch that derived the root   | u64     |
| 8        | Root low limb                            | u128    |
| 9        | Root high limb                           | u128    |

`binding = poseidon_hash_span(envelope_felts)`. Context contains only this envelope. Roots remain in transaction
calldata, not in per-action contract storage.

## Epoch randomness

The sequencing account stores epoch commitments and revealed secrets; epochs are numbered from one and are shared by
every game on the shard. Before assigning any root from an epoch, it publishes
`poseidon_hash_span([ETERNUM_EPOCH, 1, secret.low, secret.high])`. The secret is sampled with the OS entropy source;
failure has no fallback. Each root is `u256(poseidon_hash_span([secret.low, secret.high, game_id, order]))`, so a game's
roots depend only on the secret and that game's own orders.

`open_randomness_epoch(commitment)` opens the next epoch and requires the previous one to have been revealed.
Commitments cannot be reused. `reveal_randomness_epoch(secret)` checks the commitment and closes the epoch.
`current_randomness_epoch()` and `get_randomness_epoch(id)` expose the commitment and any revealed secret. An unknown
epoch is an error. The account refuses execution while its current epoch is revealed, and execution checks that each
envelope names the current epoch, so a revealed secret never supplies new draws.

Only the account's signed transaction path can open or reveal epochs. Admission reveals only with nothing queued or in
flight: at every start, once transactions retained from an earlier run have executed or been dropped, and after a
bounded number of admitted tickets. Each reveal is followed by a fresh commitment. Admission retains only the open
epoch's secret across restart, never ticket assignments. Anyone can recompute recorded roots after reveal from the
envelope's epoch and the wrapper transaction calldata, one game at a time.

## Admission and execution

Each game has its own ordered stream, including non-random actions. Admission verifies signatures before queueing: it
requires the actor to run the shard's configured account class, calls the actor's `is_valid_signature`, and reads the
nonce, the game's release pin and preset commitment from node state. It checks chain, deployment and the intent's
validity window. There is at most one pending ticket per player and a transport-peer IP request cap. An identical
pending intent reuses its ticket; different content at that nonce conflicts.

Admission assigns the next order of the intent's game, the current epoch and a root in a bounded volatile queue; the
first ticket of a game after a start takes its order from that game's recorded head. It does not guess preceding
execution state. Packing is bounded by ticket count, elapsed time and transaction resources. Transactions enter Madara's
validated submission path and ticket status follows the v0.10.2 WebSocket route. The gateway beside a stock node uses
only public JSON-RPC and WebSocket methods. A submitted transaction whose status stays silent is looked up once; if the
node no longer knows it, one simulation recovers the executor's reason. Only a deterministic executor limit counts as a
refusal; any other drop resubmits the same transaction.

`execute(intent, context, signature)` and `execute_batch(actions)` share the same action implementation. A batch
contains at most 64 recorded actions and may mix games. Every action checks `order == head(game).order + 1` against its
own game's head, extends that game's chain and records its own outcome. A malformed ticket reverts the transaction
atomically; the service bisects a definitively failed batch until it isolates the failing ticket. It never rejects a
whole batch of otherwise valid actions.

Games authenticates the sequencing account as caller. The account independently verifies its v3 transaction signature
and sender during execution, including simulation, restricts calls to recorded execution and epoch management, and
rejects callbacks and extra account calls. Before consuming the nonce, Games requires the actor to run the configured
account class and calls its `is_valid_signature(action_id, signature)`; a refusal or a failing call records
`INVALID_SIGNATURE`. The authenticated account is the player: settlement keys entries by it, and no client-supplied
owner is accepted.

Device keys change on the account itself. A ticket admitted before its key was revoked fails authentication at execution
and consumes no actor nonce or gameplay state. Authority credential rotation changes its signing key without changing
the authority address, intent, order or context.

Recorded time must not exceed block time or precede the game's head timestamp; equal timestamps are allowed. Validity is
checked against acceptance time. A queued ticket can execute arbitrarily late with its recorded context; lag above 300
seconds is an operational alert, not a consensus rejection.

An authenticated next-order ticket with invalid gameplay records a terminal reason and advances order. The actor nonce
advances only after the signing domain and the account's signature check authenticate, when the game and actor are
representable, the release and preset pair matches the game, and the submitted nonce equals the current nonce with a
representable successor. A stale nonce never consumes another action's nonce. Admission rejects stale or exhausted
nonces before assigning a draw. Game losses are successful actions. Malformed envelopes, mismatched identities, invalid
order or an envelope pair that differs from its intent, future/backwards timestamps and unauthorized sequencing callers
establish no ticket and consume nothing.

## Storage, events and views

Each consumed action writes its actor nonce and its game's execution head. A game's head uses two slots:
`order + timestamp * 2^64` and a running transcript commitment. A stale or unrepresentable nonce is not written. There
is no per-order result map.

The schema v2 `ExecutionRecorded` event separates the status class from the rejection message:

| Field           | Type                                                                        |
| --------------- | --------------------------------------------------------------------------- |
| game_id         | felt                                                                        |
| actor           | felt                                                                        |
| submitted nonce | u64                                                                         |
| nonce consumed  | bool                                                                        |
| order in game   | u64                                                                         |
| status          | u8: 1 applied, 2 rejected                                                   |
| status_class    | felt: zero for applied, named class for rejected                            |
| reason          | ByteArray: empty for applied, full domain or admission message for rejected |

Herald validates the event codec and derives `ActionNonce.next_nonce = submitted nonce + 1` only when consumption is
true. It folds every ticket in a transaction atomically and retains ticket-scoped status keyed by game and order. A
transaction hash alone does not identify an action. Gameplay rows remain authoritative for effects.

The running commitment is
`poseidon_hash_span([previous_head(game).state, binding, status, status_class, nonce_consumed, ...Serde(reason)])`. It
commits each action, root, time and outcome without making the next envelope wait for it. `get_admission(game, actor)`
refuses an actor without the configured account class and returns the game's pinned release ID, preset commitment, actor
nonce, the game's next order and current block timestamp. The timestamp is an admission observation, not a previous
ticket's acceptance time. `get_head(game)` returns the game's order, recorded timestamp and state. Outcomes come from
receipts matched to the accepted ticket.

Terminal status classes include `INVALID_GAME`, `INVALID_ACTOR`, `STALE_NONCE`, `NONCE_EXHAUSTED`, `FOREIGN_CHAIN`,
`FOREIGN_DEPLOYMENT`, `STALE_RELEASE`, `INVALID_PRESET`, `INVALID_SIGNATURE`, `INVALID_ACCEPTANCE`, `INVALID_COMMAND`,
`GAMEPLAY_REJECTED` and `EXECUTION_FAILED`. Domain reverts roll back domain effects before recording a rejection.
`GAMEPLAY_REJECTED` is the class; its reason is the original Cairo assertion or short-string panic message, including
messages longer than 31 bytes. Admission rejections keep their named code as the reason. Both class and reason are
committed by the recorded head.

Games authenticates the game's release and preset before gameplay. Each logic invocation loads the game and rules once
into a shared local context; internal helpers reuse those values. Resource and biome calls receive only the fields they
use. The context is held in memory and never written to storage. Admission uses the game's pin even when another release
becomes current on the shard. `STALE_RELEASE` and `INVALID_PRESET` leave the actor nonce and gameplay unchanged. A
recorded refusal still advances the game's ticket head. The client reads `GameRelease` from the fact stream; after
`STALE_RELEASE`, it waits for the updated pin, reloads the manifest and schema, and signs once more with that pair. A
release without the client's compiled decoder is refused as `UNKNOWN_RELEASE_SCHEMA`; a hotfix with the same schema
remains usable.

## Retry and restart

Ordinary retries retain the same pending ticket, order, root and timestamp. Only an included revert or a deterministic
sequencer refusal permits `reject_execution`, recording `EXECUTION_FAILED` in that ticket's order. Missing receipts,
timeouts, disconnects, full queues and account-nonce races are not definitive failures. Reconcile against node state and
transaction observations before retrying; an already recorded action cannot execute again.

Restart may discard every unexecuted volatile assignment, including assigned orders and roots. It reveals the open
epoch, so a lost ticket's root is never reused; only the games that lost tickets reassign those orders. The client
resubmits its same signed intent only if its nonce remains unconsumed in recovered state. Re-admission may produce a
different order and root. This is the accepted reroll boundary. An ordinary disconnect does not authorize replacing a
pending draw. There is no ticket journal, standby replication or fencing/promotion protocol.

The gateway cannot read the node's mempool. Account transactions execute in nonce order and the mempool refuses a second
transaction at a taken nonce without a tip bump, so the start-up epoch commands land only after every retained
transaction has executed or been dropped. A failed run, including a node restart, restarts admission from recorded heads
the same way.

## Gameplay derivation and cosmetics

Gameplay derives `h = poseidon_hash_span([root.low, root.high, salt])` and `draw = u256(h) % upper_bound` with a
positive bound. Caller salts, game scoping, increments and recorded timestamp context are preserved. Weighted choices
start from gameplay time and increment the salt by 18 before each attempt, including duplicate rejections without
replacement. Uniform choices use indices starting at zero.

Recorded cosmetic facts remain unchanged within an accepted ticket. New L2 ownership/lock issuance belongs to deferred
ledger integration; free L3 playtests use the explicit no-cosmetic path. Accounts of any other class cannot act.

## Conformance

Rust and Cairo share `tests/fixtures/v6.txt` for canonical encoding, identities, draw vectors and per-game epoch roots,
and `context-v2.txt` for time/order boundaries. The same protocol assertions run against the stub and native Games
contract. They cover account authentication before nonce consumption, malformed transport, delayed execution, monotonic
time, batches mixing two games, atomic rollback, per-game heads, restart rerolls and epoch reveals. The compiled ABI
check includes the sequencing account.

The stub's root observation is test-only gameplay data. This protocol change requires a fresh rehearsal deployment; no
live upgrade compatibility is claimed. Deployed service, restart and latency gates remain separate from unit tests.
