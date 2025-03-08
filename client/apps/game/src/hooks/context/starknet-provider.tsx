import { getResourceAddresses } from "@/utils/addresses";
import ControllerConnector from "@cartridge/connector/controller";
import { predeployedAccounts, PredeployedAccountsConnector } from "@dojoengine/predeployed-connector";
import { mainnet, sepolia } from "@starknet-react/chains";
import { Connector, jsonRpcProvider, StarknetConfig, voyager } from "@starknet-react/core";
import React, { useCallback, useState } from "react";
import { constants } from "starknet";
import { env } from "../../../env";
import { policies } from "./policies";

const resourceAddresses = getResourceAddresses();

const LORDS = resourceAddresses["LORDS"][1].toString();
const otherResources = Object.entries(resourceAddresses)
  .filter(([key]) => key !== "LORDS")
  .map(([_, [__, address]]) => address)
  .toString();

const preset: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

const nonLocalController = new ControllerConnector({
  chains: [
    {
      rpcUrl:
        env.VITE_PUBLIC_NODE_URL !== "http://127.0.0.1:5050"
          ? env.VITE_PUBLIC_NODE_URL
          : "https://api.cartridge.gg/x/starknet/sepolia",
    },
  ],
  defaultChainId:
    env.VITE_PUBLIC_CHAIN === "mainnet" ? constants.StarknetChainId.SN_MAIN : constants.StarknetChainId.SN_SEPOLIA,
  preset,
  // policies: [policies],
  slot,
  namespace,
  tokens: {
    erc20: [LORDS, ...otherResources],
  },
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const [localConnector, setLocalConnector] = useState<PredeployedAccountsConnector | null>(null);

  if (env.VITE_PUBLIC_CHAIN === "local") {
    predeployedAccounts({
      rpc: env.VITE_PUBLIC_NODE_URL as string,
      id: "katana",
      name: "Katana",
    }).then((connectors) => {
      setLocalConnector(connectors[0]);
    });
  }

  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);

  if (env.VITE_PUBLIC_CHAIN !== "local") {
    return (
      <StarknetConfig
        chains={[mainnet, sepolia]}
        provider={jsonRpcProvider({ rpc })}
        connectors={[nonLocalController]}
        explorer={voyager}
        autoConnect
      >
        {children}
      </StarknetConfig>
    );
  }

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={jsonRpcProvider({ rpc })}
      connectors={[localConnector as never as Connector]}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
