import { getResourceAddresses } from "@/utils/addresses";
import ControllerConnector from "@cartridge/connector/controller";
import { ColorMode } from "@cartridge/controller";
import { mainnet, sepolia } from "@starknet-react/chains";
import { Connector, StarknetConfig, jsonRpcProvider, voyager } from "@starknet-react/core";
import React, { useCallback } from "react";
import { env } from "../../../env";
import { policies } from "./policies";
import { signingPolicy } from "./signing-policy";

enum StarknetChainId {
  SN_MAIN = "0x534e5f4d41494e", // encodeShortString('SN_MAIN'),
  SN_SEPOLIA = "0x534e5f5345504f4c4941",
}

const resourceAddresses = await getResourceAddresses();

const LORDS = resourceAddresses["LORDS"][1];
const otherResources = Object.entries(resourceAddresses)
  .filter(([key]) => key !== "LORDS")
  .map(([_, [__, address]]) => address);

const preset: string = "eternum";
const theme: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";
const colorMode: ColorMode = "dark";

const controller =
  env.VITE_PUBLIC_CHAIN === "mainnet" || env.VITE_PUBLIC_CHAIN === "sepolia"
    ? new ControllerConnector({
        chains: [{ rpcUrl: env.VITE_PUBLIC_NODE_URL }],
        defaultChainId: StarknetChainId.SN_MAIN,
        namespace,
        slot,
        preset,
        tokens: {
          erc20: [LORDS, ...otherResources],
        },
        colorMode,
      })
    : new ControllerConnector({
        chains: [{ rpcUrl: env.VITE_PUBLIC_NODE_URL }],
        defaultChainId: StarknetChainId.SN_SEPOLIA,
        namespace,
        slot,
        preset,
        policies: { contracts: policies, messages: signingPolicy },
        theme,
        tokens: {
          erc20: [LORDS, ...otherResources],
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
