import { VALUE_WORDS } from "@/ui/design-system/kit/words";
import { isSameStarknetAddress, type DefaultWallet } from "@realms-world/identity";
import {
  CallData,
  shortString,
  typedData,
  type AccountInterface,
  type Call,
  type ProviderInterface,
  type TypedData,
} from "starknet";

import { identityClient } from "@/hooks/context/identity-session";
import { IdentityRequestError } from "@realms-world/identity";
import { L2_CHAIN } from "@/runtime/l2-rpc";

import { callsMatch, WALLET_GAS_TOKEN, type AskedCall } from "@realms-world/identity/wallet";

import { signWithPasskey } from "./passkey";
import { forgetUncertain, rememberUncertain, type SignedPasskeySend } from "./uncertain-sends";

/**
 * What a wallet's send came to: landed, refused by the ledger with its reason, not sent for lack of STRK, unconfirmed:
 * handed over with its answer lost, kept as an uncertain send (uncertain-sends.ts) until the chain says, or abandoned:
 * its panel closed before the wallet was asked, so nothing was asked or sent.
 */
export type WalletSendOutcome =
  | { kind: "landed" }
  | { kind: "refused"; reason: string }
  | { kind: "no-strk" }
  | { kind: "unconfirmed" }
  | { kind: "abandoned" };

/** The connected wallet is not the one the call must come from. */
export class WrongWalletError extends Error {
  constructor(readonly owner: string) {
    super("wrong_wallet");
  }
}

/**
 * The one send every value screen makes, so none improvises its own outcome: from `owner` only; after its STRK is read
 * and the call priced (too little for the fee: not sent, the swap is offered instead); `onSigned` once the wallet has
 * sent it; then held until its receipt lands, a revert answered with the ledger's own reason. `closed` is its panel's:
 * a panel closed while the send was priced asks no wallet.
 */
export const sendFromWallet = async (
  account: AccountInterface,
  owner: string,
  calls: Call[],
  provider: ProviderInterface,
  onSigned: () => void,
  closed: AbortSignal,
): Promise<WalletSendOutcome> => {
  if (!isSameStarknetAddress(account.address, owner)) throw new WrongWalletError(owner);
  const gas = await feeBalanceOf(provider, account.address);
  if (gas === 0n) return { kind: "no-strk" };
  // Priced before the wallet opens: a call the chain would revert is refused with its reason, and a fee above the
  // wallet's STRK offers the swap; nothing has been sent, so nothing is kept.
  let fee: bigint;
  try {
    fee = BigInt((await account.estimateInvokeFee(calls)).overall_fee);
  } catch (error) {
    return { kind: "refused", reason: error instanceof Error ? error.message : VALUE_WORDS.refused };
  }
  if (gas < fee) return { kind: "no-strk" };
  if (closed.aborted) return { kind: "abandoned" };
  // Kept before the wallet opens: nothing is sent if this browser cannot keep it.
  const intent = { via: "wallet", owner, calls: JSON.stringify(calls), hash: null, at: Date.now() } as const;
  rememberUncertain(intent);
  let sent: string;
  try {
    ({ transaction_hash: sent } = await account.execute(calls));
  } catch (error) {
    // Only the wallet's own refusal proves nothing went; a lost answer may have been sent, and stays uncertain.
    if (!isWalletRefusal(error)) return { kind: "unconfirmed" };
    forgetUncertain(owner);
    throw error;
  }
  rememberUncertain({ ...intent, hash: sent });
  onSigned();
  return settled(owner, await landedOrRefused(provider, sent));
};

/** The paymaster built something other than these calls on this chain, or a fee over the one shown: nothing is signed. */
export class UnexpectedExecutionError extends Error {
  constructor() {
    super("unexpected_execution");
  }
}

/** A default wallet's network fee, in LORDS wei (WALLET_GAS_TOKEN): about `estimated`, never more than `max`. */
export interface WalletFee {
  estimated: bigint;
  max: bigint;
}

