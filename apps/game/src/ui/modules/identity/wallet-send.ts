import { VALUE_WORDS } from "@/ui/design-system/kit/words";
import { isSameStarknetAddress, type DefaultWallet } from "@realms-world/identity";
import {
  CallData,
  hash,
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

import { signWithPasskey } from "./passkey";
import { forgetUncertain, rememberUncertain, type UncertainSend } from "./uncertain-sends";

/**
 * What a wallet's send came to: landed, refused by the ledger with its reason, not sent for lack of STRK, or unconfirmed:
 * handed over with its answer lost, kept as an uncertain send (uncertain-sends.ts) until the chain says.
 */
export type WalletSendOutcome =
  | { kind: "landed" }
  | { kind: "refused"; reason: string }
  | { kind: "no-strk" }
  | { kind: "unconfirmed" };

/** The connected wallet is not the one the call must come from. */
export class WrongWalletError extends Error {
  constructor(readonly owner: string) {
    super("wrong_wallet");
  }
}

/**
 * The one send every value screen makes, so none improvises its own outcome: from `owner` only; after one read of its
 * STRK for the network fee (none: not sent, the swap is offered instead); `onSigned` once the wallet has sent it; then
 * held until its receipt lands, a revert answered with the ledger's own reason.
 */
export const sendFromWallet = async (
  account: AccountInterface,
  owner: string,
  calls: Call[],
  provider: ProviderInterface,
  onSigned: () => void,
): Promise<WalletSendOutcome> => {
  if (!isSameStarknetAddress(account.address, owner)) throw new WrongWalletError(owner);
  if ((await feeBalanceOf(provider, account.address)) === 0n) return { kind: "no-strk" };
  const { transaction_hash: sent } = await account.execute(calls);
  rememberUncertain({ via: "wallet", owner, calls: JSON.stringify(calls), hash: sent, at: Date.now() });
  onSigned();
  return settled(owner, await landedOrRefused(provider, sent));
};

/** The sponsor built something other than these calls on this chain: nothing is signed. */
export class UnexpectedExecutionError extends Error {
  constructor() {
    super("unexpected_execution");
  }
}

/**
 * The same send from the account's default wallet, in two steps. Prepare: the sponsor builds the outside execution and
 * this page checks it is exactly `calls` on this chain (nothing is spent). Send, on the player's tap: their passkey
 * signs its hash and the sponsor submits it with the guardian's signature (apps/realms/server/default-wallet-plugin.ts).
 * No STRK is read: the sponsor pays. The tap opens the passkey at once, as Safari requires, with no request before it.
 */
export const prepareDefaultWalletSend = async (calls: Call[]): Promise<TypedData> => {
  const requested = calls.map((call) => ({
    contractAddress: call.contractAddress,
    entrypoint: call.entrypoint,
    calldata: CallData.toHex(call.calldata ?? []),
  }));
  const built = (await identityClient.buildDefaultWalletCall(requested)) as unknown as TypedData;
  if (!buildsExactly(built, requested)) throw new UnexpectedExecutionError();
  return built;
};

export const sendFromDefaultWallet = async (
  wallet: DefaultWallet,
  prepared: TypedData,
  calls: string,
  provider: ProviderInterface,
  onSigned: () => void,
): Promise<WalletSendOutcome> => {
  const ownerSignature = await signWithPasskey(wallet, typedData.getMessageHash(prepared, wallet.address));
  const send = {
    via: "passkey",
    owner: wallet.address,
    calls,
    execution: prepared,
    ownerSignature,
    hash: null,
    at: Date.now(),
  } as const;
  return submitSigned(send, provider, onSigned);
};

/**
 * Submits a default wallet's signed execution, the first time or again after its answer was lost: kept as uncertain
 * before it leaves, forgotten once the sponsor refuses it or its receipt lands, kept while its outcome is unknown.
 */
export const submitSigned = async (
  send: Extract<UncertainSend, { via: "passkey" }>,
  provider: ProviderInterface,
  onSigned: () => void,
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
    forgetUncertain(send.owner);
    throw error;
  }
  rememberUncertain({ ...send, hash: sent });
  onSigned();
  return settled(send.owner, await landedOrRefused(provider, sent));
};

/**
 * The identity Worker answered that nothing reached the chain: a refusal before the sponsor (4xx) or the sponsor's own
 * (SPONSOR_REFUSED). A lost answer, SEND_UNCERTAIN or any other failure may have been sent.
 */
const isProvenNotSent = (error: unknown) =>
  error instanceof IdentityRequestError && (error.status < 500 || error.code === "SPONSOR_REFUSED");

/** A known outcome ends the uncertain send; an unconfirmed one keeps it. */
const settled = (owner: string, outcome: WalletSendOutcome) => {
  if (outcome.kind !== "unconfirmed") forgetUncertain(owner);
  return outcome;
};

/** An outside execution (SNIP-9 v2) on this build's chain whose calls are exactly these, in order. */
const buildsExactly = (
  built: TypedData,
  calls: { contractAddress: string; entrypoint: string; calldata: string[] }[],
) => {
  const message = built.message as { Calls?: { To: string; Selector: string; Calldata: string[] }[] };
  const domain = built.domain as { name?: string; version?: unknown; chainId?: unknown };
  const chainId = typeof domain.chainId === "string" ? domain.chainId : "";
  const onThisChain =
    BigInt(/^0x/.test(chainId) ? chainId : shortString.encodeShortString(chainId || "0")) === BigInt(L2_CHAIN.id);
  const same = (a: string, b: string) => BigInt(a) === BigInt(b);
  return (
    built.primaryType === "OutsideExecution" &&
    domain.name === "Account.execute_from_outside" &&
    String(domain.version) === "2" &&
    onThisChain &&
    message.Calls?.length === calls.length &&
    message.Calls.every((call, index) => {
      const asked = calls[index]!;
      return (
        same(call.To, asked.contractAddress) &&
        same(call.Selector, hash.getSelectorFromName(asked.entrypoint)) &&
        call.Calldata.length === asked.calldata.length &&
        call.Calldata.every((felt, at) => same(felt, asked.calldata[at]!))
      );
    })
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
