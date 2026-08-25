import type { Chain } from "@starknet-start/chains";
import React from "react";
import Controller from "@cartridge/controller";
import { mainnet, sepolia } from "@starknet-start/chains";
import { voyager } from "@starknet-start/explorers";
import { jsonRpcProvider } from "@starknet-start/providers";
import { StarknetConfig } from "@starknet-start/react";
import { env } from "env";
import { constants } from "starknet";

export function StarknetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const cartridgeControllerWallet = React.useMemo(() => {
    const controller = new Controller({
      slot: env.VITE_PUBLIC_SLOT,
      defaultChainId:
        env.VITE_PUBLIC_CHAIN === "sepolia"
          ? constants.StarknetChainId.SN_SEPOLIA
          : constants.StarknetChainId.SN_MAIN,
      chains: [
        { rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9" },
        { rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_9" },
      ],
      lazyload: true,
    });

    return controller.asWalletStandard();
  }, []);

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

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={provider}
      explorer={voyager}
      extraWallets={[cartridgeControllerWallet]}
      autoConnect={false}
    >
      {children}
    </StarknetConfig>
  );
}
