import type { Chain } from "@starknet-start/chains";
import React from "react";
import { mainnet, sepolia } from "@starknet-start/chains";
import { voyager } from "@starknet-start/explorers";
import { jsonRpcProvider } from "@starknet-start/providers";
import { StarknetConfig } from "@starknet-start/react";

export function StarknetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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
      autoConnect={false}
    >
      {children}
    </StarknetConfig>
  );
}
