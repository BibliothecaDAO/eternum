import { hash, typedData, type TypedData } from "starknet";

const AUTH_CHALLENGE_LIFETIME_MS = 5 * 60 * 1_000;
const SNIP6_VALID = BigInt("0x56414c4944");

export type BlitzAuthAction = "create-launch-quote" | "create-game-stack";

export interface BlitzAuthChallenge {
  schemaVersion: 1;
  challengeId: string;
  requesterWallet: string;
  action: BlitzAuthAction;
  payload: Record<string, unknown>;
  payloadHash: string;
  messageHash: string;
  issuedAt: string;
  expiresAt: string;
  typedData: TypedData;
}

export interface CreateBlitzAuthChallengeRequest {
  challengeId: string;
  requesterWallet: string;
  action: BlitzAuthAction;
  payload: Record<string, unknown>;
  now?: Date;
}

export interface VerifyCartridgeWalletSignatureRequest {
  rpcUrl: string;
  requesterWallet: string;
  messageHash: string;
  signature: string[];
  fetchImpl?: typeof fetch;
}

export function createBlitzAuthChallenge(request: CreateBlitzAuthChallengeRequest): BlitzAuthChallenge {
  const issuedAt = request.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + AUTH_CHALLENGE_LIFETIME_MS);
  const payloadHash = toFelt(hash.starknetKeccak(serializeCanonicalJson(request.payload)));
  const challengeTypedData = buildChallengeTypedData({
    challengeId: request.challengeId,
    requesterWallet: request.requesterWallet,
    action: request.action,
    payloadHash,
    expiresAt,
  });

  return {
    schemaVersion: 1,
    challengeId: request.challengeId,
    requesterWallet: request.requesterWallet,
    action: request.action,
    payload: request.payload,
    payloadHash,
    messageHash: typedData.getMessageHash(challengeTypedData, request.requesterWallet),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    typedData: challengeTypedData,
  };
}

export async function verifyCartridgeWalletSignature(request: VerifyCartridgeWalletSignatureRequest): Promise<boolean> {
  const fetchImpl = request.fetchImpl ?? fetch;
  const response = await fetchImpl(request.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "starknet_call",
      params: {
        request: {
          contract_address: toFelt(request.requesterWallet),
          entry_point_selector: hash.getSelectorFromName("is_valid_signature"),
          calldata: [toFelt(request.messageHash), toFelt(request.signature.length), ...request.signature.map(toFelt)],
        },
        block_id: "latest",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Controller signature verification RPC failed with HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { error?: { message?: string }; result?: string[] };
  if (payload.error) {
    throw new Error(`Controller signature verification RPC failed: ${payload.error.message || "unknown RPC error"}`);
  }
  const validationResult = payload.result?.[0];
  return validationResult !== undefined && BigInt(validationResult) === SNIP6_VALID;
}

function buildChallengeTypedData(input: {
  challengeId: string;
  requesterWallet: string;
  action: BlitzAuthAction;
  payloadHash: string;
  expiresAt: Date;
}): TypedData {
  return {
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      EternumBlitzLaunch: [
        { name: "action", type: "shortstring" },
        { name: "challenge_id", type: "felt" },
        { name: "requester_wallet", type: "ContractAddress" },
        { name: "payload_hash", type: "felt" },
        { name: "expires_at", type: "timestamp" },
      ],
    },
    primaryType: "EternumBlitzLaunch",
    domain: {
      name: "Eternum Blitz Launch",
      version: "1",
      chainId: "SN_MAIN",
      revision: "1",
    },
    message: {
      action: input.action,
      challenge_id: toFelt(input.challengeId),
      requester_wallet: toFelt(input.requesterWallet),
      payload_hash: input.payloadHash,
      expires_at: Math.floor(input.expiresAt.getTime() / 1_000),
    },
  };
}

function serializeCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${serializeCanonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function toFelt(value: string | number | bigint): string {
  return `0x${BigInt(value).toString(16)}`;
}
