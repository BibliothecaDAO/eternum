"use client";

import { useEffect, useMemo, useRef } from "react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, sepolia } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

const PROJECT_ID = "d80d873dcad4b8636dd7314223238a59";
const NETWORKS = [mainnet, sepolia];
const METADATA = {
  name: "Realms World",
  description: "Connect your Ethereum wallet to Realms World",
  url: "https://account.realms.world",
  icons: ["https://assets.reown.com/reown-profile-pic.png"],
};

export function AppKitProvider({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  const initializedRef = useRef(false);
  const wagmiAdapter = useMemo(
    () =>
      new WagmiAdapter({
        networks: [...NETWORKS],
        projectId: PROJECT_ID,
        ssr: true,
      }),
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined" || initializedRef.current) {
      return;
    }

    createAppKit({
      adapters: [wagmiAdapter],
      networks: [...NETWORKS],
      projectId: PROJECT_ID,
      metadata: METADATA,
      features: {
        analytics: true,
      },
    });
    initializedRef.current = true;
  }, [wagmiAdapter]);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
