import { buildStarknetConfig, type StarknetChainKey } from "@bibliothecadao/react";
import { ControllerConnector } from "@cartridge/connector";
import { usePredeployedAccounts } from "@dojoengine/predeployed-connector/react";
import { Connector, StarknetConfig, jsonRpcProvider, paymasterRpcProvider, voyager } from "@starknet-react/core";
import type React from "react";
import { useCallback } from "react";
import { env } from "../../../../env";
import { policies } from "./policies";

const preset: string = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
const namespace: string = "s1_eternum";

const fallbackNodeUrl = "https://api.cartridge.gg/x/starknet/sepolia";

const { isLocal, chains, controllerOptions } = buildStarknetConfig({
  chain: env.VITE_PUBLIC_CHAIN as StarknetChainKey,
  nodeUrl: env.VITE_PUBLIC_NODE_URL,
  slot,
  namespace,
  preset,
  policies,
  applyPoliciesOnMainnet: false,
  includeAllPublicChains: true,
  fallbackNodeUrl,
});

const controller = new ControllerConnector(controllerOptions);

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);

  let { connectors: predeployedConnectors } = usePredeployedAccounts({
    rpc: env.VITE_PUBLIC_NODE_URL as string,
    id: "katana",
    name: "Katana",
  });

  const paymasterRpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);

  return (
    <StarknetConfig
      chains={chains}
      provider={jsonRpcProvider({ rpc })}
      paymasterProvider={isLocal ? paymasterRpcProvider({ rpc: paymasterRpc }) : undefined}
      connectors={isLocal ? predeployedConnectors : [controller as unknown as Connector]}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
