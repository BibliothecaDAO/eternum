import {
  completeNativeBatches,
  nativeExecutionOutcomes,
  requireNativeExecutionOutcome,
} from "../../../../../packages/provider/src/native-batch";
import { ec, hash, RpcProvider, WebSocketChannel } from "starknet";
import {
  encodeNativeCommand,
  frameNativeIntent,
  type NativeCommand,
} from "../../../../../packages/provider/src/native-command";
import { createNativeTicketSubmission } from "../../../../../packages/provider/src/native-ticket";
import { nativeDomainAbi } from "./manifest";
import type { NativeWorldManifest } from "./types";

const administrativeCommands = new Set<NativeCommand["kind"]>([
  "SettleBlitzRoster",
  "FundFaithPrizes",
  "DistributeFaithPrizes",
  "SetFaithBlacklist",
  "CreateBanks",
  "MarkGameSettled",
  "RecordBlitzResults",
]);

const repeatableBatches = new Set<NativeCommand["kind"]>([
  "SettleBlitzRoster",
  "DistributeFaithPrizes",
  "MarkGameSettled",
]);

type AdminCommandInput = {
  provider: RpcProvider;
  manifest: NativeWorldManifest;
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
  const receipt = await confirmedAdminReceipt(input, accepted.transaction_hash);
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

async function confirmedAdminReceipt(input: AdminCommandInput, transactionHash: string) {
  const channel = new WebSocketChannel({
    nodeUrl: input.admissionUrl.replace(/^http/, "ws"),
    autoReconnect: true,
  });
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Native command ${transactionHash} confirmation timed out`)), 120_000);
  });
  try {
    return await Promise.race([readConfirmedAdminReceipt(input.provider, channel, transactionHash), deadline]);
  } finally {
    clearTimeout(timer!);
    channel.disconnect();
  }
}

async function readConfirmedAdminReceipt(provider: RpcProvider, channel: WebSocketChannel, transactionHash: string) {
  await channel.waitForConnection();
  const subscription = await channel.subscribeTransactionStatus({ transactionHash });
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    let observedSocket: unknown;
    const observe = (status: { finality_status: string; failure_reason?: string }) => {
      if (finished) return;
      if (status.finality_status === "REJECTED") {
        finished = true;
        reject(new Error(`Native command ${transactionHash} rejected: ${status.failure_reason ?? "REJECTED"}`));
      } else if (["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(status.finality_status)) {
        finished = true;
        resolve();
      }
    };
    const catchUp = () => {
      if (finished || observedSocket === channel.websocket) return;
      observedSocket = channel.websocket;
      void provider.getTransactionStatus(transactionHash).then(observe, reject);
    };
    channel.on("open", catchUp);
    subscription.on(({ status }) => observe(status));
    catchUp();
  });
  const receipt = await provider.getTransactionReceipt(transactionHash);
  if (!("block_number" in receipt) || !Number.isSafeInteger(receipt.block_number))
    throw new Error(`Native command ${transactionHash} has no confirmed block`);
  if (receipt.execution_status !== "SUCCEEDED")
    throw new Error(`Native command ${transactionHash} transaction reverted`);
  return receipt;
}

async function submitAdminIntent(input: AdminCommandInput, intent: string[]) {
  const signature = ec.starkCurve.sign(hash.computePoseidonHashOnElements(intent), input.privateKey);
  const submit = createNativeTicketSubmission(input.admissionUrl);
  try {
    return await submit({
      intent,
      r: `0x${signature.r.toString(16)}`,
      s: `0x${signature.s.toString(16)}`,
      public_key: ec.starkCurve.getStarkKey(input.privateKey),
    });
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
  if (admission.length !== 6) throw new Error("Unexpected native admission view");
  const [, rules, , nonce, , timestamp] = admission;
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
