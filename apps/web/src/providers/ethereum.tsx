"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// 0. Setup queryClient
const queryClient = new QueryClient();

export function AppKitProvider({ children }: { children: React.ReactNode }) {
  const [WagmiProvider, setWagmiProvider] = useState<any>(null);
  const [wagmiConfig, setWagmiConfig] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadClientOnlyDeps() {
      // Dynamically import client-only packages
      const [{ WagmiAdapter }, { mainnet, sepolia }, { createAppKit }] =
        await Promise.all([
          import("@reown/appkit-adapter-wagmi"),
          import("@reown/appkit/networks"),
          import("@reown/appkit/react"),
        ]);
      const { WagmiProvider } = await import("wagmi");

      // 1. Get projectId from https://cloud.reown.com
      const projectId = "d80d873dcad4b8636dd7314223238a59";

      // 2. Create a metadata object - optional
      const metadata = {
        name: "Realms World",
        description: "Connect your Ethereum wallet to Realms World",
        url: "https://account.realms.world",
        icons: ["https://assets.reown.com/reown-profile-pic.png"],
      };

      // 3. Set the networks
      const networks = [mainnet, sepolia];

      // 4. Create Wagmi Adapter
      const wagmiAdapter = new WagmiAdapter({
        networks,
        projectId,
        ssr: true,
      });

      // 5. Create modal
      createAppKit({
        adapters: [wagmiAdapter],
        networks,
        projectId,
        metadata,
        features: {
          analytics: true,
        },
      });

      if (isMounted) {
        setWagmiProvider(() => WagmiProvider);
        setWagmiConfig(wagmiAdapter.wagmiConfig);
      }
    }

    if (typeof window !== "undefined") {
      loadClientOnlyDeps();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  if (!WagmiProvider || !wagmiConfig) {
    // Optionally render a loading spinner here
    return null;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
