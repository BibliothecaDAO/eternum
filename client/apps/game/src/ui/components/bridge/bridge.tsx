import { ReactComponent as Controller } from "@/assets/icons/controller.svg";
import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useResourceBalance } from "@/hooks/use-resource-balance";
import Button from "@/ui/elements/button";
import { cn } from "@/ui/elements/lib/utils";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { displayAddress } from "@/ui/utils/utils";
import { getClientFeeRecipient, getLordsAddress, getResourceAddresses } from "@/utils/addresses";
import { divideByPrecision } from "@bibliothecadao/eternum";
import { useBridgeAsset, useDojo, useResourceManager } from "@bibliothecadao/react";
import { ID, PlayerStructure, RESOURCE_PRECISION, resources } from "@bibliothecadao/types";
import { useSendTransaction } from "@starknet-react/core";
import { ArrowDown, ArrowLeftRight, Star, X } from "lucide-react";
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
  } = useDojo();

  const resourceAddresses = getResourceAddresses();

  const [bridgeDirection, setBridgeDirection] = useState<BridgeDirection>("in");

  const bridgeableResources = Object.entries(resourceAddresses)
    .map(([key, value]) => ({
      id: value[0],
      name: key,
      tokenAddress: value[1] as string,
    }))
    .sort((a, b) => {
      // Make LORDS appear first
      if (a.name.toLowerCase() === "lords") return -1;
      if (b.name.toLowerCase() === "lords") return 1;
      // Keep original order for other resources
      return 0;
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
      }))
      .sort((a, b) => {
        const aFav = a.entityId ? Number(a.isFavorite) : 0;
        const bFav = b.entityId ? Number(b.isFavorite) : 0;
        return bFav - aFav;
      });
  }, [favorites, structures]);

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
  const { currentDefaultTick: currentTick } = useBlockTimestamp();

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
    <div
      className={cn(
        "p-4 rounded-lg shadow-lg flex flex-col gap-4 w-full max-w-md mx-auto transition-all duration-300 border-t-4",
        bridgeDirection === "in"
          ? "bg-gradient-to-b from-sky-900/30 to-gray-900/10 border-sky-500"
          : "bg-gradient-to-b from-amber-900/30 to-gray-900/10 border-amber-500",
      )}
    >
      {/* Header: Title, Description, and Toggle Button */}
      <div className="flex flex-col items-center text-center gap-2 mb-2">
        <h2
          className={cn(
            "text-xl font-bold transition-colors duration-300",
            bridgeDirection === "in" ? "text-sky-300" : "text-amber-300",
          )}
        >
          {bridgeTitle}
        </h2>
        <p className="text-sm text-gray-400 max-w-xs">
          {bridgeDirection === "in" ? (
            <>
              Transfer resources into the game from your{" "}
              <span className="inline-flex item-center">
                <Controller className="h-5 w-5 mr-1 ml-2" />
                Cartridge Wallet
              </span>{" "}
            </>
          ) : (
            <>
              {" "}
              Transfer resources out of the game to your{" "}
              <span className="inline-flex item-center">
                <Controller className="h-5 w-5 mr-1 ml-2" />
                Cartridge Wallet
              </span>{" "}
            </>
          )}
        </p>
        <Button
          onClick={toggleBridgeDirection}
          variant="outline"
          className={cn(
            "h-9 flex items-center gap-1 mt-2 border text-xs px-3 transition-all duration-300",
            bridgeDirection === "in"
              ? "border-amber-600 bg-amber-900/30 text-amber-300 hover:bg-amber-800/40 hover:border-amber-500"
              : "border-sky-600 bg-sky-900/30 text-sky-300 hover:bg-sky-800/40 hover:border-sky-500",
          )}
        >
          <ArrowLeftRight className="h-4 w-4 mr-1" />
          <span>{bridgeDirection === "in" ? "WITHDRAW INSTEAD" : "DEPOSIT INSTEAD"}</span>
        </Button>
      </div>

      {/* Structure Selection */}
      <div>
        <h3 className="text-sm font-medium mb-2">{structureSelectLabel}</h3>
        <Select
          value={selectedStructureId?.toString() ?? ""}
          onValueChange={(value) => setSelectedStructureId(value ? ID(value) : null)}
        >
          <SelectTrigger
            id="structure-select"
            className={cn(
              "w-full panel-wood transition-colors duration-300",
              bridgeDirection === "in" ? "focus:ring-sky-500/50" : "focus:ring-amber-500/50",
            )}
          >
            <SelectValue placeholder="Select Structure..." />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 border-gray-600 panel-wood bg-dark-wood">
            {structuresWithFavorites.map((structure) =>
              structure.entityId ? (
                <div key={structure.entityId} className="flex flex-row items-center pr-2 hover:bg-gray-600">
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
          <h3 className="text-sm font-medium">Resources</h3>
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
              <div key={resource.key} className="border border-gray-700 rounded-lg p-3 relative">
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
                                  "border-sky-600 bg-sky-900/30 text-sky-300 hover:bg-sky-800/40 hover:border-sky-500",
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
                  {/* <label className="block text-xs text-gray-400 mb-1">Resource</label> */}
                  <Select
                    value={resource.resourceId?.toString() ?? ""}
                    onValueChange={(value) => handleResourceChange(resource.key, value)}
                  >
                    <SelectTrigger className="w-full panel-wood">
                      <SelectValue placeholder="Select Resource..." />
                    </SelectTrigger>
                    <SelectContent className="panel-wood bg-dark-wood">
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

                {/* Amount Input & Optional Mint Button */}
                <div className="flex items-center gap-2">
                  {" "}
                  {/* Container for input and button */}
                  <div className="flex-grow">
                    {" "}
                    {/* Allow input to take most space */}
                    <NumberInput
                      min={0}
                      max={bridgeDirection === "out" && balance !== null ? displayBalance : undefined}
                      value={parseInt(resource.amount) || 0}
                      onChange={(value) => handleAmountChange(resource.key, value.toString())}
                      disabled={!resource.resourceId}
                      className="w-full h-9" // Explicit height for alignment
                    />
                  </div>
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
      <div className="flex flex-col items-center justify-center text-xs text-gray-400 mt-6">
        {selectedStructureId && bridgeDirection === "in" && (
          <>
            <ArrowDown className={cn("h-5 w-5 mb-1 transition-colors duration-300", "text-sky-500")} />
            <span>
              Bridging to:{" "}
              {structuresWithFavorites.find((s) => s.entityId === selectedStructureId)?.name ||
                `Structure ${selectedStructureId}`}
            </span>
          </>
        )}
        {account?.address && bridgeDirection === "out" && (
          <>
            <ArrowDown className={cn("h-5 w-5 mb-1 transition-colors duration-300", "text-amber-500")} />
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
        className={cn(
          "w-full transition-all duration-300 border",
          bridgeDirection === "in"
            ? "border-sky-600 bg-sky-900/30 text-sky-300 hover:bg-sky-800/40 hover:border-sky-500"
            : "border-amber-600 bg-amber-900/30 text-amber-300 hover:bg-amber-800/40 hover:border-amber-500",
        )}
        variant={"outline"}
        isLoading={isBridgePending}
      >
        {isBridgePending ? pendingButtonText : bridgeButtonText}
      </Button>

      {/* Error Messages */}
      {(bridgeError || mintError) && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-700 rounded-lg">
          {bridgeError && <p className="text-red-400 text-sm">Bridge Error: {bridgeError.message}</p>}
          {mintError && <p className="text-red-400 text-sm">Mint Error: {mintError.message}</p>}
        </div>
      )}
    </div>
  );
};
