import { useCallback, useEffect, useMemo, useState } from "react";
import { Account } from "starknet";
import type { AccountInterface } from "starknet";

import { useControllerAccount } from "@/hooks/context/use-controller-account";
import { useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { SetupResult } from "@/init/bootstrap";
import { getActiveWorld, setActiveWorldName } from "@/runtime/world";
import { useAccount, useConnect } from "@starknet-react/core";

import type { BootstrapTask, EagerBootstrapState } from "./use-eager-bootstrap";
import { useEagerBootstrap } from "./use-eager-bootstrap";

/**
 * The phase represents what the USER needs to do or see,
 * not necessarily what's happening in the background.
 */
export type OnboardingPhase =
  | "world-select" // User needs to pick a world
  | "account" // User needs to connect wallet (bootstrap may be running in background)
  | "loading" // Bootstrap is blocking, show progress
  | "settlement" // User picks realm/blitz setup (bootstrap complete, account connected)
  | "ready"; // All done, can enter game

export type UnifiedOnboardingState = {
  // Current phase (what UI to show)
  phase: OnboardingPhase;

  // Bootstrap state (may run in background)
  bootstrap: EagerBootstrapState;

  // Account state
  account: Account | AccountInterface | null;
  isConnected: boolean;
  isConnecting: boolean;
  isSpectating: boolean;

  // World state
  hasSelectedWorld: boolean;
  selectedWorldName: string | null;

  // Actions
  selectWorld: (worldName: string) => void;
  connectWallet: () => void;
  spectate: () => void;

  // Ready state
  canEnterGame: boolean;
  setupResult: SetupResult | null;
};

const NULL_ACCOUNT = {
  address: "0x0",
  privateKey: "0x0",
} as const;

export const useUnifiedOnboarding = (_backgroundImage: string): UnifiedOnboardingState => {
  const bootstrap = useEagerBootstrap();

  // Account state from starknet-react
  const { isConnected, isConnecting, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const controllerAccount = useControllerAccount();
  const setAccountName = useAccountStore((state) => state.setAccountName);

  // UI state
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  // Local state
  const [isSpectating, setIsSpectating] = useState(false);
  const [selectedWorldName, setSelectedWorldName] = useState<string | null>(() => {
    const active = getActiveWorld();
    return active?.name ?? null;
  });
  const [placeholderAccount, setPlaceholderAccount] = useState<Account | null>(null);

  // Spectator navigation
  const spectatorNavigate = useSpectatorModeClick(bootstrap.setupResult);

  // Create placeholder account when setup is ready (for spectator mode)
  useEffect(() => {
    if (!bootstrap.setupResult) {
      setPlaceholderAccount(null);
      return;
    }

    setPlaceholderAccount((current) => {
      if (current) return current;

      return new Account({
        provider: bootstrap.setupResult!.network.provider.provider,
        address: NULL_ACCOUNT.address,
        signer: NULL_ACCOUNT.privateKey,
      });
    });
  }, [bootstrap.setupResult]);

  // Resolve username from connector
  useEffect(() => {
    if (!connector) return;

    const resolveUsername = async () => {
      try {
        const maybeConnector = connector as unknown as { username?: () => Promise<string | undefined> };
        const username = await maybeConnector.username?.();
        if (username) {
          setAccountName(username);
        }
      } catch (error) {
        console.error("Failed to load controller username", error);
      }
    };

    void resolveUsername();
  }, [connector, setAccountName]);

  // Note: World change detection is handled by bootstrap.tsx which triggers a page reload
  // This avoids complex state cleanup and ensures a clean re-bootstrap

  // Actions
  const selectWorld = useCallback(
    (worldName: string) => {
      setActiveWorldName(worldName);
      setSelectedWorldName(worldName);
      // Trigger bootstrap to start if it was waiting
      bootstrap.startBootstrap();
    },
    [bootstrap],
  );

  const connectWallet = useCallback(() => {
    if (isConnected || isConnecting) return;

    const primaryConnector = connectors[0];
    if (!primaryConnector) {
      console.error("Unable to connect wallet: no connectors available");
      return;
    }

    connect({ connector: primaryConnector });
  }, [connect, connectors, isConnected, isConnecting]);

  const spectate = useCallback(() => {
    setIsSpectating(true);
    spectatorNavigate();
    setShowBlankOverlay(false);
  }, [spectatorNavigate, setShowBlankOverlay]);

  // Determine resolved account
  const resolvedAccount = useMemo(() => {
    if (isSpectating && placeholderAccount) {
      return placeholderAccount;
    }
    return controllerAccount ?? null;
  }, [controllerAccount, isSpectating, placeholderAccount]);

  // Normalize boolean values (starknet-react may return undefined)
  const connected = isConnected === true;
  const connecting = isConnecting === true;

  // Determine current phase
  const phase: OnboardingPhase = useMemo(() => {
    // 1. No world selected - must select world first
    if (!selectedWorldName) {
      return "world-select";
    }

    // 2. World selected but not connected and not spectating
    //    Show account panel, bootstrap runs in background
    if (!connected && !isSpectating && showBlankOverlay) {
      return "account";
    }

    // 3. Bootstrap still loading - show loading if it's blocking
    //    (Connected/spectating but bootstrap not ready)
    if (bootstrap.status !== "ready" && bootstrap.status !== "error") {
      // If we're in account phase, stay there while bootstrap runs in background
      if (!connected && !isSpectating) {
        return "account";
      }
      return "loading";
    }

    // 4. Bootstrap errored
    if (bootstrap.status === "error") {
      return "loading"; // Show error in loading panel
    }

    // 5. Bootstrap ready, show onboarding/settlement if needed
    if (showBlankOverlay && (connected || isSpectating)) {
      return "settlement";
    }

    // 6. All done
    return "ready";
  }, [selectedWorldName, connected, isSpectating, showBlankOverlay, bootstrap.status]);

  // Can enter game check
  const canEnterGame = useMemo(() => {
    return (
      bootstrap.status === "ready" &&
      bootstrap.setupResult !== null &&
      (connected || isSpectating) &&
      resolvedAccount !== null
    );
  }, [bootstrap.status, bootstrap.setupResult, connected, isSpectating, resolvedAccount]);

  return {
    phase,
    bootstrap,
    account: resolvedAccount,
    isConnected: connected,
    isConnecting: connecting,
    isSpectating,
    hasSelectedWorld: selectedWorldName !== null,
    selectedWorldName,
    selectWorld,
    connectWallet,
    spectate,
    canEnterGame,
    setupResult: bootstrap.setupResult,
  };
};

export type { BootstrapTask };
