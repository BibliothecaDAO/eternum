import { deviceChangeHash, type DeviceChange } from "@realms-world/identity/account";
import { WALLET_RECOVERY } from "@realms-world/identity/wallet";
import { ec, hash, num, OutsideExecutionTypesV2, typedData } from "starknet";

export interface GuardianSignature {
  r: string;
  s: string;
}

/** One call of an outside execution, as the account receives it. */
export interface WalletCall {
  to: string;
  selector: string;
  calldata: string[];
}

/** A default wallet's SNIP-9 v2 outside execution: who may submit it, its nonce, its time window and its calls. */
export interface WalletExecution {
  caller: string;
  nonce: string;
  executeAfter: string;
  executeBefore: string;
  calls: WalletCall[];
}

/**
 * A call the guardian never co-signs: one to the wallet itself changes its owner, guardian or escape. The one exception
 * is a recovery step alone in its execution (WALLET_RECOVERY).
 */
export class WalletSelfCallError extends Error {
  constructor() {
    super("wallet_self_call");
  }
}

const RECOVERY_SELECTORS = new Set(
  Object.values(WALLET_RECOVERY).map((entrypoint) => BigInt(hash.getSelectorFromName(entrypoint))),
);

/** Calls to the wallet itself, refused unless the execution is a single recovery step. */
const isRefusedSelfCall = (wallet: string, calls: WalletCall[]) => {
  const selfCalls = calls.filter((call) => BigInt(call.to) === BigInt(wallet));
  if (selfCalls.length === 0) return false;
  return calls.length !== 1 || !RECOVERY_SELECTORS.has(BigInt(selfCalls[0]!.selector));
};

/**
 * What the guardian offers the identity Worker: its public key, a signature over a device change, and its co-signature
 * on a default wallet's outside execution. Nothing else.
 */
export interface Guardian {
  publicKey(): Promise<string>;
  signDeviceChange(change: DeviceChange): Promise<GuardianSignature>;
  signWalletExecution(chainId: string, wallet: string, execution: WalletExecution): Promise<GuardianSignature>;
}

/**
 * The guardian computes every message itself, so its key can only ever approve a device change or a default wallet's
 * outside execution, never a hash a caller chose. Of the calls to the wallet itself it takes part only in a lost
 * passkey's recovery: the escape's start and finish (7 days apart, which the account enforces) and its cancel, which
 * also needs the owner. Owner, guardian and upgrade changes it refuses, so the passkey alone decides what the wallet does.
 */
export const createGuardian = (privateKey: string): Guardian => {
  const sign = (digest: string): GuardianSignature => {
    const signature = ec.starkCurve.sign(digest, privateKey);
    return { r: num.toHex(signature.r), s: num.toHex(signature.s) };
  };
  return {
    publicKey: async () => ec.starkCurve.getStarkKey(privateKey),
    signDeviceChange: async (change) => sign(deviceChangeHash(change)),
    signWalletExecution: async (chainId, wallet, execution) => {
      if (isRefusedSelfCall(wallet, execution.calls)) throw new WalletSelfCallError();
      return sign(typedData.getMessageHash(walletExecutionMessage(chainId, execution), wallet));
    },
  };
};

/** The SNIP-12 message `execute_from_outside_v2` checks (argent-contracts-starknet `outside_execution_hash.cairo`). */
export const walletExecutionMessage = (chainId: string, execution: WalletExecution) => ({
  types: OutsideExecutionTypesV2,
  primaryType: "OutsideExecution",
  domain: { name: "Account.execute_from_outside", version: "2", chainId, revision: "1" },
  message: {
    Caller: execution.caller,
    Nonce: execution.nonce,
    "Execute After": execution.executeAfter,
    "Execute Before": execution.executeBefore,
    Calls: execution.calls.map((call) => ({ To: call.to, Selector: call.selector, Calldata: call.calldata })),
  },
});
