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

/**
 * The L2 gas a default wallet's outside execution spends checking its signatures (the passkey's WebAuthn and the
 * guardian's), measured on mainnet: the 2026-11-05 recovery cancel 0x4d2f13f3…ef0b, both signatures and one trivial
 * call, used 51,229,840. AVNU's quote estimates the asked calls as a plain invoke, without that check (its own
 * allowance covers Braavos passkeys only), then at submission refuses a fee cap below the real cost
 * (MAX_AMOUNT_TOO_LOW): every passkey send was refused until its quote carried this.
 */
const SIGNATURE_CHECK_L2_GAS = 52_000_000n;

/** AVNU: gasless for the wallet's own fees, sponsored with `apiKey` when there is one; never following a redirect. */
export const avnuPaymaster = (apiKey: string | undefined, l2GasPrice: () => Promise<bigint>): Paymaster => {
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
      if (payer === "sponsor") return { typedData: built.typed_data, fee: null };
      const fee = walletFeeOf(built.fee, await l2GasPrice());
      return { typedData: withFeeCap(built.typed_data, built.fee, fee.max), fee: hexFee(fee) };
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

type AvnuFee = PreparedInvokeTransaction["fee"];

/**
 * The fee a wallet pays itself, in WALLET_GAS_TOKEN wei: AVNU's quote plus its signature check at this L2 gas price,
 * priced at AVNU's own token price, the max raised by AVNU's own max-to-estimate ratio.
 */
const walletFeeOf = (fee: AvnuFee, l2GasPrice: bigint) => {
  const checkInStrk = SIGNATURE_CHECK_L2_GAS * l2GasPrice;
  const checkInToken = ceilDiv(checkInStrk * WALLET_GAS_TOKEN_UNIT, BigInt(fee.gas_token_price_in_strk));
  const maxCheckInToken = ceilDiv(
    checkInToken * BigInt(fee.suggested_max_fee_in_strk),
    BigInt(fee.estimated_fee_in_strk),
  );
  return {
    estimated: BigInt(fee.estimated_fee_in_gas_token) + checkInToken,
    max: BigInt(fee.suggested_max_fee_in_gas_token) + maxCheckInToken,
  };
};

/** LORDS has 18 decimals; AVNU prices a whole token in STRK wei. */
const WALLET_GAS_TOKEN_UNIT = 10n ** 18n;

const ceilDiv = (numerator: bigint, denominator: bigint) => (numerator + denominator - 1n) / denominator;

const hexFee = (fee: { estimated: bigint; max: bigint }): WalletFee => ({
  estimated: `0x${fee.estimated.toString(16)}`,
  max: `0x${fee.max.toString(16)}`,
});

/**
 * The execution with its fee's transfer (its last call, AVNU's max to the forwarder, which refunds what the fee does not
 * use) raised to `max`. The page signs only an execution whose fee call is within the max it showed (callsMatch).
 */
const withFeeCap = (typedData: BuiltExecution, fee: AvnuFee, max: bigint): BuiltExecution => {
  const { message } = typedData;
  const feeCall = "Calls" in message ? message.Calls.at(-1) : undefined;
  if (!("Calls" in message) || !feeCall || !isAvnuMaxFee(feeCall.Calldata, fee))
    throw new Error("paymaster_fee_call_unexpected");
  const [payee] = feeCall.Calldata;
  const capped = {
    ...feeCall,
    Calldata: [payee!, `0x${(max & U128_MASK).toString(16)}`, `0x${(max >> 128n).toString(16)}`],
  };
  return { ...typedData, message: { ...message, Calls: [...message.Calls.slice(0, -1), capped] } };
};

/** `transfer(payee, amount: u256)` calldata of exactly AVNU's suggested max: the fee call AVNU built. */
const isAvnuMaxFee = (calldata: string[], fee: AvnuFee) => {
  const [, low, high] = calldata;
  return calldata.length === 3 && BigInt(low!) + (BigInt(high!) << 128n) === BigInt(fee.suggested_max_fee_in_gas_token);
};

const U128_MASK = (1n << 128n) - 1n;

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
