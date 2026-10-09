import { completeNativeBatches } from "../../../../../packages/provider/src/native-batch";
import { batchRemaining, gameplayRejection } from "../../../../../packages/provider/src/native-receipt";
import { encodeNativeCommand, type NativeCommand } from "../../../../../packages/provider/src/native-command";
import { executeGameplayAccountTransaction } from "../../../../../packages/core/src/client/submit";
import { CallData, RpcProvider } from "starknet";
import bindings from "../../../../../contracts/l3/world-native/schema/bindings.json";
import { createOperatorAccount } from "../../shared/madara-account";
import { confirmedTransactionReceipt } from "../../shared/transaction";
import { nativeGamesAbi } from "./manifest";
import type { RegistrarWorld } from "./types";

const administrativeCommands = new Set<NativeCommand["kind"]>([
  "SettleBlitzRoster",
  "CreateBanks",
  "MarkGameSettled",
  "RecordBlitzResults",
]);

const repeatableBatches = new Set<NativeCommand["kind"]>(["SettleBlitzRoster", "MarkGameSettled"]);

type AdminCommandInput = {
  provider: RpcProvider;
  manifest: RegistrarWorld;
  gameId: number;
  accountAddress: string;
  privateKey: string;
  command: NativeCommand;
};

export interface CompletedAdminCommand {
  transactionHash: string;
  remaining?: string;
  /** Transactions the command took to complete: one, or one per batch of a repeatable command. */
  transactions: number;
}

export async function completeNativeAdminCommand(input: AdminCommandInput): Promise<CompletedAdminCommand> {
  if (!repeatableBatches.has(input.command.kind))
    return { ...(await executeNativeAdminCommand(input)), transactions: 1 };
  let transactions = 0;
  const result = await completeNativeBatches(async () => {
    transactions += 1;
    const result = await executeNativeAdminCommand(input);
    if (result.remaining === undefined) throw new Error("Native administrative batch has no remaining count");
    return { ...result, remaining: BigInt(result.remaining) };
  });
  return { ...result, remaining: result.remaining.toString(), transactions };
}

export async function executeNativeAdminCommand(
  input: AdminCommandInput,
): Promise<{ transactionHash: string; remaining?: string }> {
  if (!administrativeCommands.has(input.command.kind)) throw new Error("Not an administrative command");
  if (!Number.isSafeInteger(input.gameId) || input.gameId <= 0) throw new Error("Native command requires a game id");
  const games = input.manifest.world.address;
  const shard = adminPlayShard(input.manifest);
  if (BigInt(await input.provider.getChainId()) !== BigInt(shard.chainId)) throw new Error("Admin RPC chain mismatch");
  const account = createOperatorAccount(input.provider, input.accountAddress, input.privateKey);
  const call = await buildAdminPlay(input);
  const accepted = await executeGameplayAccountTransaction({ account, calls: call, shard });
  const receipt = await confirmedTransactionReceipt(input.provider, accepted.transaction_hash);
  if (!("events" in receipt)) throw new Error("Native command receipt has no events");
  const scope = { gameId: input.gameId, actor: input.accountAddress };
  const rejection = gameplayRejection(receipt.events, games, accepted.transaction_hash, scope);
  if (rejection) throw new Error(`Native command rejected: ${rejection.statusClass}: ${rejection.reason}`);
  const remaining = batchRemaining(receipt.events, games, accepted.transaction_hash, scope)?.toString();
  if (
    (repeatableBatches.has(input.command.kind) || input.command.kind === "RecordBlitzResults") &&
    remaining === undefined
  )
    throw new Error("Native administrative batch has no remaining count");
  return { transactionHash: accepted.transaction_hash, ...(remaining !== undefined ? { remaining } : {}) };
}

function adminPlayShard(manifest: RegistrarWorld) {
  const bound = manifest.shard.l2GasBound;
  if (!bound || !/^0x[1-9a-f][0-9a-f]*$/.test(bound) || BigInt(bound) >= 2n ** 64n)
    throw new Error("Admin manifest requires canonical nonzero u64 l2GasBound");
  return { chainId: manifest.shard.chainId, l2GasBound: BigInt(bound) };
}

async function buildAdminPlay(input: AdminCommandInput) {
  const contractAddress = input.manifest.world.address;
  const read = (entrypoint: string, value: number | bigint) =>
    input.provider.callContract({ contractAddress, entrypoint, calldata: [String(value)] }, "pre_confirmed");
  const codec = new CallData(nativeGamesAbi(input.manifest));
  const [game, release] = await Promise.all([read("game", input.gameId), read("game_release", input.gameId)]);
  const registry = codec.parse("game", game) as { preset_id: bigint };
  const commitment = await read("preset_commitment", registry.preset_id);
  if (release.length !== 1 || commitment.length !== 1) throw new Error("Malformed admin release pins");
  const command = encodeNativeCommand(bindings.commandAbi, input.command);
  return {
    contractAddress,
    entrypoint: "play",
    calldata: [String(input.gameId), release[0]!, commitment[0]!, String(command.length), ...command],
  };
}