/** A default wallet's execution ready for its passkey, with the fee it pays itself (none for a sponsored step). */
export interface PreparedSend {
  execution: TypedData;
  fee: WalletFee | null;
}

/**
 * The same send from the account's default wallet, in two steps. Prepare: the paymaster builds the outside execution
 * and this page checks it is exactly `calls` on this chain, then at most one fee call paying no more than the max it
 * shows (nothing is spent). Send, on the player's tap: their passkey signs its hash and the paymaster submits it with
 * the guardian's signature (apps/realms/server/default-wallet-plugin.ts). The wallet pays its fee in LORDS, so no STRK
 * is read. The tap opens the passkey at once, as Safari requires, with no request before it; unless its panel closed
 * (`closed`) while a stale preparation was built again, when nothing is asked.
 */
export const prepareDefaultWalletSend = async (calls: Call[]): Promise<PreparedSend> => {
  const requested = calls.map((call) => ({
    contractAddress: call.contractAddress,
    entrypoint: call.entrypoint,
    calldata: CallData.toHex(call.calldata ?? []),
  }));
  const built = await identityClient.buildDefaultWalletCall(requested);
  const execution = built.typedData as unknown as TypedData;
  const fee = built.fee && { estimated: BigInt(built.fee.estimated), max: BigInt(built.fee.max) };
  if (!buildsExactly(execution, requested, fee)) throw new UnexpectedExecutionError();
  return { execution, fee };
};

export const sendFromDefaultWallet = async (
  wallet: DefaultWallet,
  prepared: TypedData,
  calls: string,
  provider: ProviderInterface,
  onSigned: () => void,
  closed: AbortSignal,
): Promise<WalletSendOutcome> => {
  // Its panel closed while the send was prepared again: no passkey opens for a payment no one is looking at.
  if (closed.aborted) return { kind: "abandoned" };
  // Kept before the passkey opens: its signature can come back after the panel closed, and is then still sent.
  const asked = {
    via: "passkey",
    owner: wallet.address,
    calls,
    execution: prepared,
    ownerSignature: null,
    hash: null,
    at: Date.now(),
  } as const;
  rememberUncertain(asked);
  let ownerSignature: string[];
  try {
    ownerSignature = await signWithPasskey(wallet, typedData.getMessageHash(prepared, wallet.address));
  } catch (error) {
    // No signature, nothing that can be sent.
    forgetUncertain(wallet.address);
    throw error;
  }
  return submitSigned({ ...asked, ownerSignature }, provider, onSigned, "first");
};

/**
 * Submits a default wallet's signed execution, the first time or again after its answer was lost. It is kept as
 * uncertain before it leaves (nothing leaves if this browser cannot keep it), forgotten once its receipt lands, and
 * kept while its outcome is unknown. A refusal settles only a first submission: a resubmission's refusal says nothing
 * of the earlier one, which may still have run, so it stays uncertain for the chain to settle.
 */
export const submitSigned = async (
  send: SignedPasskeySend,
  provider: ProviderInterface,
  onSigned: () => void,
  submission: "first" | "again",
): Promise<WalletSendOutcome> => {
  rememberUncertain(send);
  let sent: string;
  try {
    sent = await identityClient.executeDefaultWalletCall(
      send.execution as unknown as Record<string, unknown>,
      send.ownerSignature,
    );
  } catch (error) {
    if (!isProvenNotSent(error)) return { kind: "unconfirmed" };
    if (submission === "first") forgetUncertain(send.owner);
    throw error;
  }
  rememberUncertain({ ...send, hash: sent });
  onSigned();
  return settled(send.owner, await landedOrRefused(provider, sent));
};

/**
 * A wallet's own refusal, given before it sends anything: the wallet API's USER_REFUSED_OP (code 113), starknet-react's
 * UserRejectedRequestError, or Ready's extension's "User abort". Any other failure may follow a broadcast.
 */
