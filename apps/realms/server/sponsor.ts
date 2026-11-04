import type { defaultWalletDeployment } from "@realms-world/identity/wallet";
import { PaymasterRpc } from "starknet";
import type { Call, PreparedInvokeTransaction } from "starknet";

import { fetchIdentityRpc } from "./l2";

/** AVNU's paymaster on Starknet mainnet: SNIP-29, sponsored with the environment's API key. */
const AVNU_PAYMASTER_URL = "https://starknet.paymaster.avnu.fi";

/** What deploys a default wallet at its address, in the paymaster's own field names. */
export type WalletDeployment = ReturnType<typeof defaultWalletDeployment>;

/** The SNIP-9 v2 outside execution the sponsor builds and the wallet signs, as SNIP-12 typed data. */
export type SponsoredExecution = PreparedInvokeTransaction["typed_data"];

/**
 * Who pays a default wallet's gas: it builds the outside execution the wallet signs (deploying the wallet first while
 * it has never sent anything) and then submits it, signed, at its own cost.
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
      const { transaction_hash } = await paymaster.executeTransaction(
        deployment ? { type: "deploy_and_invoke", invoke, deployment } : { type: "invoke", invoke },
        SPONSORED,
      );
      return transaction_hash;
    },
  };
};
