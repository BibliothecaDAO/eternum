# Recorded sequencer entropy, version 3

Madara owns execution, transaction validation, scheduling and chain recovery. The game adds signed intents, ordered
recorded contexts, committed epoch randomness and ticket attribution. The operator remains trusted to admit fairly.
Epoch verification proves how recorded roots were derived; it does not prove honest secret selection or prevent an
operator from discarding unexecuted work during a restart.

## Canonical representation

Integers are unsigned. Felts are strictly below `2^251 + 17 * 2^192 + 1`, encoded as 32-byte big-endian values including
leading zeros. Decoders reject noncanonical values, unknown versions, truncation and trailing elements.

The signed intent retains version 1:

| Position  | Value                                       | Type       |
| --------- | ------------------------------------------- | ---------- |
| 0         | `ETERNUM_ACTION`                            | felt       |
| 1         | `1`                                         | version    |
| 2         | Chain identity                              | felt       |
| 3         | Native season entrypoint address            | felt       |
| 4         | Game ID                                     | felt       |
| 5         | Gameplay account                            | felt       |
| 6         | Actor nonce                                 | u64        |
| 7         | Command commitment                          | felt       |
| 8         | Immutable rules identity                    | felt       |
| 9         | Earliest acceptance time, inclusive         | u64        |
| 10        | Latest acceptance time, inclusive           | u64        |
| 11        | Latest acceptable recorded order, inclusive | u64        |
| 12        | Argument count, at most 256                 | u32        |
| 13 onward | Serialized command arguments                | felt array |

`action_id = poseidon_hash_span(intent_felts)`. The registered gameplay key signs this identity. The native command
commitment is `poseidon_hash_span([ETERNUM_COMMAND, 1, ...canonical_serialized_arguments])`; a mismatch is rejected.
Signatures and transaction hashes are outside the identity. The nonce uniqueness key is
`(chain, deployment, game, actor, nonce)`.

The version 3 envelope has no preceding-state or gas binding:

| Position | Value                                      | Type    |
| -------- | ------------------------------------------ | ------- |
| 0        | `ETERNUM_ENTROPY`                          | felt    |
| 1        | `3`                                        | version |
| 2        | Action identity                            | felt    |
| 3        | Deployment-wide order, starting at one     | u64     |
| 4        | Recorded gameplay timestamp                | u64     |
| 5        | Immutable execution configuration identity | felt    |
| 6        | Root low limb                              | u128    |
| 7        | Root high limb                             | u128    |

`binding = poseidon_hash_span(envelope_felts)`. Context contains only this envelope. Roots remain in transaction
calldata, not in per-action contract storage.

## Epoch randomness

The sequencing account stores epoch commitments, order ranges and revealed secrets. Before assigning an epoch's first
order, it publishes `poseidon_hash_span([ETERNUM_EPOCH, 1, secret.low, secret.high])`. The secret is sampled with the OS
entropy source; failure has no fallback. Each root is `u256(poseidon_hash_span([secret.low, secret.high, order]))`.

`open_randomness_epoch(commitment, last_order)` starts at the execution head's next order. A new epoch requires the
previous range to have executed and its secret to have been revealed. Commitments cannot be reused.
`reveal_randomness_epoch(secret)` checks the commitment and rejects until the head reaches the epoch's last order.
`current_randomness_epoch()` and `get_randomness_epoch(id)` expose the commitment, range and any revealed secret. An
unknown epoch is an error. The account rejects execution outside its current unrevealed range.

Only the account's signed transaction path can open or reveal epochs. The node retains the minimum secret material
needed to fulfil reveal obligations after restart, without persisting ticket assignments. A revealed secret never
supplies new draws. Anyone can recompute recorded roots after reveal using the epoch range and wrapper transaction
calldata.

## Admission and execution

One deployment has one ordered stream, including non-random actions. Admission verifies signatures before queueing, then
reads the registered key, PlayerRegistry binding, approved account class, nonce, rules and configuration from node
state. It checks chain, deployment and the intent's validity window. There is at most one pending ticket per player and
a transport-peer IP request cap. An identical pending intent reuses its ticket; different content at that nonce
conflicts.

Admission assigns an order, context and root in a bounded volatile queue. It does not guess preceding execution state.
Packing is bounded by ticket count, elapsed time and transaction resources. Transactions enter Madara's validated
submission path. Ticket status uses the v0.10.2 WebSocket route; no receipt or HTTP status polling is required.

`execute(intent, context, r, s)` and `execute_batch(actions)` share the same action implementation. A batch contains at
most 64 recorded actions. Every action checks `order == head.order + 1` and records its own outcome. A malformed ticket
reverts the transaction atomically; the service bisects a definitively failed batch until it isolates the failing
ticket. It never rejects a whole batch of otherwise valid actions.

Season authenticates the sequencing account as caller. The account independently verifies its v3 transaction signature
and sender during execution, including simulation, restricts calls to recorded execution and epoch management, and
rejects callbacks and extra account calls. Season verifies each player signature against the registered gameplay key
before consuming the nonce. Settlement derives ownership through PlayerRegistry; no client-supplied owner is accepted.

