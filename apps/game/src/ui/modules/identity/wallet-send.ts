import { VALUE_WORDS } from "@/ui/design-system/kit/words";
import { isSameStarknetAddress } from "@realms-world/identity";
import type { AccountInterface, Call, ProviderInterface } from "starknet";

import { L2_CHAIN } from "@/runtime/l2-rpc";

/** What a wallet's send came to: landed, refused by the ledger with its reason, or not sent for lack of STRK. */
export type WalletSendOutcome =
  | { kind: "landed" }
  | { kind: "refused"; reason: string }
  | { kind: "no-strk" }
  | { kind: "uncertain"; reason: string };

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
  try {
    const gas = await feeBalanceOf(provider, account.address);
    if (gas === 0n) return { kind: "no-strk" };
    const estimate = await account.estimateInvokeFee(calls);
    if (gas < BigInt(estimate.overall_fee)) return { kind: "no-strk" };
  } catch (error) {
    return { kind: "refused", reason: error instanceof Error ? error.message : VALUE_WORDS.refused };
  }
  let hash: string;
  try {
    hash = (await account.execute(calls)).transaction_hash;
  } catch (error) {
    if (isWalletRefusal(error)) return { kind: "refused", reason: "Payment rejected in wallet." };
    return { kind: "uncertain", reason: VALUE_WORDS.unconfirmed };
  }
  onSigned();
  try {
    const receipt = await provider.waitForTransaction(hash, { retryInterval: RECEIPT_POLL_MS });
    return receipt.isReverted() ? { kind: "refused", reason: refusalOf(receipt) } : { kind: "landed" };
  } catch (error) {
    console.error("l2_send_unconfirmed", { hash, error: error instanceof Error ? error.message : error });
    return { kind: "uncertain", reason: VALUE_WORDS.unconfirmed };
  }
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
