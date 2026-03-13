import ControllerConnector from "@cartridge/connector/controller";
import { mainnet, sepolia } from "@starknet-react/chains";
import { StarknetConfig, jsonRpcProvider, useInjectedConnectors, voyager } from "@starknet-react/core";
import React, { useCallback } from "react";
import { constants, shortString } from "starknet";
import { env } from "../../../env";
import { getResourceAddresses } from "../ui/utils/addresses";
import { buildStarknetConnectors, getInjectedConnectorsOptions } from "./starknet-connectors";

const KATANA_CHAIN_ID = shortString.encodeShortString("KATANA");
const resourceAddresses = getResourceAddresses();

const LORDS = resourceAddresses["LORDS"][1].toString();
const otherResources = Object.entries(resourceAddresses)
  .filter(([key]) => key !== "LORDS")
  .map(([_, [__, address]]) => address.toString());

const preset: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

const chain_id =
  env.VITE_PUBLIC_CHAIN === "local"
    ? KATANA_CHAIN_ID
    : env.VITE_PUBLIC_CHAIN === "sepolia"
      ? constants.StarknetChainId.SN_SEPOLIA
      : constants.StarknetChainId.SN_MAIN;
const cartridgeController = new ControllerConnector({
  chains: [{ rpcUrl: env.VITE_PUBLIC_NODE_URL }],
  defaultChainId: chain_id,
  preset,
  namespace,
  slot,
});

export function StarknetProvider({ children, onlyCartridge }: { children: React.ReactNode; onlyCartridge?: boolean }) {
  const { connectors } = useInjectedConnectors(getInjectedConnectorsOptions());
  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);
  const chain = env.VITE_PUBLIC_CHAIN === "mainnet" ? mainnet : sepolia;

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={jsonRpcProvider({ rpc })}
      connectors={buildStarknetConnectors(cartridgeController, connectors, onlyCartridge)}
      explorer={voyager}
      autoConnect={true}
    >
      {children}
    </StarknetConfig>
  );
}
