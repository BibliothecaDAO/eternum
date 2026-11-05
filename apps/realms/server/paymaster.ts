import type { WalletExecution } from "@realms-world/guardian";
import { WALLET_GAS_TOKEN } from "@realms-world/identity/wallet";
import type { defaultWalletDeployment } from "@realms-world/identity/wallet";
import { PaymasterRpc, RpcError, shortString } from "starknet";
import type { Call, ExecutionParameters, PreparedInvokeTransaction } from "starknet";

import { fetchIdentityRpc } from "./l2";

/** AVNU's paymaster on Starknet mainnet (SNIP-29): gasless with no key, sponsored with the environment's key. */
const AVNU_PAYMASTER_URL = "https://starknet.paymaster.avnu.fi";

/** What deploys a default wallet at its address, in the paymaster's own field names. */
export type WalletDeployment = ReturnType<typeof defaultWalletDeployment>;

/** The SNIP-9 v2 outside execution the paymaster builds and the wallet signs, as SNIP-12 typed data. */
export type BuiltExecution = PreparedInvokeTransaction["typed_data"];

/**
 * Who pays an execution's network fee. The wallet, in WALLET_GAS_TOKEN: the paymaster adds the fee's transfer as the
 * execution's last call. The sponsor (our AVNU key): a recovery step, which the wallet only accepts as its single call
 * (argent_account.cairo v0.5.0, `assert_valid_calls_and_signature`), so it cannot carry a fee call.
 */
export type GasPayer = "wallet" | "sponsor";

/** The fee a wallet pays itself, in WALLET_GAS_TOKEN wei as hex: about `estimated`, at most `max`. */
export interface WalletFee {
  estimated: string;
  max: string;
}

/**
 * The paymaster answered that it will not submit the execution: proven never sent. Any other failure of `execute` (a
 * lost connection, a timeout) leaves it unknown whether the execution was sent, and is never treated as this.
 */
export class PaymasterRefusedError extends Error {}

/**
 * Builds a default wallet's outside execution (deploying the wallet first while it has never sent anything) and submits
 * it signed. `canSponsor` says whether the sponsor may pay: without our key only the wallet can, and a "sponsor" step
 * must not be asked for. `execute` throws PaymasterRefusedError only when the paymaster refused; the execution's own
 * nonce keeps a resubmission from running twice.
 */
export interface Paymaster {
  canSponsor: boolean;
  build(
    wallet: string,
    calls: Call[],
    deployment: WalletDeployment | null,
    payer: GasPayer,
  ): Promise<{ typedData: BuiltExecution; fee: WalletFee | null }>;
  execute(
    wallet: string,
    typedData: BuiltExecution,
    signature: string[],
    deployment: WalletDeployment | null,
    payer: GasPayer,
  ): Promise<string>;
}

/** AVNU: gasless for the wallet's own fees, sponsored with `apiKey` when there is one; never following a redirect. */
export const avnuPaymaster = (apiKey: string | undefined): Paymaster => {
  const gasless = new PaymasterRpc({ nodeUrl: AVNU_PAYMASTER_URL, baseFetch: fetchIdentityRpc });
  const sponsored = apiKey
    ? new PaymasterRpc({
        nodeUrl: AVNU_PAYMASTER_URL,
        headers: { "x-paymaster-api-key": apiKey },
        baseFetch: fetchIdentityRpc,
      })
    : null;
  const paymasterFor = (payer: GasPayer) => {
    if (payer === "wallet") return gasless;
    if (!sponsored) throw new Error("paymaster_sponsor_key_missing");
    return sponsored;
  };
  return {
    canSponsor: sponsored !== null,
    build: async (wallet, calls, deployment, payer) => {
      const invoke = { userAddress: wallet, calls };
      let built;
      try {
        built = await paymasterFor(payer).buildTransaction(
          deployment ? { type: "deploy_and_invoke", invoke, deployment } : { type: "invoke", invoke },
          parametersOf(payer),
        );
      } catch (error) {
        // Its simulation refused the execution: for a wallet paying its fee, most often too little LORDS for it.
        if (error instanceof RpcError) throw new PaymasterRefusedError(error.message);
        throw error;
      }
      if (built.type === "deploy") throw new Error("paymaster_built_no_invoke");
      return { typedData: built.typed_data, fee: payer === "wallet" ? walletFeeOf(built.fee) : null };
    },
    execute: async (wallet, typedData, signature, deployment, payer) => {
      const invoke = { userAddress: wallet, typedData, signature };
      try {
        const { transaction_hash } = await paymasterFor(payer).executeTransaction(
          deployment ? { type: "deploy_and_invoke", invoke, deployment } : { type: "invoke", invoke },
          parametersOf(payer),
        );
        return transaction_hash;
      } catch (error) {
        // A JSON-RPC error is the paymaster's own answer: it simulates before it submits, and refused.
        if (error instanceof RpcError) throw new PaymasterRefusedError(error.message);
        throw error;
      }
    },
  };
};

const parametersOf = (payer: GasPayer): ExecutionParameters => ({
  version: "0x1",
  feeMode: payer === "wallet" ? { mode: "default", gasToken: WALLET_GAS_TOKEN } : { mode: "sponsored" },
});

const walletFeeOf = (fee: PreparedInvokeTransaction["fee"]): WalletFee => ({
  estimated: `0x${BigInt(fee.estimated_fee_in_gas_token).toString(16)}`,
  max: `0x${BigInt(fee.suggested_max_fee_in_gas_token).toString(16)}`,
});

/**
 * The outside execution a paymaster built, read field by field: only a SNIP-9 v2 execution for this chain, else null.
 * The guardian rebuilds its message from these fields, so it co-signs exactly what is read here.
 */
export const walletExecutionOf = (typedData: BuiltExecution, chainId: string): WalletExecution | null => {
  // JSON from the paymaster or a browser: any field may be missing.
  const { domain, message, primaryType } = typedData as unknown as {
    domain?: Record<string, unknown>;
    message?: Record<string, unknown>;
    primaryType?: string;
  };
  const isExecution =
    primaryType === "OutsideExecution" &&
    domain?.name === "Account.execute_from_outside" &&
    String(domain.version) === "2" &&
    feltOf(domain.chainId) === BigInt(chainId) &&
    Array.isArray(message?.Calls);
  if (!isExecution) return null;
  return {
    caller: String(message.Caller),
    nonce: String(message.Nonce),
    executeAfter: String(message["Execute After"]),
    executeBefore: String(message["Execute Before"]),
    calls: (message.Calls as Record<string, unknown>[]).map((call) => ({
      to: String(call.To),
      selector: String(call.Selector),
      calldata: (call.Calldata as unknown[]).map(String),
    })),
  };
};

/** A domain chain id, which SNIP-12 allows as a short string ("SN_MAIN") or its felt. */
const feltOf = (value: unknown): bigint | null => {
  if (typeof value !== "string") return null;
  return BigInt(/^0x[0-9a-fA-F]+$/.test(value) ? value : shortString.encodeShortString(value));
};
