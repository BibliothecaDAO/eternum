import { isSameStarknetAddress } from "@realms-world/identity";
import { RpcError, type ProviderInterface, type TypedData } from "starknet";

/**
 * A send whose outcome is unknown: signed and handed over, but its answer was lost (the sponsor's reply, or the receipt
 * read). Until it is known, nothing new is sent from that wallet, so the same transfer is never paid twice: a default
 * wallet's send keeps its signed execution, which can be submitted again and runs at most once (its outside nonce); a
 * connected wallet's keeps its transaction. Kept in this browser, so it survives a closed panel or a reload.
 */
export type UncertainSend =
  | {
      via: "passkey";
      owner: string;
      /** The calls it makes, as the panel asked them (JSON), to tell a retry of the same send from another one. */
      calls: string;
      execution: TypedData;
      ownerSignature: string[];
      hash: string | null;
      at: number;
    }
  | { via: "wallet"; owner: string; calls: string; hash: string; at: number };

/** Where an uncertain send stands: it ran, it never will (with why, if the chain says), or it may still. */
type SendStanding = { kind: "landed" } | { kind: "failed"; reason: string | null } | { kind: "pending" };

const KEY = "realms.uncertain-sends";
/** A connected wallet's transaction the chain has never heard of after this long was dropped. */
const DROPPED_MS = 60 * 60 * 1000;

const readAll = (): UncertainSend[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as UncertainSend[];
  } catch {
    return [];
  }
};
const writeAll = (sends: UncertainSend[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(sends));
  } catch {
    // A browser that keeps nothing loses the record on reload; the chain still runs the execution at most once.
  }
};

export const uncertainSendOf = (owner: string): UncertainSend | undefined =>
  readAll().find((send) => isSameStarknetAddress(send.owner, owner));

export const rememberUncertain = (send: UncertainSend) =>
  writeAll([...readAll().filter((other) => !isSameStarknetAddress(other.owner, send.owner)), send]);

export const forgetUncertain = (owner: string) =>
  writeAll(readAll().filter((send) => !isSameStarknetAddress(send.owner, owner)));

/** The chain's answer for an uncertain send. */
export const standingOf = async (provider: ProviderInterface, send: UncertainSend): Promise<SendStanding> =>
  send.via === "passkey" ? passkeyStanding(provider, send) : walletStanding(provider, send);

/**
 * A default wallet's execution ran if its nonce is spent (a revert leaves it unspent); unspent past its time window,
 * it never can; a receipt that reverted says why.
 */
const passkeyStanding = async (
  provider: ProviderInterface,
  send: Extract<UncertainSend, { via: "passkey" }>,
): Promise<SendStanding> => {
  const message = send.execution.message as { Nonce: string; "Execute Before": string | number };
  if (await nonceSpent(provider, send.owner, message.Nonce)) return { kind: "landed" };
  const reverted = send.hash ? await revertOf(provider, send.hash) : null;
  if (reverted !== null) return { kind: "failed", reason: reverted };
  const now = (await provider.getBlock("latest")).timestamp;
  return now >= Number(message["Execute Before"]) ? { kind: "failed", reason: null } : { kind: "pending" };
};

/** A connected wallet's transaction: its receipt, or nothing heard of it for an hour (dropped). */
const walletStanding = async (
  provider: ProviderInterface,
  send: Extract<UncertainSend, { via: "wallet" }>,
): Promise<SendStanding> => {
  try {
    const receipt = await provider.getTransactionReceipt(send.hash);
    return receipt.isSuccess() ? { kind: "landed" } : { kind: "failed", reason: reasonOf(receipt) };
  } catch (error) {
    if (!(error instanceof RpcError && error.isType("TXN_HASH_NOT_FOUND"))) throw error;
    return Date.now() - send.at > DROPPED_MS ? { kind: "failed", reason: null } : { kind: "pending" };
  }
};

/** `is_valid_outside_execution_nonce` is false once spent; a wallet not deployed yet has spent none. */
const nonceSpent = async (provider: ProviderInterface, wallet: string, nonce: string) => {
  try {
    const [valid] = await provider.callContract(
      { contractAddress: wallet, entrypoint: "is_valid_outside_execution_nonce", calldata: [nonce] },
      "latest",
    );
    return BigInt(valid!) === 0n;
  } catch (error) {
    if (error instanceof RpcError && error.isType("CONTRACT_NOT_FOUND")) return false;
    throw error;
  }
};

/** A transaction's revert reason if it reverted, null if it ran or is not known yet. */
const revertOf = async (provider: ProviderInterface, hash: string): Promise<string | null> => {
  try {
    const receipt = await provider.getTransactionReceipt(hash);
    return receipt.isReverted() ? (reasonOf(receipt) ?? "") : null;
  } catch (error) {
    if (error instanceof RpcError && error.isType("TXN_HASH_NOT_FOUND")) return null;
    throw error;
  }
};

const reasonOf = (receipt: object): string | null =>
  "revert_reason" in receipt && typeof receipt.revert_reason === "string" ? receipt.revert_reason : null;
