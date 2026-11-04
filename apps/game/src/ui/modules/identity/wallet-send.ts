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
import { L2_CHAIN } from "@/runtime/l2-rpc";

import { signWithPasskey } from "./passkey";

/** What a wallet's send came to: landed, refused by the ledger with its reason, or not sent for lack of STRK. */
export type WalletSendOutcome = { kind: "landed" } | { kind: "refused"; reason: string } | { kind: "no-strk" };

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
  onSigned();
  return landedOrRefused(provider, sent);
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
  provider: ProviderInterface,
  onSigned: () => void,
): Promise<WalletSendOutcome> => {
  const ownerSignature = await signWithPasskey(wallet, typedData.getMessageHash(prepared, wallet.address));
  const sent = await identityClient.executeDefaultWalletCall(
    prepared as unknown as Record<string, unknown>,
    ownerSignature,
  );
  onSigned();
  return landedOrRefused(provider, sent);
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
const landedOrRefused = async (provider: ProviderInterface, sent: string): Promise<WalletSendOutcome> => {
  try {
    const receipt = await provider.waitForTransaction(sent, { retryInterval: RECEIPT_POLL_MS });
    return receipt.isReverted() ? { kind: "refused", reason: refusalOf(receipt) } : { kind: "landed" };
  } catch (error) {
    console.error("l2_send_unconfirmed", { hash: sent, error: error instanceof Error ? error.message : error });
    return { kind: "refused", reason: VALUE_WORDS.unconfirmed };
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
