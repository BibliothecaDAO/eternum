import { useGameSelector } from "@/hooks/helpers/use-game-selector";
import { useSpectatorModeClick } from "@/hooks/helpers/use-navigate";
import { useSetAddressName } from "@/hooks/helpers/use-set-address-name";
import Button from "@/ui/design-system/atoms/button";
import { ENTRY_TOKEN_LOCK_ID, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ControllerConnector } from "@cartridge/connector";
import { cairoShortStringToFelt } from "@dojoengine/torii-wasm";
import { useAccount } from "@starknet-react/core";
import { motion } from "framer-motion";
import { AlertCircle, Globe, Home } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env } from "../../../../../../env";
import {
  DevOptions,
  GameActiveState,
  HyperstructureForge,
  NoGameState,
  PrizePoolDisplay,
  RegistrationState,
} from "../blitz/components";
import { FactoryGamesList } from "../blitz/factory";
import { GameState, RegistrationStage } from "../blitz/types";
import { SpectateButton } from "../spectate-button";
import { useBlitzGameState, useEntryTokens, useSettlement } from "./hooks";
import { downloadPaymasterActionsJson } from "./paymaster-actions";

const getBlitzHyperstructureCountForChain = (chain: string): number => {
  return chain === "mainnet" ? 1 : 4;
};

