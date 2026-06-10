import { useCallback, useEffect, useMemo, useState } from "react";
import { Account } from "starknet";
import type { AccountInterface } from "starknet";

import { useControllerAccount } from "@/hooks/context/use-controller-account";
import { connectWithControllerRetry, pickPrimaryConnector } from "@/hooks/context/controller-connect";
import { useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useCartridgeUsername } from "@/hooks/use-cartridge-username";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { SetupResult } from "@/init/bootstrap";
import { parsePlayRoute } from "@/play/navigation/play-route";
import { getActiveWorld, setActiveWorldName } from "@/runtime/world";
import { useAccount, useConnect } from "@starknet-react/core";

import type { EagerBootstrapState } from "./use-eager-bootstrap";
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

const PLAY_ROUTE_RECONNECT_GRACE_MS = 4000;

type EntrySource = "play-route" | null;

type UnifiedOnboardingState = {
  // Current phase (what UI to show)
  phase: OnboardingPhase;

  // Bootstrap state (may run in background)
  bootstrap: EagerBootstrapState;

  // Account state
  account: Account | AccountInterface | null;
  isConnected: boolean;
  isConnecting: boolean;
  isSpectating: boolean;
  entrySource: EntrySource;
  isDirectPlayRoute: boolean;
  isReconnectRequired: boolean;

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

const resolveUnifiedOnboardingPhase = ({
  selectedWorldName,
  connected,
  isSpectating,
  showBlankOverlay,
  bootstrapStatus,
  hasCompletedAvatar,
  isDirectPlayRoute,
  hasResolvedAccount,
}: {
  selectedWorldName: string | null;
  connected: boolean;
  isSpectating: boolean;
  showBlankOverlay: boolean;
  bootstrapStatus: EagerBootstrapState["status"];
  hasCompletedAvatar: boolean;
  isDirectPlayRoute: boolean;
  hasResolvedAccount: boolean;
}): OnboardingPhase => {
  if (!selectedWorldName) {
    return "world-select";
  }

  if (isDirectPlayRoute && !isSpectating && !hasResolvedAccount) {
    return "loading";
  }

  if (!isDirectPlayRoute && !connected && !isSpectating && showBlankOverlay) {
    return "account";
  }

  if (!isDirectPlayRoute && connected && !isSpectating && !hasCompletedAvatar && showBlankOverlay) {
    return "avatar";
  }

  if (bootstrapStatus !== "ready" && bootstrapStatus !== "error") {
    if (!isDirectPlayRoute && !connected && !isSpectating) {
      return "account";
    }

    return "loading";
  }

  if (bootstrapStatus === "error") {
    return "loading";
  }

  if (showBlankOverlay && (connected || isSpectating)) {
    return "settlement";
  }

  return "ready";
};

const NULL_ACCOUNT = {
  address: "0x0",
  privateKey: "0x0",
} as const;

export const useUnifiedOnboarding = (_backgroundImage: string): UnifiedOnboardingState => {
  const bootstrap = useEagerBootstrap();
  const urlPlayRoute = typeof window !== "undefined" ? parsePlayRoute(window.location) : null;
  const entrySource: EntrySource = urlPlayRoute ? "play-route" : null;
  const isDirectPlayRoute = entrySource === "play-route";

  // Account state from starknet-react
  const { isConnected, isConnecting } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const controllerAccount = useControllerAccount();
  const setAccountName = useAccountStore((state) => state.setAccountName);
  const { username: cartridgeUsername } = useCartridgeUsername();

  // UI state
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const setShowBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  // Check URL for spectate mode
  const urlSpectateMode = urlPlayRoute?.spectate ?? false;

  // Local state - initialize isSpectating from URL param
  const [isSpectating, setIsSpectating] = useState(urlSpectateMode);
  const [selectedWorldName, setSelectedWorldName] = useState<string | null>(() => {
    return urlPlayRoute?.worldName ?? getActiveWorld()?.name ?? null;
  });
  const [placeholderAccount, setPlaceholderAccount] = useState<Account | null>(null);
  const [hasCompletedAvatar, setHasCompletedAvatar] = useState(false);
  const [hasReconnectGraceElapsed, setHasReconnectGraceElapsed] = useState(false);

  // If URL has spectate param and we have a world, auto-trigger spectate mode
  useEffect(() => {
    if (urlSpectateMode && selectedWorldName && !isSpectating) {
      console.log("[useUnifiedOnboarding] Auto-enabling spectate mode from URL param");
      setIsSpectating(true);
    }
  }, [urlSpectateMode, selectedWorldName, isSpectating]);

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

  // World changes flow through the shared bootstrap reset path, so route-driven
  // entry can recover without relying on a browser reload.

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

    const primaryConnector = pickPrimaryConnector(connectors);
    if (!primaryConnector) {
      console.error("Unable to connect wallet: no connectors available");
      return;
    }

    void connectWithControllerRetry(connectAsync, primaryConnector).catch((error) => {
      console.error("Unable to connect wallet:", error);
    });
  }, [connectAsync, connectors, isConnected, isConnecting]);

  const spectate = useCallback(() => {
    console.log("[useUnifiedOnboarding] spectate() called");
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
  const hasResolvedAccount = resolvedAccount !== null;
  const shouldTrackReconnectGrace = isDirectPlayRoute && !isSpectating && !hasResolvedAccount;

  useEffect(() => {
    if (!shouldTrackReconnectGrace) {
      setHasReconnectGraceElapsed(false);
      return;
    }

    setHasReconnectGraceElapsed(false);
    const timeoutId = window.setTimeout(() => {
      setHasReconnectGraceElapsed(true);
    }, PLAY_ROUTE_RECONNECT_GRACE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldTrackReconnectGrace, urlPlayRoute?.chain, urlPlayRoute?.worldName, urlPlayRoute?.scene]);

  const isReconnectRequired = shouldTrackReconnectGrace && hasReconnectGraceElapsed;

  // Determine current phase
  const phase: OnboardingPhase = useMemo(() => {
    console.log("[useUnifiedOnboarding] Calculating phase:", {
      selectedWorldName,
      connected,
      isSpectating,
      showBlankOverlay,
      bootstrapStatus: bootstrap.status,
      hasCompletedAvatar,
      isDirectPlayRoute,
      hasResolvedAccount,
    });
    const nextPhase = resolveUnifiedOnboardingPhase({
      selectedWorldName,
      connected,
      isSpectating,
      showBlankOverlay,
      bootstrapStatus: bootstrap.status,
      hasCompletedAvatar,
      isDirectPlayRoute,
      hasResolvedAccount,
    });

    console.log(`[useUnifiedOnboarding] -> ${nextPhase}`);
    return nextPhase;
  }, [
    selectedWorldName,
    connected,
    isSpectating,
    showBlankOverlay,
    bootstrap.status,
    hasCompletedAvatar,
    isDirectPlayRoute,
    hasResolvedAccount,
  ]);

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
    entrySource,
    isDirectPlayRoute,
    isReconnectRequired,
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
