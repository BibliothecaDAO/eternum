import {
  completeNativeBatches,
  nativeExecutionOutcomes,
  requireNativeExecutionOutcome,
} from "../../../../../packages/provider/src/native-batch";
import { hash, RpcProvider } from "starknet";
import {
  encodeNativeCommand,
  frameNativeIntent,
  type NativeCommand,
} from "../../../../../packages/provider/src/native-command";
import { createNativeTicketSubmission, signGameplayIntent } from "../../../../../packages/provider/src/native-ticket";
import { nativeDomainAbi } from "./manifest";
import { confirmedTransactionReceipt } from "../../shared/transaction";
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
  admissionUrl: string;
  gameId: number;
  accountAddress: string;
  privateKey: string;
  command: NativeCommand;
};

export async function completeNativeAdminCommand(input: AdminCommandInput) {
  if (!repeatableBatches.has(input.command.kind)) return executeNativeAdminCommand(input);
  const result = await completeNativeBatches(async () => {
    const result = await executeNativeAdminCommand(input);
    if (result.remaining === undefined) throw new Error("Native administrative batch has no remaining count");
    return { ...result, remaining: BigInt(result.remaining) };
  });
  return { ...result, remaining: result.remaining.toString() };
}

export async function executeNativeAdminCommand(
  input: AdminCommandInput,
): Promise<{ transactionHash: string; remaining?: string }> {
  if (!administrativeCommands.has(input.command.kind)) throw new Error("Not an administrative command");
  if (!Number.isSafeInteger(input.gameId) || input.gameId <= 0) throw new Error("Native command requires a game id");
  const season = input.manifest.native.domains.season.address;
  const { intent, nonce } = await buildAdminIntent(input, season);
  const accepted = await submitAdminIntent(input, intent);
  const receipt = await confirmedTransactionReceipt(input.provider, accepted.transaction_hash);
  if (!("events" in receipt)) throw new Error("Native command receipt has no events");
  const outcome = requireNativeExecutionOutcome(nativeExecutionOutcomes(receipt.events, season), {
    gameId: String(input.gameId),
    actor: input.accountAddress,
    nonce: nonce.toString(),
    order: accepted.order.toString(),
  });
  if (outcome.status === "REVERTED") throw new Error(`Native command rejected: ${outcome.reason}`);
  const remaining = outcome.batchRemaining;
  if (
    (repeatableBatches.has(input.command.kind) || input.command.kind === "RecordBlitzResults") &&
    remaining === undefined
  )
    throw new Error("Native administrative batch has no remaining count");
  return { transactionHash: accepted.transaction_hash, ...(remaining !== undefined ? { remaining } : {}) };
}

async function submitAdminIntent(input: AdminCommandInput, intent: string[]) {
  const signature = signGameplayIntent(hash.computePoseidonHashOnElements(intent), input.privateKey);
  const submit = createNativeTicketSubmission(input.admissionUrl);
  try {
    return await submit({ intent, signature });
  } finally {
    submit.dispose();
  }
}

async function buildAdminIntent(input: AdminCommandInput, season: string) {
  const [chain, admission] = await Promise.all([
    input.provider.getChainId(),
    input.provider.callContract(
      { contractAddress: season, entrypoint: "get_admission", calldata: [input.gameId, input.accountAddress] },
      "pre_confirmed",
    ),
  ]);
  if (admission.length !== 5) throw new Error("Unexpected native admission view");
  const [rules, , nonce, , timestamp] = admission;
  const intent = frameNativeIntent({
    chain,
    deployment: season,
    gameId: input.gameId,
    actor: input.accountAddress,
    nonce,
    rules,
    validFrom: 0,
    validUntil: BigInt(timestamp) + 300n,
    lastOrder: 0xffffffffffffffffn,
    arguments: encodeNativeCommand(nativeDomainAbi(input.manifest, "season"), input.command),
  });
  return { intent, nonce: BigInt(nonce) };
}