const isWalletRefusal = (error: unknown) => {
  const { code, name, message } = (error ?? {}) as { code?: unknown; name?: unknown; message?: unknown };
  return code === 113 || name === "UserRejectedRequestError" || message === "User abort";
};

/**
 * The identity Worker answered that nothing reached the chain: a refusal before the paymaster (4xx) or the paymaster's
 * own (PAYMASTER_REFUSED). A lost answer, SEND_UNCERTAIN or any other failure may have been sent.
 */
const isProvenNotSent = (error: unknown) =>
  error instanceof IdentityRequestError && (error.status < 500 || error.code === "PAYMASTER_REFUSED");

/** A known outcome ends the uncertain send; an unconfirmed one keeps it. */
const settled = (owner: string, outcome: WalletSendOutcome) => {
  if (outcome.kind !== "unconfirmed") forgetUncertain(owner);
  return outcome;
};

/**
 * An outside execution (SNIP-9 v2) on this build's chain whose calls are exactly these, then, when the wallet pays, its
 * fee to the execution's caller (the paymaster's forwarder) within the max shown (callsMatch, the one rule).
 */
const buildsExactly = (built: TypedData, calls: AskedCall[], fee: WalletFee | null) => {
  const message = built.message as { Caller?: string; Calls?: { To: string; Selector: string; Calldata: string[] }[] };
  const domain = built.domain as { name?: string; version?: unknown; chainId?: unknown };
  const chainId = typeof domain.chainId === "string" ? domain.chainId : "";
  const onThisChain =
    BigInt(/^0x/.test(chainId) ? chainId : shortString.encodeShortString(chainId || "0")) === BigInt(L2_CHAIN.id);
  return (
    built.primaryType === "OutsideExecution" &&
    domain.name === "Account.execute_from_outside" &&
    String(domain.version) === "2" &&
    onThisChain &&
    Array.isArray(message.Calls) &&
    callsMatch(
      message.Calls.map((call) => ({ to: call.To, selector: call.Selector, calldata: call.Calldata })),
      calls,
      fee && { token: WALLET_GAS_TOKEN, payee: String(message.Caller), max: fee.max },
    )
  );
};

/** Held until the transaction's receipt lands: a revert answered with the ledger's own reason. */
/** Held until the receipt lands; a lost receipt read is unconfirmed, never refused, so nothing is sent again. */
const landedOrRefused = async (provider: ProviderInterface, sent: string): Promise<WalletSendOutcome> => {
  try {
    const receipt = await provider.waitForTransaction(sent, { retryInterval: RECEIPT_POLL_MS });
    return receipt.isReverted() ? { kind: "refused", reason: refusalOf(receipt) } : { kind: "landed" };
  } catch (error) {
    console.error("l2_send_unconfirmed", { hash: sent, error: error instanceof Error ? error.message : error });
    return { kind: "unconfirmed" };
  }
};

/**
 * How often a sent call's receipt is asked for: under a Starknet block (about 1.7 s on mainnet), so a landed call shows
 * within a second rather than starknet.js's default 5 s.
 */
const RECEIPT_POLL_MS = 1_000;

/** The wallet's STRK, the token the network fee is paid in on the build's L2. */
const feeBalanceOf = async (provider: ProviderInterface, owner: string): Promise<bigint> => {
  const [low, high] = await provider.callContract({
    contractAddress: L2_CHAIN.gasToken,
    entrypoint: "balance_of",
    calldata: [owner],
  });
  return BigInt(low) + (BigInt(high) << 128n);
};

/** The ledger's assertion inside a revert trace ("Ledger: already registered"), or the trace's first line. */
const refusalOf = (receipt: object): string => {
  const trace = "revert_reason" in receipt && typeof receipt.revert_reason === "string" ? receipt.revert_reason : "";
  return trace.match(/Ledger: [^'"\\\n]+/)?.[0] ?? (trace.split("\n")[0] || VALUE_WORDS.refused);
};
