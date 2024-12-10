import React, { useCallback } from "react";

import ControllerConnector from "@cartridge/connector/controller";
import { ColorMode } from "@cartridge/controller";
import { mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, voyager } from "@starknet-react/core";
import { env } from "../../../env";
import { policies } from "./policies";
import { signingPolicy } from "./signing-policy";

const theme: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s0_eternum";
const colorMode: ColorMode = "dark";

const vrfPolicy = {
  target: "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f",
  method: "request_random",
  description: "Allows requesting random numbers from the VRF provider",
};

const controller = new ControllerConnector({
  rpc: env.VITE_PUBLIC_NODE_URL,
  namespace,
  slot,
  policies: [...policies, ...signingPolicy, vrfPolicy],
  theme,
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