export const BlitzOnboarding = () => {
  const navigate = useNavigate();
  const { activeWorld, selectGame } = useGameSelector();
  const { setup } = useDojo();
  const {
    account: { account },
    systemCalls: { blitz_realm_register, blitz_realm_make_hyperstructures },
  } = setup;

  const { connector } = useAccount();
  const [addressNameFelt, setAddressNameFelt] = useState<string>("");
  const addressNameKeyRef = useRef<string | null>(null);
  const [isDownloadingActions, setIsDownloadingActions] = useState(false);
  const [registrationStage, setRegistrationStage] = useState<RegistrationStage>("idle");
  const availableEntryTokenIdsRef = useRef<bigint[]>([]);

  // Custom hooks for state management
  const {
    gameState,
    blitzConfig,
    blitzNumHyperStructuresLeft,
    seasonConfig,
    devMode,
    registrationCount,
    canMakeHyperstructures,
  } = useBlitzGameState();

  const entryTokens = useEntryTokens(account);
  const settlement = useSettlement(account);

  // Keep ref updated with latest available token IDs for polling
  useEffect(() => {
    availableEntryTokenIdsRef.current = entryTokens.availableEntryTokenIds;
  }, [entryTokens.availableEntryTokenIds]);

  // Setup address name from controller
  useSetAddressName(setup, settlement.hasSettled ? account : null, connector);
  const onSpectatorModeClick = useSpectatorModeClick(setup);

  // Get username from controller
  useEffect(() => {
    if (!connector) return;

    const currentAddress = account?.address ?? null;
    if (addressNameFelt && addressNameKeyRef.current === currentAddress) {
      return;
    }

    const setAddressName = (nextValue: string) => {
      setAddressNameFelt((previous) => (previous === nextValue ? previous : nextValue));
      addressNameKeyRef.current = currentAddress;
    };

    const getUsername = async () => {
      try {
        const username = await (connector as unknown as ControllerConnector)?.username();
        if (username) {
          setAddressName(cairoShortStringToFelt(username.slice(0, 31)));
          return;
        }
      } catch {
        console.log("No username found in controller account");
      }

      try {
        if ((await connector?.chainId()) === 82743958523457n) {
          setAddressName("labubu");
        }
      } catch {
        console.log("Unable to read controller chainId");
      }
    };
    void getUsername();
  }, [account?.address, addressNameFelt, connector]);

  // Helper to wait for entry token to appear
  const waitForEntryToken = useCallback(async (): Promise<bigint | null> => {
    const maxAttempts = 30;
    const pollInterval = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await entryTokens.loadAvailableEntryTokens();
      // Use ref to get fresh value after state update
      if (availableEntryTokenIdsRef.current.length > 0) {
        return availableEntryTokenIdsRef.current[0];
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
    return null;
  }, [entryTokens.loadAvailableEntryTokens]);

  // Combined registration handler - obtain token (if needed) then register
  const handleRegister = useCallback(async () => {
    if (!account?.address) return;

    try {
      if (entryTokens.requiresEntryToken && blitzConfig) {
        let tokenIdToUse: bigint | null = entryTokens.availableEntryTokenIds[0] ?? null;

        // Step 1: Obtain entry token if we don't have one
        if (!tokenIdToUse) {
          setRegistrationStage("obtaining-token");
          await entryTokens.obtainEntryToken();

          // Step 2: Wait for the token to appear on-chain
          setRegistrationStage("waiting-for-token");
          const obtainedTokenId = await waitForEntryToken();

          if (!obtainedTokenId) {
            throw new Error("Failed to obtain entry token. Please try again.");
          }
          tokenIdToUse = obtainedTokenId;
        }

        // Step 3: Register with the token
        setRegistrationStage("registering");
        await blitz_realm_register({
          signer: account,
          name: addressNameFelt,
          tokenId: Number(tokenIdToUse),
          entryTokenAddress: toHexString(blitzConfig.entry_token_address),
          lockId: ENTRY_TOKEN_LOCK_ID,
        });

        entryTokens.refetchEntryTokenBalance?.();
        entryTokens.refetchFeeTokenBalance?.();
      } else {
        // No token required - just register
        setRegistrationStage("registering");
        await blitz_realm_register({ signer: account, name: addressNameFelt, tokenId: 0 });
      }

      setRegistrationStage("done");
    } catch (error) {
      console.error("Registration failed:", error);
      setRegistrationStage("error");
    }
  }, [account, addressNameFelt, blitzConfig, blitz_realm_register, entryTokens, waitForEntryToken]);

  const handleMakeHyperstructures = async () => {
    if (!account?.address) return;
    const hyperstructureCount = getBlitzHyperstructureCountForChain(env.VITE_PUBLIC_CHAIN);
    await blitz_realm_make_hyperstructures({ count: hyperstructureCount, signer: account });
  };

  const handleSelectGame = async () => {
    await selectGame();
  };

  const handleDownloadActionsJson = async () => {
    setIsDownloadingActions(true);
    try {
      downloadPaymasterActionsJson();
    } catch (error) {
      console.error("Failed to download paymaster actions JSON", error);
    } finally {
      setIsDownloadingActions(false);
    }
  };

  // Config error state
  if (!blitzConfig) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brown/10 border border-brown/30 rounded-lg p-6 text-center space-y-4"
      >
        <AlertCircle className="w-12 h-12 mx-auto text-gold/50" />
        <div>
          <h3 className="text-lg font-bold text-gold mb-2">Configuration Error</h3>
          <p className="text-gold/70">Unable to load Blitz game configuration.</p>
          <p className="text-gold/70 text-sm mt-2">Please refresh the page or contact support if the issue persists.</p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          forceUppercase={false}
          className="!bg-gold !text-brown rounded-md"
        >
          Refresh Page
        </Button>
      </motion.div>
    );
  }

  const { registration_start_at, registration_end_at } = blitzConfig;

  return (
    <div className="space-y-6">
      {/* Navigation header */}
      <div className="flex justify-between items-center -mb-2">
        <Button
          onClick={() => navigate("/")}
          variant="outline"
          size="xs"
          className="!px-3 !py-1.5"
          forceUppercase={false}
        >
          <div className="flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </div>
        </Button>

        <Button onClick={handleSelectGame} variant="outline" size="xs" className="!px-3 !py-1.5" forceUppercase={false}>
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            <span>{activeWorld || "Select Game"}</span>
          </div>
        </Button>
      </div>

      {/* Active world display */}
      {activeWorld && (
        <div className="text-center mt-1 mb-1">
          <div className="text-gold text-lg font-extrabold tracking-wide">{activeWorld}</div>
          <div className="mt-3 flex justify-center">
            <div className="w-full max-w-xs">
              <SpectateButton onClick={onSpectatorModeClick} />
            </div>
          </div>
        </div>
      )}

      {/* Game Active State */}
      {(gameState === GameState.GAME_ACTIVE || devMode) && (
        <GameActiveState
          isRegistered={settlement.isRegistered}
          hasSettled={settlement.hasSettled}
          canPlay={settlement.canPlay}
          gameEndAt={seasonConfig?.endAt}
          onSettle={settlement.handleSettle}
          onSpectate={onSpectatorModeClick}
          settleStage={settlement.settleStage}
          assignedRealmCount={settlement.assignedRealmCount}
          settledRealmCount={settlement.settledRealmCount}
          isSettling={settlement.isSettling}
        />
      )}

      {/* Hyperstructure Forge */}
      <HyperstructureForge
        numHyperStructuresLeft={blitzNumHyperStructuresLeft || 0}
        onForge={handleMakeHyperstructures}
        canMake={canMakeHyperstructures}
      />

      {/* Dev Options */}
      {devMode && (
        <DevOptions
          onDevModeRegister={handleRegister}
          onDevModeSettle={settlement.handleSettle}
          onDevModeObtainEntryToken={entryTokens.requiresEntryToken ? entryTokens.obtainEntryToken : undefined}
          devMode={devMode}
        />
      )}

      {/* No Game State */}
      {gameState === GameState.NO_GAME && registration_start_at && (
        <NoGameState
          nextGameStart={registration_start_at}
          onSelectGame={handleSelectGame}
          onSpectate={onSpectatorModeClick}
        />
      )}

      {/* Registration State */}
      {gameState === GameState.REGISTRATION && (
        <RegistrationState
          registrationCount={registrationCount}
          registrationEndAt={registration_end_at}
          isRegistered={settlement.isRegistered}
          onRegister={handleRegister}
          requiresEntryToken={entryTokens.requiresEntryToken}
          registrationStage={registrationStage}
          feeAmount={entryTokens.feeAmount}
          feeTokenSymbol={entryTokens.feeTokenSymbol}
        />
      )}

      {/* Prize Pool Display - mainnet only */}
      <PrizePoolDisplay />

      {/* Factory Games List */}
      <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
        <p className="text-sm text-gold/70 mb-3">Factory Games</p>
        <FactoryGamesList maxHeight="350px" />
      </div>

      <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
        <p className="text-sm text-gold/70 mb-3">Tools</p>
        <Button
          onClick={handleDownloadActionsJson}
          disabled={isDownloadingActions}
          forceUppercase={false}
          className="w-full h-10 !text-brown !bg-gold/80 hover:!bg-gold rounded-md"
        >
          {isDownloadingActions ? "Preparing actions JSON…" : "Download actions JSON"}
        </Button>
      </div>
    </div>
  );
};
