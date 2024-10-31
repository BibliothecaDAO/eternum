import React from "react";

import ControllerConnector from "@cartridge/connector/controller";
import { sepolia } from "@starknet-react/chains";
import { StarknetConfig, argent, braavos, useInjectedConnectors, voyager } from "@starknet-react/core";
import { RpcProvider } from "starknet";
function provider(/*chain: Chain*/) {
  return new RpcProvider({
    nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia",
  });
}

const ETH_TOKEN_ADDRESS =
"0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

const cartridge = new ControllerConnector({
policies: [
  {
    target: ETH_TOKEN_ADDRESS,
    method: "approve",
    description:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
  },
  {
    target: ETH_TOKEN_ADDRESS,
    method: "transfer",
  },
  // Add more policies as needed
],
rpc: "https://api.cartridge.gg/x/starknet/sepolia",
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

  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={provider}
      connectors={[...connectors, cartridge]}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}
