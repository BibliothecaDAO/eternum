import React, { useCallback } from "react";

import { Chain, mainnet, sepolia } from "@starknet-react/chains";
import { StarknetConfig, jsonRpcProvider, voyager } from "@starknet-react/core";
import { getConnectors } from "./connectors";

const { connectors } = getConnectors();

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const rpc = useCallback((_chain: Chain) => {
    return { nodeUrl: import.meta.env.VITE_PUBLIC_NODE_URL };
  }, []);

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={jsonRpcProvider({ rpc })}
      connectors={connectors}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
