import ControllerConnector from "@cartridge/connector/controller";
import type { ColorMode } from "@cartridge/controller";
import { mainnet, sepolia } from "@starknet-react/chains";
import {
  StarknetConfig,
  argent,
  braavos,
  jsonRpcProvider,
  useInjectedConnectors,
  voyager,
} from "@starknet-react/core";
import React, { useCallback } from "react";
import { env } from "../../env";
import { ChainId, LORDS } from "@realms-world/constants";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
/*import { getSeasonAddresses } from "../ui/utils/utils";
//import { cartridgeController } from "./cartridge-controller";

const resourceAddresses = await getSeasonAddresses();

const LORDS = resourceAddresses["LORDS"][1];
const otherResources = Object.entries(resourceAddresses)
  .filter(([key]) => key !== "LORDS")
  .map(([_, [__, address]]) => address);
*/
const theme = "eternum";
const slot: string = env.VITE_PUBLIC_SLOT;
//const namespace: string = "eternum";
const colorMode: ColorMode = "dark";

const cartridgeController = new ControllerConnector({
  //policies: [],
  chains: [
    {
      rpcUrl:
        env.VITE_PUBLIC_CHAIN == "sepolia"
          ? "https://api.cartridge.gg/x/starknet/sepolia"
          : "https://api.cartridge.gg/x/starknet/mainnet",
    },
  ],
  defaultChainId:
    env.VITE_PUBLIC_CHAIN == "sepolia"
      ? ChainId.SN_SEPOLIA
      : (ChainId.SN_MAIN as string),
  theme,
  colorMode,
  tokens: {
    erc20: [
      LORDS[SUPPORTED_L2_CHAIN_ID]?.address as string /*, ...otherResources*/,
    ],
  },
  // namespace,
  slot,
});

export function StarknetProvider({
  children,
  onlyCartridge,
}: {
  children: React.ReactNode;
  onlyCartridge?: boolean;
}) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [argent(), braavos()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: "onlyIfNoConnectors",
    // Randomize the order of the connectors.
    order: "random",
  });
  const rpc = useCallback(() => {
    return { nodeUrl: env.VITE_PUBLIC_NODE_URL };
  }, []);
  const chain = env.VITE_PUBLIC_CHAIN === "mainnet" ? mainnet : sepolia;

  return (
    <StarknetConfig
      chains={[chain]}
      provider={jsonRpcProvider({ rpc })}
      connectors={[
        cartridgeController,
        ...(onlyCartridge ? [] : [...connectors]),
      ]}
      explorer={voyager}
      autoConnect={true}
      //queryClient={queryClient}
    >
      {children}
    </StarknetConfig>
  );
}
