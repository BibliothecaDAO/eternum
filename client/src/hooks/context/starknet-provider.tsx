import React, { useCallback } from "react";

import ControllerConnector from "@cartridge/connector/controller";
import { ColorMode } from "@cartridge/controller";
import { mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, voyager } from "@starknet-react/core";
import { policies } from "./policies";

const theme: string = "eternum";
const slot: string = "eternum-rc1-1";
const namespace: string = "eternum";
const colorMode: ColorMode = "dark";

const controller = new ControllerConnector({
  rpc: import.meta.env.VITE_PUBLIC_NODE_URL,
  namespace,
  slot,
  policies,
  theme,
  colorMode,
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const rpc = useCallback(() => {
    return { nodeUrl: import.meta.env.VITE_PUBLIC_NODE_URL };
  }, []);

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={jsonRpcProvider({ rpc })}
      connectors={[controller as never as Connector]}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
