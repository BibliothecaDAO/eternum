import React from "react";

import { sepolia, mainnet, Chain } from "@starknet-react/chains";
import {
  StarknetConfig,
  argent,
  braavos,
  useInjectedConnectors,
  voyager,
  jsonRpcProvider,
} from "@starknet-react/core";

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [argent(), braavos()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: "onlyIfNoConnectors",
    // Randomize the order of the connectors.
    order: "random",
  });

  const rpc = (_chain: Chain) => {
    const nodeUrl =
      _chain.id === sepolia.id
        ? "https://api.cartridge.gg/x/starknet/sepolia"
        : "https://api.cartridge.gg/x/starknet/mainnet";

    return {
      nodeUrl,
    };
  };

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={jsonRpcProvider({ rpc })}
      connectors={connectors}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}
