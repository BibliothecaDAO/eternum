import ControllerConnector from "@cartridge/connector/controller";
import { ColorMode } from "@cartridge/controller";
import { mainnet, sepolia } from "@starknet-react/chains";
import { StarknetConfig, argent, braavos, jsonRpcProvider, useInjectedConnectors, voyager } from "@starknet-react/core";
import React, { useCallback } from "react";
import { env } from "../../../env";
//import { cartridgeController } from "./cartridge-controller";

const theme: string = "eternum";
const slot: string = "realms-world-04";
const namespace: string = "eternum";
const colorMode: ColorMode = "dark";

const cartridgeController = new ControllerConnector({
  policies: [],
  rpc: "https://api.cartridge.gg/x/starknet/" + env.VITE_PUBLIC_CHAIN,
  theme,
  colorMode,
  tokens: {
    erc20: ["0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49"],
  },
  // namespace,
  slot,
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
