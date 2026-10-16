/**
 * Why the shard's stamping RPC refused a play before the node took it. The RPC sends the reason as its -32010 answer's
 * `data.reason`; the player's client names it. Each reason is a rule the player's own client could have met, never a
 * detail of the box.
 */
export const PLAY_REFUSALS = {
  "in-flight": "Another of your actions was still being sent. Try again.",
  nonce: "Another action from this account was sent first, perhaps from another tab. Try again.",
  deadline: "The shard took too long to accept this action. Try again.",
  stamp: "The shard could not seal this action. Try again.",
  validation: "The shard does not accept this action from this account.",
  unavailable: "The shard could not reach its node. Try again.",
} as const;

export type PlayRefusalReason = keyof typeof PLAY_REFUSALS;

/** The RPC's code for a play it refused before forwarding. */
export const PLAY_REFUSED_CODE = -32010;

const isPlayRefusalReason = (value: unknown): value is PlayRefusalReason =>
  typeof value === "string" && Object.hasOwn(PLAY_REFUSALS, value);

/** The reason a refusal names, read from the RPC error as starknet.js wraps it (or bare); undefined when it names none. */
export function playRefusalReasonOf(error: unknown): PlayRefusalReason | undefined {
  const candidate = error as { code?: unknown; data?: unknown; baseError?: { code?: unknown; data?: unknown } } | null;
  const answer = candidate?.baseError ?? candidate;
  if (answer?.code !== PLAY_REFUSED_CODE) return undefined;
  const reason = (answer.data as { reason?: unknown } | undefined)?.reason;
  return isPlayRefusalReason(reason) ? reason : undefined;
}
