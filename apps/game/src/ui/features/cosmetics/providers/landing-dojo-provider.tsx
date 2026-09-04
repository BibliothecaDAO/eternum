import { useAccountStore } from "@/hooks/store/use-account-store";
import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
import { EternumProvider } from "@bibliothecadao/provider";
import { createSystemCalls, SystemCalls } from "@bibliothecadao/types";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Account, AccountInterface } from "starknet";
import { dojoConfig } from "../../../../../dojo-config";
import { env } from "../../../../../env";

interface LandingDojoProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface LandingDojoContextType {
  systemCalls: SystemCalls;
  account: Account | AccountInterface;
}

const LandingDojoContext = createContext<LandingDojoContextType | null>(null);

/**
 * Hook to access landing-specific Dojo context (systemCalls and account only).
 */
export function useLandingDojo(): LandingDojoContextType {
  const context = useContext(LandingDojoContext);
  if (!context) {
    throw new Error("useLandingDojo must be used within a LandingDojoProvider");
  }
  return context;
}

/**
 * Landing-specific Dojo provider that initializes only system calls for the landing page.
 * This allows using Dojo system calls (like open_loot_chest) on the landing page
 * without requiring the full game bootstrap (no components or live stream).
 */
export function LandingDojoProvider({ children, fallback }: LandingDojoProviderProps) {
  const [systemCalls, setSystemCalls] = useState<SystemCalls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const account = useAccountStore((state) => state.account);

  useEffect(() => {
    let cancelled = false;

    const initializeSystemCalls = async () => {
      try {
        // Create only the provider (no components or live stream).
        const provider = new EternumProvider(
          dojoConfig.manifest as ConstructorParameters<typeof EternumProvider>[0],
          dojoConfig.rpcUrl,
          env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
          undefined,
          { executionResourceBounds: resolveGameTransactionResourceBounds(env.VITE_PUBLIC_CHAIN) },
        );

        if (cancelled) return;

        // Create system calls from the provider
        const calls = createSystemCalls({ provider });

        setSystemCalls(calls);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to initialize system calls for landing:", err);
        setError(err instanceof Error ? err : new Error("Failed to initialize"));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    initializeSystemCalls();

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

  if (error || !systemCalls) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to initialize</p>
          <p className="text-gold/50 text-sm">{error?.message ?? "Unknown error"}</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return fallback ?? null;
  }

  return <LandingDojoContext.Provider value={{ systemCalls, account }}>{children}</LandingDojoContext.Provider>;
}
