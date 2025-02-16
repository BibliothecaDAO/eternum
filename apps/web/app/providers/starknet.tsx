import type { ColorMode } from "@cartridge/controller";
import type { Connector } from "@starknet-react/core";
import React, { useCallback } from "react";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import ControllerConnector from "@cartridge/connector/controller";
import { getStarknet } from "@starknet-io/get-starknet-core";
import { Chain, mainnet, sepolia } from "@starknet-react/chains";
import {
  argent,
  braavos,
  InjectedConnector,
  jsonRpcProvider,
  StarknetConfig,
  useInjectedConnectors,
  voyager,
} from "@starknet-react/core";
import { WebWalletConnector } from "starknetkit/webwallet";

import { ChainId, LORDS } from "@realms-world/constants";

import { env } from "../../env";

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

const getConnectors = () => {
  // For Metamask
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  getStarknet();
  const connectors = [
    new InjectedConnector({ options: { id: "okxwallet" } }),
    new InjectedConnector({ options: { id: "bitkeep" } }),
    new InjectedConnector({ options: { id: "keplr" } }),
    new InjectedConnector({ options: { id: "metamask" } }),
    new WebWalletConnector({
      url: "https://web.argent.xyz/",
    }),
  ];

  return connectors;
};

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
  // Configure RPC provider
  const provider = jsonRpcProvider({
    rpc: (chain: Chain) => {
      switch (chain) {
        case mainnet:
          return { nodeUrl: "https://api.cartridge.gg/x/starknet/mainnet" };
        case sepolia:
        default:
          return { nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia" };
      }
    },
  });

  const chain = env.VITE_PUBLIC_CHAIN === "mainnet" ? mainnet : sepolia;

  return (
    <StarknetConfig
      chains={[chain]}
      provider={provider}
      connectors={[
        cartridgeController,
        ...(onlyCartridge ? [] : [...connectors]),
        ...getConnectors(),
      ]}
      explorer={voyager}
      autoConnect={true}
      //queryClient={queryClient}
    >
      {children}
    </StarknetConfig>
  );
}
