import { ReactComponent as Controller } from "@/assets/icons/controller.svg";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useResourceBalance } from "@/hooks/use-resource-balance";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

import { Button, cn, MaxButton, NumberInput, Select } from "@/ui/design-system/atoms";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/design-system/atoms/select";
import { ResourceIcon } from "@/ui/design-system/molecules";
import { displayAddress } from "@/ui/utils/utils";
import { getClientFeeRecipient, getLordsAddress, getResourceAddresses } from "@/utils/addresses";
import { divideByPrecision, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useBridgeAsset, useDojo, useResourceManager } from "@bibliothecadao/react";
import {
  ID,
  PlayerStructure,
  RESOURCE_PRECISION,
  RESOURCE_RARITY,
  resources,
  ResourcesIds,
  StructureType,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { useSendTransaction } from "@starknet-react/core";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";

import Info from "lucide-react/dist/esm/icons/info";
import Star from "lucide-react/dist/esm/icons/star";
import X from "lucide-react/dist/esm/icons/x";
import React, { useCallback, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";

interface BridgeProps {
  structures: PlayerStructure[];
}

interface ResourceToBridge {
  key: number;
  resourceId: number | null;
  amount: string;
  tokenAddress: string | null;
}

type BridgeDirection = "in" | "out";

// Efficiency data based on hyperstructures completed
const efficiencyData = [
  { hyperstructures: 0, resourceEfficiency: 25, troopEfficiency: 0 },
  { hyperstructures: 1, resourceEfficiency: 50, troopEfficiency: 25 },
  { hyperstructures: 2, resourceEfficiency: 70, troopEfficiency: 50 },
  { hyperstructures: 3, resourceEfficiency: 85, troopEfficiency: 70 },
  { hyperstructures: 5, resourceEfficiency: 95, troopEfficiency: 85 },
  { hyperstructures: 7, resourceEfficiency: 95, troopEfficiency: 95 },
];

// Platform fee constants
const PLATFORM_FEE_PERCENTAGE = 7.5;
const VILLAGE_PARENT_FEE_PERCENTAGE = 5;

// Component to display efficiency information
const EfficiencyInfo = ({
  hyperstructuresCompleted,
  isVillage,
}: {
  hyperstructuresCompleted: number;
  isVillage: boolean;
}) => {
  // Find the applicable efficiency rates based on hyperstructures completed
  const currentEfficiency = useMemo(() => {
    // Sort in descending order to find the highest tier that applies
    const sortedData = efficiencyData.toSorted((a, b) => b.hyperstructures - a.hyperstructures);
    return sortedData.find((data) => hyperstructuresCompleted >= data.hyperstructures) || efficiencyData[0];
  }, [hyperstructuresCompleted]);

  // Calculate actual amount after all deductions for 100 units
  const calculateActualAmount = (initialAmount: number) => {
    // Step 1: Remove inefficiency loss
    let amount = initialAmount * (currentEfficiency.resourceEfficiency / 100);

    // Step 2: Remove platform fees (7.5%)
    amount = amount * (1 - PLATFORM_FEE_PERCENTAGE / 100);

    // Step 3: If village, parent realm gets 5%
    if (isVillage) {
      amount = amount * (1 - VILLAGE_PARENT_FEE_PERCENTAGE / 100);
    }

    return amount.toFixed(2);
  };

  // Calculate actual troops amount after all deductions for 100 units
  const calculateTroopsAmount = (initialAmount: number) => {
    // Step 1: Remove inefficiency loss
    let amount = initialAmount * (currentEfficiency.troopEfficiency / 100);

    // Step 2: Remove platform fees (7.5%)
    amount = amount * (1 - PLATFORM_FEE_PERCENTAGE / 100);

    // Step 3: If village, parent realm gets 5%
    if (isVillage) {
      amount = amount * (1 - VILLAGE_PARENT_FEE_PERCENTAGE / 100);
    }

    return amount.toFixed(2);
  };

  // Calculate Lords amount after deductions (Lords exempt from efficiency losses)
  const calculateLordsAmount = (initialAmount: number) => {
    // Lords are exempt from efficiency losses, only platform fees apply
    let amount = initialAmount * (1 - PLATFORM_FEE_PERCENTAGE / 100);

    // If village, parent realm gets 5%
    if (isVillage) {
      amount = amount * (1 - VILLAGE_PARENT_FEE_PERCENTAGE / 100);
    }

    return amount.toFixed(2);
  };

  // Find next efficiency tier
  const getNextEfficiencyTier = () => {
    const sortedTiers = efficiencyData.toSorted((a, b) => a.hyperstructures - b.hyperstructures);
    const nextTier = sortedTiers.find((tier) => tier.hyperstructures > hyperstructuresCompleted);
    return nextTier;
  };

  const nextTier = getNextEfficiencyTier();

  // Mock function for "More Info" link
  const handleMoreInfoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open("https://docs.eternum.realms.world/mechanics/resources/bridging", "_blank");
  };

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gold/25 bg-dark-brown/70 px-3 py-2 text-xs">
      {/* Collapsible header */}
      <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5">
          <Info className="h-3 w-3 text-gold/60" />
          <span className="font-semibold uppercase tracking-[0.2em] text-gold/80 text-xxs">Efficiency Rates</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gold/50">{hyperstructuresCompleted} Hyperstructures</span>
          <span className="text-gold/50 text-[10px]">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Summary line (always visible) */}
      <div className="mt-1.5 flex items-center justify-between text-[10px]">
        <span className="text-gold/60">Per 100 resources →</span>
        <span className="font-medium text-gold">{calculateActualAmount(100)} received</span>
      </div>

      {/* Expandable details */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-gold/15 flex flex-col gap-1.5">
          {/* Rates */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <div className="flex items-center justify-between px-2 py-1 rounded bg-dark-brown/50">
              <span className="text-[10px] text-gold/60">Resource Loss:</span>
              <span className="font-medium text-[10px] text-danger">
                -{100 - currentEfficiency.resourceEfficiency}%
              </span>
            </div>
            <div className="flex items-center justify-between px-2 py-1 rounded bg-dark-brown/50">
              <span className="text-[10px] text-gold/60">Troop Loss:</span>
              <span className="font-medium text-[10px] text-danger">-{100 - currentEfficiency.troopEfficiency}%</span>
            </div>
          </div>

          {/* Fees */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-2 py-1 rounded bg-dark-brown/50">
              <span className="text-[10px] text-gold/60">Platform Fees:</span>
              <span className="font-medium text-[10px] text-danger">-{PLATFORM_FEE_PERCENTAGE}%</span>
            </div>
            {isVillage && (
              <div className="flex items-center justify-between px-2 py-1 rounded bg-dark-brown/50">
                <span className="text-[10px] text-gold/60">Parent Realm Tax:</span>
                <span className="font-medium text-[10px] text-danger">-{VILLAGE_PARENT_FEE_PERCENTAGE}%</span>
              </div>
            )}
          </div>

          {/* Calculations */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between border border-gold/15 px-2 py-1 rounded">
              <span className="text-[10px] text-gold/60">100 resources →</span>
              <span className="font-medium text-[10px] text-green">{calculateActualAmount(100)} remaining</span>
            </div>
            <div className="flex items-center justify-between border border-gold/15 px-2 py-1 rounded">
              <span className="text-[10px] text-gold/60">100 troops →</span>
              <span className="font-medium text-[10px] text-green">{calculateTroopsAmount(100)} remaining</span>
            </div>
            <div className="flex items-center justify-between border border-gold/15 px-2 py-1 rounded">
              <span className="text-[10px] text-gold/60">100 $LORDS →</span>
              <span className="font-medium text-[10px] text-gold">{calculateLordsAmount(100)} remaining</span>
            </div>
          </div>

          {/* Lords note */}
          <div className="text-[9px] text-gold/50 flex items-center gap-1">
            <span>*</span>
            <span>$LORDS are exempt from efficiency losses, only platform and parent realm fees apply</span>
          </div>

          {/* Next tier */}
          {nextTier && (
            <div className="pt-1 border-t border-gold/15 text-[10px] text-gold/60 text-center">
              Next tier: {nextTier.hyperstructures} hyperstructures (-{100 - nextTier.resourceEfficiency}% resource
              loss, -{100 - nextTier.troopEfficiency}% troop loss)
            </div>
          )}

          {/* More info link */}
          <button
            onClick={handleMoreInfoClick}
            className="text-gold/50 hover:text-gold/70 text-[9px] flex items-center gap-0.5 self-end"
          >
            <span>More Info</span>
            <Info className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  );
};

// Component to display a resource balance as a compact badge
const ResourceBalance = ({
  resourceId,
  tokenAddress,
  direction,
}: {
  resourceId: number | null;
  tokenAddress: string | null;
  direction: BridgeDirection;
}) => {
  const { balance } = useResourceBalance({
    resourceAddress: tokenAddress,
    disabled: direction === "out" || !resourceId,
  });

  if (!resourceId || direction === "out" || balance === undefined) return null;

  const formattedBalance = parseFloat(formatEther(balance)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });

  return (
    // <div className="panel-wood flex items-center px-2 py-1 h-6 rounded text-xs ml-auto">
    <span className="text-gray-200">{formattedBalance}</span>
  );
};

// Component to display realm balance
const RealmBalance = ({ resourceId, balance }: { resourceId: number | null; balance: number }) => {
  if (!resourceId) return null;

  const formattedBalance = balance.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });

  return <span className="text-gray-200">{formattedBalance}</span>;
};

