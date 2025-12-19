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
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env } from "../../../../../../env";
import { DevOptions, GameActiveState, HyperstructureForge, NoGameState, RegistrationState } from "../blitz/components";
import { FactoryGamesList } from "../blitz/factory";
import { useBlitzGameState, useEntryTokens, useSettlement } from "../blitz/hooks";
import { GameState } from "../blitz/types";
import { SpectateButton } from "../spectate-button";

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

  // Setup address name from controller
  useSetAddressName(setup, settlement.hasSettled ? account : null, connector);
  const onSpectatorModeClick = useSpectatorModeClick(setup);

  // Get username from controller
  useEffect(() => {
    const getUsername = async () => {
      try {
        const username = await (connector as unknown as ControllerConnector)?.username();
        if (username) {
          setAddressNameFelt(cairoShortStringToFelt(username.slice(0, 31)));
        }
      } catch {
        console.log("No username found in controller account");
        if ((await connector?.chainId()) === 82743958523457n) {
          setAddressNameFelt("labubu");
        }
      }
    };
    getUsername();
  }, [connector]);

  // Registration handler
  const handleRegister = async () => {
    if (!account?.address) return;

    if (entryTokens.requiresEntryToken && blitzConfig) {
      const tokenIdToUse =
        entryTokens.selectedEntryTokenId ??
        (entryTokens.availableEntryTokenIds.length > 0 ? entryTokens.availableEntryTokenIds[0] : null);
      if (!tokenIdToUse) {
        throw new Error("No entry token available. Obtain one before registering.");
      }

      await blitz_realm_register({
        signer: account,
        name: addressNameFelt,
        tokenId: Number(tokenIdToUse),
        entryTokenAddress: toHexString(blitzConfig.entry_token_address),
        lockId: ENTRY_TOKEN_LOCK_ID,
      });

      entryTokens.refetchEntryTokenBalance?.();
      entryTokens.refetchFeeTokenBalance?.();
      return;
    }

    await blitz_realm_register({ signer: account, name: addressNameFelt, tokenId: 0 });
  };

  const handleMakeHyperstructures = async () => {
    if (!account?.address) return;
    const hyperstructureCount = getBlitzHyperstructureCountForChain(env.VITE_PUBLIC_CHAIN);
    await blitz_realm_make_hyperstructures({ count: hyperstructureCount, signer: account });
  };

  const handleSelectGame = async () => {
    await selectGame();
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
          entryTokenBalance={entryTokens.entryTokenBalance}
          registrationCount={registrationCount}
          registrationEndAt={registration_end_at}
          isRegistered={settlement.isRegistered}
          onRegister={handleRegister}
          requiresEntryToken={entryTokens.requiresEntryToken}
          onObtainEntryToken={entryTokens.requiresEntryToken ? entryTokens.obtainEntryToken : undefined}
          isObtainingEntryToken={entryTokens.entryTokenStatus === "minting"}
          availableEntryTokenIds={entryTokens.availableEntryTokenIds}
          entryTokenStatus={entryTokens.entryTokenStatus}
          hasSufficientFeeBalance={entryTokens.hasSufficientFeeBalance}
          isFeeBalanceLoading={entryTokens.isFeeBalanceLoading}
          isLoadingEntryTokens={entryTokens.isLoadingEntryTokens}
          feeAmount={entryTokens.feeAmount}
          feeTokenBalance={entryTokens.feeTokenBalance}
          feeTokenSymbol={entryTokens.feeTokenSymbol}
        />
      )}

      {/* Factory Games List */}
      <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
        <p className="text-sm text-gold/70 mb-3">Factory Games</p>
        <FactoryGamesList maxHeight="350px" />
      </div>
    </div>
  );
};
