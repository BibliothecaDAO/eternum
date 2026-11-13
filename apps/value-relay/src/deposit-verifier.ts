import {
  readDepositEvidence,
  depositDestinationError,
  depositIdentityError,
  type DepositEvidence,
} from "./deposit-destination";
import {
  depositReader,
  depositCommitment,
  deliveryHash,
  resolutionHash,
  principalHash,
  type DepositSigningRequest,
  type LordsDeposit,
  type DepositAnchors,
} from "@realms-world/value-ledger/deposits";
import { type CosigningDomain } from "@realms-world/value-ledger";
import { type ShardConnection } from "./shard-rpc";
import { singleRow } from "./shard-snapshot";

export interface DepositVerification {
  domain: CosigningDomain;
  payoutIdentity?: (account: string, wallet: string) => Promise<string>;
  anchors?: DepositAnchors;
  publicKey: string;
  ledger: Omit<Awaited<ReturnType<typeof depositReader>>, "final">;
  shard: ShardConnection & { heraldUrl: string };
}

/** All sources belong to the independent signer's configuration; a request can name identities, never a digest. */
export async function verifiedDepositHash(
  context: DepositVerification,
  request: DepositSigningRequest,
): Promise<string> {
  const { domain, ledger, shard } = context;
  const target = await ledger.read("deposit_target", [request.shard, String(request.season)]);
  if (target.length !== 1 || BigInt(target[0]!) !== BigInt(shard.gamesAddress))
    throw new Error("deposit_target_differs");
  const evidence = await readDepositEvidence(shard, request.season, context.anchors);
  const { snapshot, read } = evidence;
  const verified = async (digest: string) => {
    await evidence.remember();
    await ledger.assertCanonical();
    return digest;
  };
  const source = singleRow(snapshot, "DepositSource");
  if (
    BigInt(String(source.chain)) !== BigInt(domain.chainId) ||
    BigInt(String(source.ledger)) !== BigInt(domain.ledger) ||
    BigInt(String(source.signer)) !== BigInt(context.publicKey) ||
    Number(source.epoch) !== domain.epoch
  )
    throw new Error("deposit_source_differs");
  if (request.kind === "principal") {
    await verifyPrincipalSweep(context, evidence, request);
    return verified(principalHash(domain, shard.gamesAddress, request));
  }
  const deposit = await ledger.deposit(request.shard, request.id);
  if (deposit.gameId !== request.season || BigInt(deposit.games) !== BigInt(shard.gamesAddress))
    throw new Error("deposit_receipt_target_differs");
  const commitment = depositCommitment(domain, deposit);
  if (request.kind === "resolve-deposit") {
    const receipt = await read("deposit_receipt", [String(request.season), request.id]);
    const cancelled = verifyDepositResolution(receipt, commitment, deposit);
    return verified(resolutionHash(domain, commitment, cancelled));
  }
  if (deposit.status !== "pending") throw new Error("deposit_already_resolved");
  if (!request.cancel) {
    const error = await depositDestinationError(evidence, deposit);
    if (error) throw new Error(error);
  }
  return verified(deliveryHash(commitment, domain.epoch, request.cancel));
}

export function verifyDepositResolution(fields: readonly string[], commitment: string, deposit: LordsDeposit): boolean {
  if (
    fields.length !== 5 ||
    BigInt(fields[0]!) !== 0n ||
    BigInt(fields[1]!) !== BigInt(commitment) ||
    BigInt(fields[2]!) !== BigInt(deposit.account) ||
    BigInt(fields[3]!) !== BigInt(deposit.amount) ||
    ![0n, 1n].includes(BigInt(fields[4]!))
  )
    throw new Error("deposit_resolution_unconfirmed");
  return BigInt(fields[4]!) === 1n;
}

async function verifyPrincipalSweep(
  context: DepositVerification,
  evidence: DepositEvidence,
  request: Extract<DepositSigningRequest, { kind: "principal" }>,
) {
  if (!context.payoutIdentity) throw new Error("principal_wallet_verification_required");
  const realmsId = await context.payoutIdentity(request.account, request.wallet);
  const identityError = await depositIdentityError(evidence, { account: request.account, realmsId });
  if (identityError) throw new Error(identityError);
  const receipt = await evidence.read("principal_withdrawal", [String(request.season), request.account]);
  const balance = await evidence.read("spend_lords", [String(request.season), request.account]);
  const game = singleRow(evidence.snapshot, "GameRegistry");
  if (
    evidence.head.time < Number(game.end_at) ||
    receipt.length !== 2 ||
    BigInt(receipt[0]!) !== 0n ||
    BigInt(receipt[1]!) !== BigInt(request.amount) ||
    balance.length !== 3 ||
    BigInt(balance[0]!) !== 0n ||
    BigInt(balance[2]!) !== BigInt(request.amount)
  )
    throw new Error("principal_sweep_unconfirmed");
}