export const Bridge = ({ structures }: BridgeProps) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const resourceAddresses = getResourceAddresses();

  const hyperstructuresCompleted =
    useComponentValue(components.HyperstructureGlobals, getEntityIdFromKeys([BigInt(WORLD_CONFIG_ID)]))
      ?.completed_count || 0;

  const [bridgeDirection, setBridgeDirection] = useState<BridgeDirection>("in");

  const bridgeableResources = Object.entries(resourceAddresses)
    .map(([key, value]) => ({
      id: value[0],
      name: key,
      tokenAddress: value[1] as string,
    }))
    .toSorted((a, b) => {
      // Make LORDS appear first
      if (a.name.toLowerCase() === "lords") return -1;
      if (b.name.toLowerCase() === "lords") return 1;

      // Sort other resources by rarity (lower rarity values = more common = should appear first)
      const rarityA = RESOURCE_RARITY[a.id as ResourcesIds] || 999;
      const rarityB = RESOURCE_RARITY[b.id as ResourcesIds] || 999;
      return rarityA - rarityB;
    });

  const {
    send: sendMintTx,
    error: mintError,
    isPending: isMintPending,
  } = useSendTransaction({
    calls: [
      {
        contractAddress: getLordsAddress() as `0x${string}`,
        entrypoint: "mint_test_lords",
        calldata: [],
      },
    ],
  });

  const handleMintTestLords = async () => {
    if (!account) return;
    sendMintTx();
  };

  const { bridgeDepositIntoRealm, bridgeWithdrawFromRealm } = useBridgeAsset();
  const mode = useGameModeConfig();
  const [isBridgePending, setIsBridgePending] = useState(false);
  const [bridgeError, setBridgeError] = useState<Error | null>(null);

  const [selectedStructureId, setSelectedStructureId] = useState<ID | null>(null);
  const [resourcesToBridge, setResourcesToBridge] = useState<ResourceToBridge[]>([
    { key: Date.now(), resourceId: null, amount: "", tokenAddress: null },
  ]);

  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem("favoriteStructures");
    return saved ? JSON.parse(saved) : [];
  });

  const structuresWithFavorites = useMemo(() => {
    if (!Array.isArray(structures)) {
      return [];
    }
    return structures
      .map((structure) => ({
        ...structure,
        isFavorite: structure.entityId ? favorites.includes(structure.entityId) : false,
        name: mode.structure.getName(structure.structure).name,
      }))
      .toSorted((a, b) => {
        const aFav = a.entityId ? Number(a.isFavorite) : 0;
        const bFav = b.entityId ? Number(b.isFavorite) : 0;
        return bFav - aFav;
      });
  }, [favorites, structures, mode]);

  const toggleFavorite = useCallback((entityId: number) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId];
      localStorage.setItem("favoriteStructures", JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const handleResourceChange = (key: number, selectedResourceId: string) => {
    const resourceIdNum = parseInt(selectedResourceId, 10);
    const selectedResource = bridgeableResources.find((r) => r.id === resourceIdNum);
    setResourcesToBridge((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, resourceId: resourceIdNum, tokenAddress: selectedResource?.tokenAddress || null } : r,
      ),
    );
  };

  const handleAmountChange = (key: number, amount: string) => {
    if (/^\d*\.?\d*$/.test(amount) || amount === "") {
      setResourcesToBridge((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
    }
  };

  // Wrapper component for bridge-specific max button logic
  const BridgeMaxButton = ({
    resourceKey,
    resourceId,
    tokenAddress,
    structureBalance,
    direction,
  }: {
    resourceKey: number;
    resourceId: number | null;
    tokenAddress: string | null;
    structureBalance: number;
    direction: BridgeDirection;
  }) => {
    const { balance: walletBalance } = useResourceBalance({
      resourceAddress: tokenAddress,
      disabled: direction === "out" || !resourceId,
    });

    const calculateMax = useCallback(() => {
      if (!resourceId) return 0;

      if (direction === "out") {
        return structureBalance;
      } else if (direction === "in" && walletBalance !== undefined) {
        return parseFloat(formatEther(walletBalance));
      }
      return 0;
    }, [resourceId, direction, structureBalance, walletBalance]);

    const isDisabled =
      !resourceId ||
      (direction === "out" && structureBalance <= 0) ||
      (direction === "in" && (!walletBalance || walletBalance === 0n));

    return (
      <MaxButton
        max={calculateMax}
        onChange={(value) => handleAmountChange(resourceKey, value)}
        disabled={isDisabled}
        className="h-9 px-3 text-xs"
        size="md"
      />
    );
  };

  const addResourceEntry = () => {
    setResourcesToBridge((prev) => [...prev, { key: Date.now(), resourceId: null, amount: "", tokenAddress: null }]);
  };

  const removeResourceEntry = (key: number) => {
    setResourcesToBridge((prev) => prev.filter((r) => r.key !== key));
  };

  const toggleBridgeDirection = () => {
    setBridgeDirection((prev) => (prev === "in" ? "out" : "in"));
    setSelectedStructureId(null);
    setResourcesToBridge([{ key: Date.now(), resourceId: null, amount: "", tokenAddress: null }]);
    setBridgeError(null);
  };

  const handleBridge = async () => {
    setBridgeError(null);
    setIsBridgePending(true);
    if (!account?.address || !selectedStructureId || resourcesToBridge.length === 0 || isBridgePending) {
      setIsBridgePending(false);
      return;
    }

    const transfers = resourcesToBridge
      .filter((r) => r.tokenAddress && r.amount && parseFloat(r.amount) > 0)
      .map((r) => ({
        tokenAddress: r.tokenAddress!,
        amount:
          bridgeDirection === "in"
            ? BigInt(parseEther(r.amount))
            : BigInt(parseEther(r.amount)) / BigInt(RESOURCE_PRECISION),
      }));

    if (transfers.length === 0) {
      console.warn("No valid resources selected or amounts entered for bridging.");
      setIsBridgePending(false);
      return;
    }

    try {
      console.log(
        `Attempting to bridge ${bridgeDirection}:`,
        transfers,
        `${bridgeDirection === "in" ? "to" : "from"} structure ID:`,
        selectedStructureId,
      );
      if (bridgeDirection === "in") {
        if (!bridgeDepositIntoRealm) {
          throw new Error("Deposit function is not available.");
        }
        await bridgeDepositIntoRealm(transfers, BigInt(selectedStructureId), BigInt(getClientFeeRecipient()));
      } else {
        if (!bridgeWithdrawFromRealm) {
          throw new Error("Withdrawal function is not available.");
        }
        const recipientAddress = BigInt(account.address);
        await bridgeWithdrawFromRealm(
          transfers,
          BigInt(selectedStructureId),
          recipientAddress,
          BigInt(getClientFeeRecipient()),
        );
      }
      setResourcesToBridge([{ key: Date.now(), resourceId: null, amount: "", tokenAddress: null }]);
    } catch (error) {
      console.error(`Bridging ${bridgeDirection} failed:`, error);
      setBridgeError(
        error instanceof Error ? error : new Error(`An unknown bridging ${bridgeDirection} error occurred`),
      );
    } finally {
      setIsBridgePending(false);
    }
  };

  const resourceManager = useResourceManager(selectedStructureId || 0);
  const currentTick = useCurrentDefaultTick();

  const isBridgeButtonDisabled = useMemo(() => {
    if (!selectedStructureId || isBridgePending) return true;

    const hasValidInput = resourcesToBridge.some(
      (r) => r.resourceId && r.tokenAddress && r.amount && parseFloat(r.amount) > 0,
    );
    if (!hasValidInput) return true;

    if (bridgeDirection === "out") {
      return resourcesToBridge.some((r) => {
        if (r.resourceId && r.amount && parseFloat(r.amount) > 0) {
          const balance = resourceManager.balanceWithProduction(currentTick, r.resourceId).balance;
          const displayBalance = balance !== null ? divideByPrecision(balance) : 0;
          return parseFloat(r.amount) > displayBalance;
        }
        return false;
      });
    }

    return false;
  }, [selectedStructureId, resourcesToBridge, isBridgePending, bridgeDirection, resourceManager, currentTick]);

  const bridgeTitle = bridgeDirection === "in" ? "Bridge In" : "Bridge Out";
  const structureSelectLabel = bridgeDirection === "in" ? "Bridge To" : "Bridge From";
  const bridgeButtonText = bridgeDirection === "in" ? "Bridge In" : "Bridge Out";
  const pendingButtonText = bridgeDirection === "in" ? "Bridging In..." : "Bridging Out...";

  return (
    <div className="p-4 rounded-lg shadow-md flex flex-col gap-4 w-full max-w-md mx-auto border border-gold/25 bg-dark-brown/70">
      {/* Header: Title, Description, and Toggle Button */}
      <div className="flex flex-col items-center text-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-gold">{bridgeTitle}</h2>
        <p className="text-sm  max-w-xs">
          {bridgeDirection === "in" ? (
            <>
              Transfer resources into the game from your{" "}
              <span className="inline-flex item-center">
                <Controller className="h-5 w-5 mr-1 ml-2" />
                Cartridge Controller
              </span>{" "}
            </>
          ) : (
            <>
              {" "}
              Transfer resources out of the game to your{" "}
              <span className="inline-flex item-center">
                <Controller className="h-5 w-5 mr-1 ml-2" />
                Cartridge Controller
              </span>{" "}
            </>
          )}
        </p>
        <div className="flex rounded-md border border-gold/30 overflow-hidden mt-2">
          <button
            onClick={() => {
              if (bridgeDirection !== "in") toggleBridgeDirection();
            }}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
              bridgeDirection === "in" ? "bg-gold/20 text-gold" : "text-gold/50 hover:text-gold/70",
            )}
          >
            Bridge In
          </button>
          <button
            onClick={() => {
              if (bridgeDirection !== "out") toggleBridgeDirection();
            }}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
              bridgeDirection === "out" ? "bg-gold/20 text-gold" : "text-gold/50 hover:text-gold/70",
            )}
          >
            Bridge Out
          </button>
        </div>
      </div>

      {/* Always show Efficiency Info */}
      <EfficiencyInfo
        hyperstructuresCompleted={hyperstructuresCompleted}
        isVillage={
          structuresWithFavorites.find((s) => s.entityId === selectedStructureId)?.structure.category ===
          StructureType.Village
        }
      />

      {/* Structure Selection */}
      <div>
        <h3 className="font-semibold uppercase tracking-[0.2em] text-gold/80 text-xs mb-2">{structureSelectLabel}</h3>
        <Select
          value={selectedStructureId?.toString() ?? ""}
          onValueChange={(value) => setSelectedStructureId(value ? ID(value) : null)}
        >
          <SelectTrigger id="structure-select" className="w-full border border-gold/30 bg-dark-brown/50">
            <SelectValue placeholder="Select Structure..." />
          </SelectTrigger>
          <SelectContent className="border border-gold/30 bg-dark-brown">
            {structuresWithFavorites.map((structure) =>
              structure.entityId ? (
                <div key={structure.entityId} className="flex flex-row items-center pr-2 hover:bg-gold/10">
                  <button
                    className="p-2 text-yellow-400 hover:text-yellow-300 flex-shrink-0"
                    type="button"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      toggleFavorite(structure.entityId!);
                    }}
                  >
                    <Star className={cn("h-4 w-4", structure.isFavorite ? "fill-current" : "")} />
                  </button>
                  <SelectItem className="flex-grow cursor-pointer p-2" value={structure.entityId.toString()}>
                    {structure.name || `Structure ${structure.entityId}`}
                  </SelectItem>
                </div>
              ) : null,
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Resources */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold uppercase tracking-[0.2em] text-gold/80 text-xs">Resources</h3>
        </div>

        <div className="flex flex-col gap-3">
          {resourcesToBridge.map((resource) => {
            const balance =
              bridgeDirection === "out" && resource.resourceId && selectedStructureId
                ? resourceManager.balanceWithProduction(currentTick, resource.resourceId).balance
                : null;

            const displayBalance = balance !== null ? divideByPrecision(balance) : 0;
            const resourceName = resource.resourceId
              ? bridgeableResources.find((r) => r.id === resource.resourceId)?.name
              : "";
            const resourceTrait = resource.resourceId
              ? resources.find((r) => r.id === resource.resourceId)?.trait || ""
              : "";

            return (
              <div key={resource.key} className="border border-gold/20 rounded-lg p-3 relative bg-dark-brown/50">
                {/* Resource header with balance badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ResourceIcon resource={resourceTrait} size="md" />
                    <span className="font-medium">
                      {/* Balance badge & Conditional Mint Button */}
                      {bridgeDirection === "in" && resource.resourceId && (
                        <div className="flex items-center gap-2">
                          {" "}
                          {/* Group Balance and Button */}
                          <ResourceBalance
                            resourceId={resource.resourceId}
                            tokenAddress={resource.tokenAddress}
                            direction={bridgeDirection}
                          />
                          {/* Conditional Mint Test LORDS Button */}
                          {import.meta.env.VITE_PUBLIC_CHAIN !== "mainnet" &&
                            resourceName?.toLowerCase() === "lords" && (
                              <Button
                                onClick={handleMintTestLords}
                                disabled={isMintPending}
                                variant="outline"
                                title="Mint 1000 Test $LORDS"
                                // Smaller size for header placement
                                className={cn(
                                  "h-6 px-2 text-xs border transition-colors duration-300 flex-shrink-0",
                                  "border-gold/30 bg-gold/10 text-gold hover:bg-gold/20",
                                )}
                              >
                                {isMintPending ? "..." : "Mint"}
                              </Button>
                            )}
                        </div>
                      )}

                      {bridgeDirection === "out" && resource.resourceId && selectedStructureId && (
                        <RealmBalance resourceId={resource.resourceId} balance={displayBalance} />
                      )}
                    </span>
                  </div>
                </div>

                {/* Remove button */}
                {resourcesToBridge.length > 1 && (
                  <Button
                    variant="danger"
                    onClick={() => removeResourceEntry(resource.key)}
                    className="absolute top-2 right-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}

                {/* Resource Selection */}
                <div className="mb-3">
                  {/* <label className="block text-xs  mb-1">Resource</label> */}
                  <Select
                    value={resource.resourceId?.toString() ?? ""}
                    onValueChange={(value) => handleResourceChange(resource.key, value)}
                  >
                    <SelectTrigger className="w-full border border-gold/30 bg-dark-brown/50">
                      <SelectValue placeholder="Select Resource..." />
                    </SelectTrigger>
                    <SelectContent className="border border-gold/30 bg-dark-brown">
                      {bridgeableResources.map((br) => (
                        <SelectItem key={br.id} value={br.id.toString()}>
                          <div className="flex items-center gap-2">
                            <ResourceIcon resource={resources.find((r) => r.id === br.id)?.trait || ""} size="xs" />
                            <span>{br.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Input & Max Button */}
                <div className="flex items-center gap-2">
                  <div className="flex-grow">
                    <NumberInput
                      min={0}
                      max={bridgeDirection === "out" && balance !== null ? displayBalance : undefined}
                      value={parseInt(resource.amount) || 0}
                      onChange={(value) => handleAmountChange(resource.key, value.toString())}
                      disabled={!resource.resourceId}
                      className="w-full h-9"
                    />
                  </div>
                  {/* Max Button */}
                  {resource.resourceId && (
                    <BridgeMaxButton
                      resourceKey={resource.key}
                      resourceId={resource.resourceId}
                      tokenAddress={resource.tokenAddress}
                      structureBalance={displayBalance}
                      direction={bridgeDirection}
                    />
                  )}
                </div>
              </div>
            );
          })}

          <Button onClick={addResourceEntry} variant="outline" className="self-center flex items-center gap-1 mt-3">
            <span>+ Add Resource</span>
          </Button>
        </div>
      </div>

      {/* Bridge Destination Indicator */}
      <div className="flex flex-col items-center justify-center text-xs  mt-6">
        {selectedStructureId && bridgeDirection === "in" && (
          <>
            <ArrowDown className="h-5 w-5 mb-1 text-gold/60" />
            <span>
              Bridging to:{" "}
              {structuresWithFavorites.find((s) => s.entityId === selectedStructureId)?.name ||
                `Structure ${selectedStructureId}`}
            </span>
          </>
        )}
        {account?.address && bridgeDirection === "out" && (
          <>
            <ArrowDown className="h-5 w-5 mb-1 text-gold/60" />
            <div className="flex items-center gap-1">
              <span>
                Bridging to: <Controller className="h-4 w-4 inline-block mx-1" />
              </span>
              <span className="font-mono">{displayAddress(account.address)}</span>
            </div>
          </>
        )}
      </div>

      {/* Bridge Button */}
      <Button
        onClick={handleBridge}
        disabled={isBridgeButtonDisabled}
        variant="primary"
        className="w-full"
        isLoading={isBridgePending}
      >
        {isBridgePending ? pendingButtonText : bridgeButtonText}
      </Button>

      {/* Error Messages */}
      {(bridgeError || mintError) && (
        <div className="mt-2 p-2 bg-dark-brown/50 border border-danger/30 rounded-lg">
          {bridgeError && <p className="text-red-400 text-sm">Bridge Error: {bridgeError.message}</p>}
          {mintError && <p className="text-red-400 text-sm">Mint Error: {mintError.message}</p>}
        </div>
      )}
    </div>
  );
};
