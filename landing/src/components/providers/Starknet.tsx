import React, { useCallback } from "react";

import ControllerConnector from "@cartridge/connector/controller";
import { sepolia } from "@starknet-react/chains";
import { StarknetConfig, argent, braavos, jsonRpcProvider, useInjectedConnectors, voyager } from "@starknet-react/core";
import { RpcProvider } from "starknet";
//import { cartridgeController } from "./cartridge-controller";
function provider(/*chain: Chain*/) {
  return new RpcProvider({
    nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia",
  });
}

const cartridgeController = new ControllerConnector({
  policies: [],
  rpc: import.meta.env.VITE_PUBLIC_NODE_URL,
  // Uncomment to use a custom theme
  // theme: "dope-wars",
  // colorMode: "light"
});
export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [argent(), braavos()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: "onlyIfNoConnectors",
    // Randomize the order of the connectors.
    order: "random",
  });
  const rpc = useCallback(() => {
    return { nodeUrl: import.meta.env.VITE_PUBLIC_NODE_URL };
  }, []);
  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={jsonRpcProvider({ rpc })}
      connectors={[...connectors, cartridgeController]}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}
