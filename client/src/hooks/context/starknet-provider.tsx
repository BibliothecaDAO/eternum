import React from "react";

import { mainnet, sepolia } from "@starknet-react/chains";
import { StarknetConfig, publicProvider, voyager } from "@starknet-react/core";
import { getConnectors } from "./connectors";

const { connectors } = getConnectors();

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig chains={[mainnet, sepolia]} provider={publicProvider()} connectors={connectors} explorer={voyager}>
      {children}
    </StarknetConfig>
  );
}
