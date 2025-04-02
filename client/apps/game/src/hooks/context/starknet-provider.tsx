import { getResourceAddresses } from "@/utils/addresses";
import { ControllerConnector } from "@cartridge/connector";
import { mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, voyager } from "@starknet-react/core";
import type React from "react";
import { useCallback } from "react";
import { shortString } from "starknet";
import { env } from "../../../env";
import { policies } from "./policies";

const resourceAddresses = getResourceAddresses();

const LORDS = resourceAddresses["LORDS"][1].toString();
const otherResources = Object.entries(resourceAddresses)
  .filter(([key]) => key !== "LORDS")
  .map(([_, [__, address]]) => address)
  .toString();

const preset: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

const nonLocalController = new ControllerConnector({
  chains: [
    { rpcUrl: "http://localhost:5050" },
    {
      rpcUrl:
        env.VITE_PUBLIC_NODE_URL !== "http://127.0.0.1:5050" &&
          env.VITE_PUBLIC_NODE_URL !== "http://localhost:5050"
          ? env.VITE_PUBLIC_NODE_URL
          : "https://api.cartridge.gg/x/starknet/sepolia",
    },
  ],
  defaultChainId: shortString.encodeShortString("KATANA"),
  // defaultChainId:
  // 	env.VITE_PUBLIC_CHAIN === "mainnet"
  // 		? constants.StarknetChainId.SN_MAIN
  // 		: constants.StarknetChainId.SN_SEPOLIA,
  preset,
  policies,
  slot,
  namespace,
  tokens: {
    erc20: [LORDS, ...otherResources],
  },
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={jsonRpcProvider({ rpc })}
      connectors={[nonLocalController as unknown as Connector]}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
