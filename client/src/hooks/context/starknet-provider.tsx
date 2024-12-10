import React, { useCallback } from "react";

import ControllerConnector from "@cartridge/connector/controller";
import { ColorMode } from "@cartridge/controller";
import { mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, voyager } from "@starknet-react/core";
import { env } from "../../../env";

const preset: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s0_eternum";
const colorMode: ColorMode = "dark";

const controller = new ControllerConnector({
  rpc: env.VITE_PUBLIC_NODE_URL,
  namespace,
  slot,
  preset,
  tokens: {
    erc20: ["0x0342ad5cc14002c005a5cedcfce2bd3af98d5e7fb79e9bf949b3a91cf145d72e"],
  },
  colorMode,
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
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
