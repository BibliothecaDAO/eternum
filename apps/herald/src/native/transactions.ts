import { hash } from "starknet";
import type { NativeManifest } from "./schema";

const PLAY = BigInt(hash.getSelectorFromName("play"));

/**
 * Receipt routing only: which game a transaction belongs to and who sent it. A game action is the sender account's
 * own call of Games.play, whose first argument is the game id; the actor is the sending account itself. A pre-roll
 * revert routes the same way, though it emits nothing. Authentication and game mutations are enforced by execution.
 */
export function transactionScopes(
  manifest: NativeManifest,
  transaction: { calldata?: string[]; sender_address?: string },
): { gameId: string; actor: string }[] {
  const { calldata, sender_address: sender } = transaction;
  if (!calldata?.length || sender === undefined) return [];
  const scopes = new Map<string, { gameId: string; actor: string }>();
  for (const call of accountCalls(calldata)) {
    if (BigInt(call.address) !== BigInt(manifest.world.address) || BigInt(call.selector) !== PLAY) continue;
    const [game] = call.calldata;
    if (game === undefined || BigInt(game) <= 0n || BigInt(game) >= 2n ** 32n) throw new Error("Malformed play call");
    const scope = { gameId: String(BigInt(game)), actor: String(BigInt(sender)) };
    scopes.set(`${scope.gameId}:${scope.actor}`, scope);
  }
  return [...scopes.values()];
}

export function accountCalls(calldata: string[]) {
  const count = boundedLength(calldata[0], calldata.length / 3);
  const calls: { address: string; selector: string; calldata: string[] }[] = [];
  let offset = 1;
  for (let index = 0; index < count; index++) {
    const [address, selector, length] = calldata.slice(offset, offset + 3);
    offset += 3;
    const size = boundedLength(length, calldata.length - offset);
    calls.push({ address, selector, calldata: calldata.slice(offset, offset + size) });
    offset += size;
  }
  if (offset !== calldata.length) throw new Error("Trailing account calldata");
  return calls;
}

function boundedLength(value: string, limit: number): number {
  const length = Number(BigInt(value));
  if (!Number.isSafeInteger(length) || length < 0 || length > limit) throw new Error("Malformed account calldata");
  return length;
}
