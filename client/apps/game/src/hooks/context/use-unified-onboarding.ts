import { useCallback, useEffect, useMemo, useState } from "react";
import { Account } from "starknet";
import type { AccountInterface } from "starknet";

import { useControllerAccount } from "@/hooks/context/use-controller-account";
import { useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useCartridgeUsername } from "@/hooks/use-cartridge-username";
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
  | "avatar" // User can create a personalized avatar (optional)
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
  completeAvatar: () => void;

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
  const { isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const controllerAccount = useControllerAccount();
  const setAccountName = useAccountStore((state) => state.setAccountName);
  const { username: cartridgeUsername } = useCartridgeUsername();

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
  const [hasCompletedAvatar, setHasCompletedAvatar] = useState(false);

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

  useEffect(() => {
    if (cartridgeUsername) {
      setAccountName(cartridgeUsername);
    }
  }, [cartridgeUsername, setAccountName]);

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

  const completeAvatar = useCallback(() => {
    setHasCompletedAvatar(true);
  }, []);

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

    // 2.5. Connected but haven't completed avatar creation (optional step)
    //      Only show avatar phase if connected (not spectating) and haven't completed it yet
    if (connected && !isSpectating && !hasCompletedAvatar && showBlankOverlay) {
      return "avatar";
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
  }, [selectedWorldName, connected, isSpectating, showBlankOverlay, bootstrap.status, hasCompletedAvatar]);

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
    completeAvatar,
    canEnterGame,
    setupResult: bootstrap.setupResult,
  };
};

export type { BootstrapTask };
