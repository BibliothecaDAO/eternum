import { ec, hash, RpcProvider, type GetTransactionReceiptResponse } from "starknet";
import {
  encodeNativeCommand,
  frameNativeIntent,
  type NativeCommand,
} from "../../../../../packages/provider/src/native-command";
import { createNativeTicketSubmission } from "../../../../../packages/provider/src/native-ticket";
import { nativeDomainAbi } from "./manifest";
import type { NativeWorldManifest } from "./types";

const administrativeCommands = new Set<NativeCommand["kind"]>([
  "FundFaithPrizes",
  "DistributeFaithPrizes",
  "SetFaithBlacklist",
  "CreateBanks",
  "MarkGameSettled",
  "ReserveHyperstructures",
  "RankPlayers",
  "ResetRanking",
  "AllocateGameChests",
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

export async function executeNativeAdminCommand(input: AdminCommandInput): Promise<string> {
  if (!administrativeCommands.has(input.command.kind)) throw new Error("Not an administrative command");
  if (!Number.isSafeInteger(input.gameId) || input.gameId <= 0) throw new Error("Native command requires a game id");
  const season = input.manifest.native.domains.season.address;
  const { intent, nonce } = await buildAdminIntent(input, season);
  const signature = ec.starkCurve.sign(hash.computePoseidonHashOnElements(intent), input.privateKey);
  const accepted = await createNativeTicketSubmission(input.admissionUrl)({
    intent,
    r: `0x${signature.r.toString(16)}`,
    s: `0x${signature.s.toString(16)}`,
    public_key: ec.starkCurve.getStarkKey(input.privateKey),
  });
  const receipt = await input.provider.waitForTransaction(accepted.transaction_hash);
  assertCommandOutcome(receipt, season, input.gameId, input.accountAddress, nonce, accepted.order);
  return accepted.transaction_hash;
}

async function buildAdminIntent(input: AdminCommandInput, season: string) {
  const [chain, admission] = await Promise.all([
    input.provider.getChainId(),
    input.provider.callContract(
      { contractAddress: season, entrypoint: "get_admission", calldata: [input.gameId, input.accountAddress] },
      "pre_confirmed",
    ),
  ]);
  if (admission.length !== 7) throw new Error("Unexpected native admission view");
  const [, rules, , nonce, , , timestamp] = admission;
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

function assertCommandOutcome(
  receipt: GetTransactionReceiptResponse,
  season: string,
  gameId: number,
  actor: string,
  nonce: bigint,
  order: bigint,
): void {
  if (!("events" in receipt)) throw new Error("Native command receipt has no events");
  const selector = BigInt(hash.getSelectorFromName("ExecutionRecorded"));
  const outcomes = receipt.events.filter(
    (event) =>
      BigInt(event.from_address) === BigInt(season) && event.keys.length > 0 && BigInt(event.keys.at(-1)!) === selector,
  );
  const outcome = outcomes[0]?.data;
  if (
    outcomes.length !== 1 ||
    !outcome ||
    outcome.length !== 7 ||
    BigInt(outcome[0]) !== BigInt(gameId) ||
    BigInt(outcome[1]) !== BigInt(actor) ||
    BigInt(outcome[2]) !== nonce ||
    BigInt(outcome[4]) !== order
  )
    throw new Error("Native command receipt does not match its accepted ticket");
  if (BigInt(outcome[5]) !== 1n) throw new Error(`Native command rejected: ${outcome[6]}`);
}
