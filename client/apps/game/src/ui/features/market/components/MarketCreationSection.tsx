import { AlertCircle, Check, Plus, RefreshCw, Users } from "lucide-react";
import { useMemo } from "react";

import Button from "@/ui/design-system/atoms/button";

import { useQuickMarketCreate, type MarketPlayer } from "../hooks/use-quick-market-create";

/**
 * Format LORDS balance for display.
 */
const formatLordsBalance = (balance: bigint): string => {
  // LORDS has 18 decimals
  const wholePart = balance / 10n ** 18n;
  const fracPart = (balance % 10n ** 18n) / 10n ** 16n; // 2 decimal places
  if (fracPart === 0n) return wholePart.toString();
  return `${wholePart}.${fracPart.toString().padStart(2, "0")}`;
};

/**
 * Format timestamp to readable date string.
 */
const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface MarketCreationSectionProps {
  worldName: string | null;
  oracleAddress: string | null;
  gameEndTime: number | null;
  onRefresh: () => void;
  /** Called when a market is discovered (either via polling or pre-creation check) */
  onMarketFound?: () => void;
}

/**
 * Player selection item component with editable weight and % chance.
 */
const PlayerSelectionItem = ({
  player,
  isSelected,
  oddsWeight,
  chancePercent,
  onToggle,
  onWeightChange,
  disabled,
}: {
  player: MarketPlayer;
  isSelected: boolean;
  oddsWeight: number;
  chancePercent: number;
  onToggle: () => void;
  onWeightChange: (weight: number) => void;
  disabled: boolean;
}) => {
  const displayName = player.name || `${player.address.slice(0, 6)}...${player.address.slice(-4)}`;

  return (
    <div
      className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs transition ${
        isSelected
          ? "border-gold/60 bg-gold/20 text-white"
          : disabled
            ? "cursor-not-allowed border-white/5 bg-white/5 text-gold/30"
            : "border-white/10 bg-white/5 text-gold/70 hover:border-gold/30 hover:bg-gold/10"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled && !isSelected}
        className="flex items-center gap-2 overflow-hidden"
      >
        <div
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border ${
            isSelected ? "border-gold bg-gold" : "border-white/30 bg-transparent"
          }`}
        >
          {isSelected && <Check className="h-3 w-3 text-black" />}
        </div>
        <span className="truncate">{displayName}</span>
      </button>
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className={`text-[10px] font-medium ${isSelected ? "text-progress-bar-good" : "text-gold/40"}`}>
          {chancePercent.toFixed(1)}%
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gold/60">wt:</span>
          <input
            type="number"
            min="1"
            max="100"
            value={oddsWeight}
            onChange={(e) => onWeightChange(parseInt(e.target.value) || 1)}
            onClick={(e) => e.stopPropagation()}
            disabled={!isSelected}
            className={`w-10 rounded border bg-black/40 px-1 py-0.5 text-center text-[10px] outline-none ${
              isSelected
                ? "border-white/20 text-gold/80 focus:border-gold/60"
                : "cursor-not-allowed border-white/10 text-gold/30"
            }`}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Amount input component for LORDS funding.
 */
const FundingAmountInput = ({
  amount,
  setAmount,
  minAmount,
  balance,
  isValid,
}: {
  amount: string;
  setAmount: (val: string) => void;
  minAmount: number;
  balance: bigint;
  isValid: boolean;
}) => {
  const balanceNum = Number(balance / 10n ** 18n);

  const addToAmount = (toAdd: number) => {
    const current = parseFloat(amount) || 0;
    const total = Math.min(current + toAdd, balanceNum);
    setAmount(total.toString());
  };

  const quickAddButtonClass =
    "rounded-sm border border-white/20 bg-white/5 px-1.5 py-[2px] text-[10px] font-semibold text-gold/80 transition hover:border-gold/60 hover:bg-gold/10 hover:text-gold disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-xs text-gold/70">
      <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-gold/60">
        <span>Initial Liquidity (LORDS)</span>
        <span className="text-gold/50">Min: {minAmount}</span>
      </div>
      <input
        type="number"
        min={minAmount}
        step="100"
        className={`w-full rounded-md border bg-black/40 px-2 py-1.5 text-base text-white outline-none ${
          isValid ? "border-white/10 focus:border-gold/60" : "border-danger/50 focus:border-danger"
        }`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-gold/60">
        <span className="flex-shrink-0">Balance: {formatLordsBalance(balance)}</span>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={quickAddButtonClass}
            onClick={() => addToAmount(100)}
            disabled={balanceNum <= 0 || parseFloat(amount) >= balanceNum}
          >
            +100
          </button>
          <button
            type="button"
            className={quickAddButtonClass}
            onClick={() => addToAmount(1000)}
            disabled={balanceNum <= 0 || parseFloat(amount) >= balanceNum}
          >
            +1k
          </button>
          <button
            type="button"
            className={quickAddButtonClass}
            onClick={() => addToAmount(5000)}
            disabled={balanceNum <= 0 || parseFloat(amount) >= balanceNum}
          >
            +5k
          </button>
          <button
            type="button"
            className="rounded-sm border border-gold/40 bg-gold/10 px-1.5 py-[2px] text-[10px] font-semibold text-gold transition hover:border-gold/60 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setAmount(balanceNum.toString())}
            disabled={balanceNum <= 0}
          >
            MAX
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Market creation UI shown when no market exists for the current game.
 * Handles player selection, funding amount, and creation.
 */
export const MarketCreationSection = ({
  worldName,
  oracleAddress,
  gameEndTime,
  onRefresh,
  onMarketFound,
}: MarketCreationSectionProps) => {
  // Use onRefresh as the default handler for onMarketFound (will refresh and show existing market)
  const handleMarketFound = onMarketFound ?? onRefresh;

  const {
    createMarket,
    isCreating,
    canCreate,
    loadingPlayers,
    playerError,
    createError,
    allPlayers,
    selectedPlayers,
    togglePlayerSelection,
    selectionComplete,
    minSelectedPlayers,
    maxSelectedPlayers,
    fundingAmount,
    setFundingAmount,
    minFundingAmount,
    isFundingValid,
    balance,
    isBalanceLoading,
    getPlayerOddsWeight,
    getPlayerChancePercent,
    setPlayerWeight,
    noneWeight,
    setNoneWeight,
    noneChancePercent,
    preconditions,
  } = useQuickMarketCreate(worldName, oracleAddress, gameEndTime, handleMarketFound);

  // Determine status message for market creation
  const statusMessage = useMemo(() => {
    if (loadingPlayers) return "Loading registered players...";
    if (playerError) return playerError;
    if (!preconditions.hasOracleAddress) return "Resolving game oracle...";
    if (!preconditions.hasPlayers) return "No players registered yet";
    if (!preconditions.hasWallet) return "Connect wallet to create";
    if (!preconditions.hasGameEndTime) return "Game end time not available or game has ended";
    if (!preconditions.hasValidSelection) {
      if (selectedPlayers.length === 0) {
        return `Select ${minSelectedPlayers}-${maxSelectedPlayers} players`;
      }
      return `Select ${minSelectedPlayers}-${maxSelectedPlayers} players (${selectedPlayers.length} selected)`;
    }
    if (!preconditions.hasValidFunding) return `Minimum funding: ${minFundingAmount} LORDS`;
    if (isBalanceLoading) return "Checking balance...";
    if (!preconditions.hasSufficientBalance) {
      return `Insufficient balance: ${formatLordsBalance(balance)} LORDS`;
    }
    return null;
  }, [
    loadingPlayers,
    playerError,
    preconditions,
    isBalanceLoading,
    balance,
    selectedPlayers.length,
    minFundingAmount,
    minSelectedPlayers,
    maxSelectedPlayers,
  ]);

  // No oracle address means we can't create a market
  if (!oracleAddress && !loadingPlayers) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <div className="text-center text-sm text-gold/70">
          <p className="mb-2">Cannot resolve oracle address for this game.</p>
          <p className="text-xs text-gold/50">The game may not support prediction markets yet.</p>
          <Button size="xs" variant="outline" className="mt-4" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  // Limit reached for selection
  const selectionLimitReached = selectedPlayers.length >= maxSelectedPlayers;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* Header */}
        <div className="text-center">
          <h3 className="mb-0.5 text-sm font-semibold">Create Prediction Market</h3>
          <p className="text-xs text-gold/60">Who will win this game?</p>
        </div>

        {/* Time Info */}
        {gameEndTime && (
          <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-gold/60">
            <div className="flex items-center justify-between">
              <span>Trading ends:</span>
              <span className="text-gold/80">{formatTimestamp(gameEndTime)}</span>
            </div>
          </div>
        )}

        {/* Player Selection Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gold/80">
              <Users className="h-3.5 w-3.5" />
              <span>
                Players ({selectedPlayers.length}/{maxSelectedPlayers} max)
              </span>
            </div>
            <span className={`text-[10px] ${selectionComplete ? "text-progress-bar-good" : "text-gold/50"}`}>
              {selectionComplete ? "Ready" : `Select ${minSelectedPlayers}-${maxSelectedPlayers}`}
            </span>
          </div>

          {loadingPlayers ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-4 w-4 animate-spin text-gold/50" />
              <span className="ml-2 text-xs text-gold/50">Loading players...</span>
            </div>
          ) : allPlayers.length === 0 ? (
            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-center text-xs text-gold/50">
              No players registered yet
            </div>
          ) : (
            <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border border-white/10 bg-black/40 p-2">
              {allPlayers.map((player) => {
                const isSelected = selectedPlayers.some((p) => p.address === player.address);
                return (
                  <PlayerSelectionItem
                    key={player.address}
                    player={player}
                    isSelected={isSelected}
                    oddsWeight={getPlayerOddsWeight(player)}
                    chancePercent={getPlayerChancePercent(player)}
                    onToggle={() => togglePlayerSelection(player)}
                    onWeightChange={(weight) => setPlayerWeight(player.address, weight)}
                    disabled={selectionLimitReached && !isSelected}
                  />
                );
              })}

              {/* "None of the above" option - always shown when players exist */}
              <div className="mt-2 border-t border-white/10 pt-2">
                <div className="flex w-full items-center justify-between rounded-md border border-gold/40 bg-gold/10 px-2 py-1.5 text-xs">
                  <span className="text-gold/80">None of the above</span>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-[10px] font-medium text-progress-bar-good">
                      {noneChancePercent.toFixed(1)}%
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gold/60">wt:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={noneWeight}
                        onChange={(e) => setNoneWeight(parseInt(e.target.value) || 1)}
                        className="w-10 rounded border border-white/20 bg-black/40 px-1 py-0.5 text-center text-[10px] text-gold/80 outline-none focus:border-gold/60"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Funding Amount Input */}
        {preconditions.hasWallet && (
          <FundingAmountInput
            amount={fundingAmount}
            setAmount={setFundingAmount}
            minAmount={minFundingAmount}
            balance={balance}
            isValid={isFundingValid}
          />
        )}

        {/* Selected Players Summary */}
        {selectedPlayers.length > 0 && (
          <div className="rounded-md border border-gold/20 bg-gold/5 p-2 text-[10px]">
            <div className="mb-1 font-medium text-gold/70">Selected for market:</div>
            <div className="flex flex-wrap gap-1">
              {selectedPlayers.map((player) => (
                <span key={player.address} className="rounded-full bg-gold/20 px-2 py-0.5 text-gold/90">
                  {player.name || `${player.address.slice(0, 6)}...`}{" "}
                  <span className="text-progress-bar-good">{getPlayerChancePercent(player).toFixed(1)}%</span>
                </span>
              ))}
              <span className="rounded-full bg-gold/30 px-2 py-0.5 text-gold/90">
                None <span className="text-progress-bar-good">{noneChancePercent.toFixed(1)}%</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Footer */}
      <div className="flex-shrink-0 space-y-2 border-t border-gold/10 bg-black/80 p-3">
        <Button
          onClick={createMarket}
          disabled={!canCreate}
          isLoading={isCreating || loadingPlayers || isBalanceLoading}
          size="md"
          className="w-full"
          forceUppercase={false}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Market
        </Button>

        {/* Status/precondition message */}
        {statusMessage && !isCreating && <p className="text-center text-[10px] text-gold/40">{statusMessage}</p>}

        {/* Creation error display */}
        {createError && !isCreating && (
          <div className="flex items-start gap-2 rounded bg-danger/10 p-2 text-danger/80">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <p className="text-[10px]">{createError}</p>
          </div>
        )}

        <Button size="xs" variant="outline" className="w-full" onClick={onRefresh} forceUppercase={false}>
          <RefreshCw className="mr-2 h-3 w-3" />
          Refresh
        </Button>
      </div>
    </div>
  );
};
