import type { Chain } from "@starknet-start/chains";
import React from "react";
import { mainnet } from "@starknet-start/chains";
import { voyager } from "@starknet-start/explorers";
import { jsonRpcProvider } from "@starknet-start/providers";
import { StarknetConfig } from "@starknet-start/react";
import { resolveEndpoint } from "@realms-world/chain";
import { env } from "env";

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const identityRpcUrl = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_RPC_URL, {
    name: "VITE_PUBLIC_IDENTITY_RPC_URL",
    browserFacing: true,
  });

  const provider = jsonRpcProvider({
    rpc: (_chain: Chain) => ({ nodeUrl: identityRpcUrl }),
  });

  return (
    <StarknetConfig chains={[mainnet]} provider={provider} explorer={voyager} autoConnect={false}>
      {children}
    </StarknetConfig>
  );
}
