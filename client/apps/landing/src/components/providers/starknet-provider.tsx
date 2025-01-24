import ControllerConnector from "@cartridge/connector/controller";
import { mainnet, sepolia } from "@starknet-react/chains";
import { StarknetConfig, argent, braavos, jsonRpcProvider, useInjectedConnectors, voyager } from "@starknet-react/core";
import React, { useCallback } from "react";
import { constants } from "starknet";
import { env } from "../../../env";
import { getResourceAddresses } from "../ui/utils/addresses";

const resourceAddresses = await getResourceAddresses();

const LORDS = resourceAddresses["LORDS"][1].toString();
const otherResources = Object.entries(resourceAddresses)
  .filter(([key]) => key !== "LORDS")
  .map(([_, [__, address]]) => address.toString());

const theme: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "eternum";
const preset: string = "eternum";

const cartridgeController = new ControllerConnector({
  chains: [{ rpcUrl: env.VITE_PUBLIC_NODE_URL }],
  defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
  namespace,
  slot,
  preset,
  theme,
  tokens: {
    erc20: [LORDS, ...otherResources],
  },
});

export function StarknetProvider({ children, onlyCartridge }: { children: React.ReactNode; onlyCartridge?: boolean }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [argent(), braavos()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: "onlyIfNoConnectors",
    // Randomize the order of the connectors.
    order: "random",
  });
  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);
  const chain = env.VITE_PUBLIC_CHAIN === "mainnet" ? mainnet : sepolia;

  return (
    <StarknetConfig
      chains={[chain]}
      provider={jsonRpcProvider({ rpc })}
      connectors={[cartridgeController, ...(onlyCartridge ? [] : [...connectors])]}
      explorer={voyager}
      autoConnect={true}
    >
      {children}
    </StarknetConfig>
  );
}
