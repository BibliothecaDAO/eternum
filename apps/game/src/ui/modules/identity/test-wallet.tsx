import { mainnet } from "@starknet-react/chains";
import { braavos, ready, StarknetConfig } from "@starknet-react/core";
import type { ReactNode } from "react";
import { RpcProvider } from "starknet";
import { vi } from "vitest";

const SN_MAIN = "0x534e5f4d41494e";

// The L2 answers what a link and a send read: the wallet's class (deployed), its STRK for the fee, then the sent call's
// receipt.
const chain = Object.assign(new RpcProvider({ nodeUrl: "https://identity-rpc.realms.test" }), {
  getClassHashAt: async () => "0x1",
  callContract: async () => ["1", "0"],
  waitForTransaction: async () => ({ isReverted: () => false }),
});
const connectors = [ready(), braavos()];

/**
 * The wallet chunk's provider for a test that runs the real wallet rows and send: the two extension connectors, which
 * meet whatever `installWallet` put in the page. Ready by email and Controller are pages of their own and are left out.
 */
export const StandInStarknetProvider = ({ children }: { children: ReactNode }) => (
  <StarknetConfig chains={[mainnet]} provider={() => chain} connectors={connectors}>
    {children}
  </StarknetConfig>
);

type Asked = { type: string; params?: { silent_mode?: boolean; calls?: object[] } };

/**
 * A wallet extension as the page meets one: the account it shares, silently too unless `locked` (a connection prompt
 * then unlocks it), whether its owner approves a transaction, and whether its connection prompt ever answers (`answers:
 * false`: its window was closed, or the browser blocked it). Cleared with `vi.unstubAllGlobals`.
 */
export const installWallet = (
  extension: "argentX" | "braavos",
  wallet: { account: string; locked?: boolean; approves?: boolean; answers?: boolean },
) => {
  const asked: Asked[] = [];
  let locked = (wallet.locked ?? false) || wallet.answers === false;
  vi.stubGlobal(`starknet_${extension}`, {
    id: extension,
    on: () => {},
    off: () => {},
    request: async (call: Asked) => {
      asked.push(call);
      if (call.type === "wallet_requestChainId") return SN_MAIN;
      if (call.type === "wallet_addInvokeTransaction") {
        if (wallet.approves === false) throw new Error("User abort");
        return { transaction_hash: "0xtx" };
      }
      if (call.type !== "wallet_requestAccounts") throw new Error(`unexpected ${call.type}`);
      if (call.params?.silent_mode && locked) return [];
      if (wallet.answers === false) return new Promise<never>(() => {});
      locked = false;
      return [wallet.account];
    },
  });
  return {
    /** The connection prompts the wallet showed its owner. */
    connections: () => asked.filter((call) => call.type === "wallet_requestAccounts" && !call.params?.silent_mode),
    /** The transactions it was asked to sign, each as its calls. */
    transactions: () =>
      asked.filter((call) => call.type === "wallet_addInvokeTransaction").map((call) => call.params?.calls),
  };
};
