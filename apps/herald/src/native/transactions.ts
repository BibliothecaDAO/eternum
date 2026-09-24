import { hash } from "starknet";
import { decodeMembers } from "./serde";
import type { NativeManifest } from "./schema";

/** Receipt routing only. Authentication and game mutations are enforced by execution. */
export function transactionScopes(
  manifest: NativeManifest,
  calldata: string[] | undefined,
): { gameId: string; actor: string }[] {
  if (!calldata?.length) return [];
  const schema = manifest.native.schemas[manifest.native.activeSchema];
  const commands = schema.domains.season.entrypoints.filter((entry) =>
    entry.inputs.some((member) => member.name === "intent" || member.name === "actions"),
  );
  const scopes = new Map<string, { gameId: string; actor: string }>();
  for (const call of accountCalls(calldata)) {
    if (BigInt(call.address) !== BigInt(manifest.world.address)) continue;
    const command = commands.find((entry) => BigInt(call.selector) === BigInt(hash.getSelectorFromName(entry.name)));
    if (!command) continue;
    const decoded = decodeMembers(schema, command.inputs, call.calldata);
    const actions = command.name === "execute_batch" ? (decoded.actions as Record<string, unknown>[]) : [decoded];
    for (const action of actions) {
      const intent = action.intent as Record<string, bigint>;
      const scope = { gameId: String(BigInt(intent.game_id)), actor: String(BigInt(intent.actor)) };
      scopes.set(`${scope.gameId}:${scope.actor}`, scope);
    }
  }
  return [...scopes.values()];
}

function accountCalls(calldata: string[]) {
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
