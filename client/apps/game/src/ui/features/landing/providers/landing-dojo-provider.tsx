import { DojoProvider } from "@/hooks/context/dojo-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { ETERNUM_CONFIG } from "@/utils/config";
import { setup, SetupResult } from "@bibliothecadao/dojo";
import { ClientConfigManager } from "@bibliothecadao/eternum";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Account, RpcProvider } from "starknet";
import { dojoConfig } from "../../../../../dojo-config";
import { env } from "../../../../../env";

interface LandingDojoProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

const createRpcProvider = () =>
  new RpcProvider({
    nodeUrl: dojoConfig.rpcUrl,
  });

const createMasterAccount = (rpcProvider: RpcProvider) =>
  new Account({
    provider: rpcProvider,
    address: env.VITE_PUBLIC_MASTER_ADDRESS,
    signer: env.VITE_PUBLIC_MASTER_PRIVATE_KEY,
  });

/**
 * Landing-specific Dojo provider that initializes Dojo for the landing page.
 * This allows using Dojo system calls (like open_loot_chest) on the landing page
 * without requiring the full game bootstrap.
 */
export function LandingDojoProvider({ children, fallback }: LandingDojoProviderProps) {
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const account = useAccountStore((state) => state.account);

  // Create master account as fallback (same as DojoProvider does)
  const rpcProvider = useMemo(() => createRpcProvider(), []);
  const masterAccount = useMemo(() => createMasterAccount(rpcProvider), [rpcProvider]);

  useEffect(() => {
    let cancelled = false;

    const initializeDojo = async () => {
      try {
        const result = await setup(dojoConfig, {
          vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
          useBurner: env.VITE_PUBLIC_CHAIN === "local",
        });

        if (cancelled) return;

        // Initialize the config manager with Dojo components
        const eternumConfig = ETERNUM_CONFIG();
        ClientConfigManager.instance().setDojo(result.components, eternumConfig);

        setSetupResult(result);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to initialize Dojo for landing:", err);
        setError(err instanceof Error ? err : new Error("Failed to initialize Dojo"));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    initializeDojo();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      fallback ?? (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <img src="/images/logos/eternum-loader.png" alt="Loading" className="w-14 animate-pulse" />
            <p className="text-gold/60 text-sm">Initializing...</p>
          </div>
        </div>
      )
    );
  }

  if (error || !setupResult) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to initialize</p>
          <p className="text-gold/50 text-sm">{error?.message ?? "Unknown error"}</p>
        </div>
      </div>
    );
  }

  // Use the connected account if available, otherwise fall back to master account
  const effectiveAccount = account ?? masterAccount;

  return (
    <DojoProvider value={setupResult} account={effectiveAccount}>
      {children}
    </DojoProvider>
  );
}
