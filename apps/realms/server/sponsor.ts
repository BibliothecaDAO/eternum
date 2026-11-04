import type { WalletExecution } from "@realms-world/guardian";
import type { defaultWalletDeployment } from "@realms-world/identity/wallet";
import { PaymasterRpc, RpcError, shortString } from "starknet";
import type { Call, PreparedInvokeTransaction } from "starknet";

import { fetchIdentityRpc } from "./l2";

/** AVNU's paymaster on Starknet mainnet: SNIP-29, sponsored with the environment's API key. */
const AVNU_PAYMASTER_URL = "https://starknet.paymaster.avnu.fi";

/** What deploys a default wallet at its address, in the paymaster's own field names. */
export type WalletDeployment = ReturnType<typeof defaultWalletDeployment>;

/** The SNIP-9 v2 outside execution the sponsor builds and the wallet signs, as SNIP-12 typed data. */
export type SponsoredExecution = PreparedInvokeTransaction["typed_data"];

/**
 * The sponsor answered that it will not submit the execution: proven never sent. Any other failure of `execute` (a
 * lost connection, a timeout) leaves it unknown whether the execution was sent, and is never treated as this.
 */
export class SponsorRefusedError extends Error {}

/**
 * Who pays a default wallet's gas: it builds the outside execution the wallet signs (deploying the wallet first while
 * it has never sent anything) and then submits it, signed, at its own cost. `execute` throws SponsorRefusedError only
 * when the sponsor refused; the execution's own nonce keeps a resubmission from running twice.
 */
export interface Sponsor {
  build(wallet: string, calls: Call[], deployment: WalletDeployment | null): Promise<SponsoredExecution>;
  execute(
    wallet: string,
    typedData: SponsoredExecution,
    signature: string[],
    deployment: WalletDeployment | null,
  ): Promise<string>;
}

const SPONSORED = { version: "0x1", feeMode: { mode: "sponsored" } } as const;

/** AVNU sponsoring with `apiKey`; its requests never follow a redirect. */
export const avnuSponsor = (apiKey: string): Sponsor => {
  const paymaster = new PaymasterRpc({
    nodeUrl: AVNU_PAYMASTER_URL,
    headers: { "x-paymaster-api-key": apiKey },
    baseFetch: fetchIdentityRpc,
  });
  return {
    build: async (wallet, calls, deployment) => {
      const invoke = { userAddress: wallet, calls };
      const built = await paymaster.buildTransaction(
        deployment ? { type: "deploy_and_invoke", invoke, deployment } : { type: "invoke", invoke },
        SPONSORED,
      );
      if (built.type === "deploy") throw new Error("sponsor_built_no_invoke");
      return built.typed_data;
    },
    execute: async (wallet, typedData, signature, deployment) => {
      const invoke = { userAddress: wallet, typedData, signature };
      try {
        const { transaction_hash } = await paymaster.executeTransaction(
          deployment ? { type: "deploy_and_invoke", invoke, deployment } : { type: "invoke", invoke },
          SPONSORED,
        );
        return transaction_hash;
      } catch (error) {
        // A JSON-RPC error is the paymaster's own answer: it simulates before it submits, and refused.
        if (error instanceof RpcError) throw new SponsorRefusedError(error.message);
        throw error;
      }
    },
  };
};

/**
 * The outside execution a sponsor built, read field by field: only a SNIP-9 v2 execution for this chain, else null.
 * The guardian rebuilds its message from these fields, so it co-signs exactly what is read here.
 */
export const walletExecutionOf = (typedData: SponsoredExecution, chainId: string): WalletExecution | null => {
  // JSON from the sponsor or a browser: any field may be missing.
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
