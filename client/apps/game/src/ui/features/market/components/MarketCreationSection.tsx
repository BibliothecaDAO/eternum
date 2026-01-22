import { AlertCircle, Check, ChevronDown, ChevronRight, Plus, RefreshCw, Users } from "lucide-react";
import { useMemo, useState } from "react";

import Button from "@/ui/design-system/atoms/button";
import { Panel } from "@/ui/design-system/atoms/panel";

import { useQuickMarketCreate, type MarketPlayer } from "../hooks/use-quick-market-create";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

/**
 * Format LORDS balance for display.
 */
const formatLordsBalance = (balance: bigint): string => {
  const wholePart = balance / 10n ** 18n;
  const fracPart = (balance % 10n ** 18n) / 10n ** 16n;
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
  onMarketFound?: () => void;
}

/**
 * Collapsible section wrapper for creation steps
 */
const CreationStep = ({
  stepNumber,
  title,
  subtitle,
  isExpanded,
  isComplete,
  isDisabled,
  onToggle,
  children,
}: {
  stepNumber: number;
  title: string;
  subtitle: string;
  isExpanded: boolean;
  isComplete: boolean;
  isDisabled?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <Panel
    tone={isComplete ? "wood" : "neutral"}
    padding="none"
    radius="md"
    border={isComplete ? "subtle" : "subtle"}
    className={cx(
      "overflow-hidden transition-all",
      isDisabled && "opacity-50",
      isComplete && "ring-1 ring-brilliance/20",
    )}
  >
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      className={cx(
        "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors",
        !isDisabled && "hover:bg-gold/5",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Step indicator */}
        <div
          className={cx(
            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
            isComplete ? "bg-brilliance text-brown" : "bg-brown/50 text-gold/60",
          )}
        >
          {isComplete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
        </div>
        <div>
          <p className={cx("text-sm font-semibold", isComplete ? "text-brilliance" : "text-gold")}>{title}</p>
          <p className="text-[10px] text-gold/50">{subtitle}</p>
        </div>
      </div>
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-gold/50" />
      ) : (
        <ChevronRight className="h-4 w-4 text-gold/50" />
      )}
    </button>

    {/* Expandable content */}
    <div
      className={cx(
        "overflow-hidden transition-all duration-200",
        isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
      )}
    >
      <div className="border-t border-gold/10 p-3">{children}</div>
    </div>
  </Panel>
);

/**
 * Grid-based player selection card
 */
const PlayerCard = ({
  player,
  isSelected,
  chancePercent,
  oddsWeight,
  onToggle,
  onWeightChange,
  disabled,
}: {
  player: MarketPlayer;
  isSelected: boolean;
  chancePercent: number;
  oddsWeight: number;
  onToggle: () => void;
  onWeightChange: (weight: number) => void;
  disabled: boolean;
}) => {
  const displayName = player.name || `${player.address.slice(0, 6)}...${player.address.slice(-4)}`;

  return (
    <div
      onClick={disabled && !isSelected ? undefined : onToggle}
      className={cx(
        "relative cursor-pointer rounded-lg border p-2.5 text-center transition-all",
        isSelected
          ? "border-gold/60 bg-gold/15 ring-1 ring-gold/30"
          : disabled
            ? "cursor-not-allowed border-gold/10 bg-brown/30 opacity-50"
            : "border-gold/20 bg-brown/40 hover:border-gold/40 hover:bg-gold/10",
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold">
          <Check className="h-3 w-3 text-brown" />
        </div>
      )}

      {/* Player name */}
      <p className={cx("truncate text-xs font-semibold", isSelected ? "text-gold" : "text-gold/70")}>{displayName}</p>

      {/* Odds display (only when selected) */}
      {isSelected && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-sm font-bold text-brilliance">{chancePercent.toFixed(1)}%</span>
          <input
            type="number"
            min="1"
            max="100"
            value={oddsWeight}
            onChange={(e) => {
              e.stopPropagation();
              onWeightChange(parseInt(e.target.value) || 1);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-12 rounded border border-gold/30 bg-brown/50 px-1.5 py-0.5 text-center text-[10px] text-gold outline-none focus:border-gold/60"
            placeholder="wt"
          />
        </div>
      )}
    </div>
  );
};

/**
 * Funding amount input with quick-add buttons
 */
const FundingInput = ({
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

  return (
    <div className="space-y-3">
      {/* Large centered amount display */}
      <div className="text-center">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={minAmount}
          step="100"
          className={cx(
            "w-full bg-transparent text-center font-cinzel text-3xl text-white outline-none placeholder:text-gold/30",
            !isValid && amount && "text-danger",
          )}
          placeholder="0"
        />
        <span className="text-sm text-gold/50">LORDS</span>
      </div>

      {/* Quick-add buttons */}
      <div className="flex flex-wrap justify-center gap-2">
        {[100, 500, 1000, 5000].map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => addToAmount(val)}
            disabled={balanceNum <= 0 || parseFloat(amount) >= balanceNum}
            className="rounded-md border border-gold/30 bg-brown/50 px-3 py-1.5 text-xs font-medium text-gold transition-colors hover:border-gold/50 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            +{val >= 1000 ? `${val / 1000}k` : val}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmount(balanceNum.toString())}
          disabled={balanceNum <= 0}
          className="rounded-md border border-gold/50 bg-gold/20 px-3 py-1.5 text-xs font-bold text-gold transition-colors hover:bg-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          MAX
        </button>
      </div>

      {/* Balance info */}
      <div className="flex items-center justify-between text-[10px] text-gold/50">
        <span>Balance: {formatLordsBalance(balance)} LORDS</span>
        <span>Min: {minAmount} LORDS</span>
      </div>
    </div>
  );
};

/**
 * Market creation UI with collapsible step-based flow.
 */
export const MarketCreationSection = ({
  worldName,
  oracleAddress,
  gameEndTime,
  onRefresh,
  onMarketFound,
}: MarketCreationSectionProps) => {
  const handleMarketFound = onMarketFound ?? onRefresh;
  const [expandedStep, setExpandedStep] = useState<"players" | "funding" | null>("players");

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

  const statusMessage = useMemo(() => {
    if (loadingPlayers) return "Loading registered players...";
    if (playerError) return playerError;
    if (!preconditions.hasOracleAddress) return "Resolving game oracle...";
    if (!preconditions.hasPlayers) return "No players registered yet";
    if (!preconditions.hasWallet) return "Connect wallet to create";
    if (!preconditions.hasGameEndTime) return "Game end time not available or game has ended";
    if (!preconditions.hasValidSelection) {
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

  const selectionLimitReached = selectedPlayers.length >= maxSelectedPlayers;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* Header */}
        <div className="text-center">
          <h3 className="font-cinzel text-base font-semibold text-gold">Create Prediction Market</h3>
          <p className="text-xs text-gold/50">Who will win this game?</p>
        </div>

        {/* Time Info */}
        {gameEndTime && (
          <Panel tone="neutral" padding="sm" radius="md" className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-gold/50">Trading ends</p>
            <p className="font-cinzel text-sm text-gold">{formatTimestamp(gameEndTime)}</p>
          </Panel>
        )}

        {/* Step 1: Player Selection */}
        <CreationStep
          stepNumber={1}
          title="Select Players"
          subtitle={`${selectedPlayers.length}/${maxSelectedPlayers} selected`}
          isExpanded={expandedStep === "players"}
          isComplete={selectionComplete}
          onToggle={() => setExpandedStep(expandedStep === "players" ? null : "players")}
        >
          {loadingPlayers ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="h-5 w-5 animate-spin text-gold/50" />
              <span className="ml-2 text-sm text-gold/50">Loading players...</span>
            </div>
          ) : allPlayers.length === 0 ? (
            <div className="py-6 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-gold/30" />
              <p className="text-sm text-gold/50">No players registered yet</p>
            </div>
          ) : (
            <>
              {/* Player grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {allPlayers.map((player) => {
                  const isSelected = selectedPlayers.some((p) => p.address === player.address);
                  return (
                    <PlayerCard
                      key={player.address}
                      player={player}
                      isSelected={isSelected}
                      chancePercent={getPlayerChancePercent(player)}
                      oddsWeight={getPlayerOddsWeight(player)}
                      onToggle={() => togglePlayerSelection(player)}
                      onWeightChange={(weight) => setPlayerWeight(player.address, weight)}
                      disabled={selectionLimitReached && !isSelected}
                    />
                  );
                })}
              </div>

              {/* "None of the above" option */}
              <div className="mt-3 border-t border-gold/10 pt-3">
                <div className="flex items-center justify-between rounded-lg border border-gold/30 bg-gold/10 px-3 py-2">
                  <span className="text-xs font-medium text-gold">None of the above</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brilliance">{noneChancePercent.toFixed(1)}%</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={noneWeight}
                      onChange={(e) => setNoneWeight(parseInt(e.target.value) || 1)}
                      className="w-12 rounded border border-gold/30 bg-brown/50 px-1.5 py-0.5 text-center text-[10px] text-gold outline-none focus:border-gold/60"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CreationStep>

        {/* Step 2: Funding */}
        <CreationStep
          stepNumber={2}
          title="Set Funding"
          subtitle={isFundingValid ? `${fundingAmount} LORDS` : `Min ${minFundingAmount} LORDS`}
          isExpanded={expandedStep === "funding"}
          isComplete={isFundingValid && preconditions.hasSufficientBalance}
          isDisabled={!selectionComplete || !preconditions.hasWallet}
          onToggle={() => setExpandedStep(expandedStep === "funding" ? null : "funding")}
        >
          <FundingInput
            amount={fundingAmount}
            setAmount={setFundingAmount}
            minAmount={minFundingAmount}
            balance={balance}
            isValid={isFundingValid}
          />
        </CreationStep>

        {/* Market Preview (when ready) */}
        {selectionComplete && isFundingValid && (
          <Panel tone="wood" padding="sm" radius="md" border="subtle" className="animate-fade-in-up">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gold/50">Market Preview</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedPlayers.map((player) => (
                <span
                  key={player.address}
                  className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] text-gold"
                >
                  {player.name || `${player.address.slice(0, 6)}...`}
                  <span className="font-bold text-brilliance">{getPlayerChancePercent(player).toFixed(0)}%</span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/30 px-2 py-0.5 text-[10px] text-gold">
                None
                <span className="font-bold text-brilliance">{noneChancePercent.toFixed(0)}%</span>
              </span>
            </div>
          </Panel>
        )}
      </div>

      {/* Fixed Footer */}
      <div className="flex-shrink-0 space-y-2 border-t border-gold/10 bg-brown/80 p-3">
        <Button
          onClick={createMarket}
          disabled={!canCreate}
          isLoading={isCreating || loadingPlayers || isBalanceLoading}
          variant="primary"
          size="md"
          className="w-full"
          forceUppercase={false}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Create Market
        </Button>

        {statusMessage && !isCreating && <p className="text-center text-[10px] text-gold/40">{statusMessage}</p>}

        {createError && !isCreating && (
          <div className="flex items-start gap-2 rounded-lg bg-danger/10 p-2 text-danger/80">
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
