import React from "react";

import ControllerConnector from "@cartridge/connector/controller";
import { devnet, mainnet, sepolia } from "@starknet-react/chains";
import { StarknetConfig, argent, braavos, publicProvider, useInjectedConnectors, voyager } from "@starknet-react/core";

export function StarknetProvider({ children }: { children: React.ReactNode }) {

  const cartridge = new ControllerConnector({
    policies: [
      {
        target: import.meta.env.VITE_LORDS_ADDRESS,
        method: "approve",
        description:
          "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
      },
      {
        target: import.meta.env.VITE_LORDS_ADDRESS,
        method: "transfer",
      },
      // Add more policies as needed
    ],
    rpc: "https://api.cartridge.gg/x/starknet/sepolia",
    // Uncomment to use a custom theme
    // theme: "dope-wars",
    // colorMode: "light"
  });
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
      chains={[mainnet, sepolia, devnet]}
      provider={publicProvider()}
      connectors={[...connectors, cartridge]}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}