Player key rotation waits until pending work executes. Registry bindings are immutable. Authority credential rotation
changes its signing key without changing the authority address, intent, order or context.

Recorded time must not exceed block time or precede the execution head timestamp; equal timestamps are allowed. Validity
is checked against acceptance time. A queued ticket can execute arbitrarily late with its recorded context; lag above
300 seconds is an operational alert, not a consensus rejection.

An authenticated next-order ticket with invalid gameplay records a terminal reason and advances order. The actor nonce
advances only after the signing domain and registered signature authenticate, when the game and actor are representable
and the submitted nonce equals the current nonce with a representable successor. A stale nonce never consumes another
action's nonce. Admission rejects stale or exhausted nonces before assigning a draw. Game losses are successful actions.
Malformed envelopes, mismatched identities, invalid order/configuration, future/backwards timestamps and unauthorized
sequencing callers establish no ticket and consume nothing.

## Storage, events and views

Each consumed action writes its actor nonce and the execution head. The head uses two slots: `order + timestamp * 2^64`
and a running transcript commitment. A stale or unrepresentable nonce is not written. There is no per-order result map.

One `ExecutionRecorded` event carries seven data felts:

| Field           | Type                                         |
| --------------- | -------------------------------------------- |
| game_id         | felt                                         |
| actor           | felt                                         |
| submitted nonce | u64                                          |
| nonce consumed  | bool                                         |
| order           | u64                                          |
| status          | u8: 1 applied, 2 rejected                    |
| reason          | felt: zero for applied, nonzero for rejected |

Herald validates the event codec and derives `ActionNonce.next_nonce = submitted nonce + 1` only when consumption is
true. It folds every ticket in a transaction atomically and retains ticket-scoped status. A transaction hash alone does
not identify an action. Gameplay rows remain authoritative for effects.

The running commitment is `poseidon_hash_span([previous_head.state, binding, status, reason, nonce_consumed])`. It
commits each action, root, time and outcome without making the next envelope wait for it. `get_admission(game, actor)`
returns registered key, rules identity, execution configuration identity, actor nonce, next order and current block
timestamp. The timestamp is an admission observation, not a previous ticket's acceptance time. `get_head()` returns
order, recorded timestamp and state. Outcomes come from receipts matched to the accepted ticket.

Terminal reasons include `INVALID_GAME`, `INVALID_ACTOR`, `STALE_NONCE`, `NONCE_EXHAUSTED`, `FOREIGN_CHAIN`,
`FOREIGN_DEPLOYMENT`, `INVALID_RULES`, `INVALID_SIGNATURE`, `INVALID_ACCEPTANCE`, `INVALID_COMMAND`, `GAMEPLAY_REJECTED`
and `EXECUTION_FAILED`. Domain reverts roll back domain effects before recording a rejection.

## Retry and restart

Ordinary retries retain the same pending ticket, order, root and timestamp. Only an included revert or a deterministic
sequencer refusal permits `reject_execution`, recording `EXECUTION_FAILED` in that ticket's order. Missing receipts,
timeouts, disconnects, full queues and account-nonce races are not definitive failures. Reconcile against node state and
transaction observations before retrying; an already recorded action cannot execute again.

Restart may discard every unexecuted volatile assignment, including assigned orders and roots. The client resubmits its
same signed intent only if its nonce remains unconsumed in recovered state. Re-admission may produce a different order
and root. This is the accepted reroll boundary. An ordinary disconnect does not authorize replacing a pending draw.
There is no ticket journal, standby replication, fencing/promotion protocol or sidecar placement.

## Gameplay derivation and cosmetics

Gameplay derives `h = poseidon_hash_span([root.low, root.high, salt])` and `draw = u256(h) % upper_bound` with a
positive bound. Caller salts, game scoping, increments and recorded timestamp context are preserved. Weighted choices
start from gameplay time and increment the salt by 18 before each attempt, including duplicate rejections without
replacement. Uniform choices use indices starting at zero.

Recorded cosmetic facts remain unchanged within an accepted ticket. New L2 ownership/lock issuance belongs to deferred
ledger integration; free L3 playtests use the explicit no-cosmetic path. Unbound gameplay accounts still cannot act.

## Conformance

Rust and Cairo share `tests/fixtures/v3.txt` for canonical encoding, identities and draw vectors, and `context-v2.txt`
for time/order boundaries. The same protocol assertions run against the stub and native season domain. They cover
registered authentication before nonce consumption, malformed transport, delayed execution, monotonic time, mixed
batches, atomic rollback, per-ticket heads and epoch reveals. The compiled ABI check includes the sequencing account.

The stub's root observation is test-only gameplay data. This protocol change requires a fresh rehearsal deployment; no
live upgrade compatibility is claimed. Deployed service, restart and latency gates remain separate from unit tests.
