import { useLords } from "@/hooks/use-lords";
import Button from "@/ui/elements/button";
import { cn } from "@/ui/elements/lib/utils";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { getClientFeeRecipient, getLordsAddress, getResourceAddresses } from "@/utils/addresses";
import { useBridgeAsset, useDojo } from "@bibliothecadao/react";
import { ID, PlayerStructure, RESOURCE_PRECISION, resources } from "@bibliothecadao/types";
import { useSendTransaction } from "@starknet-react/core";
import { ArrowLeftRight, Star, X } from "lucide-react";
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

export const Bridge = ({ structures }: BridgeProps) => {
  const {
    account: { account },
  } = useDojo();

  const { lordsBalance } = useLords();
  const resourceAddresses = getResourceAddresses();

  const [bridgeDirection, setBridgeDirection] = useState<BridgeDirection>("in");

  const bridgeableResources = Object.entries(resourceAddresses)
    .map(([key, value]) => ({
      id: value[0],
      name: key,
      tokenAddress: value[1] as string,
    }))
    .filter((a) => a.id === 37);

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

  const isBridgeButtonDisabled = useMemo(() => {
    if (!selectedStructureId || isBridgePending) return true;
    return !resourcesToBridge.some((r) => r.resourceId && r.tokenAddress && r.amount && parseFloat(r.amount) > 0);
  }, [selectedStructureId, resourcesToBridge, isBridgePending, bridgeDirection]);

  const bridgeTitle = bridgeDirection === "in" ? "Bridge In" : "Bridge Out";
  const bridgeDescription =
    bridgeDirection === "in"
      ? "Select resources and amounts to bridge from Mainnet into the chosen Realm/Village Structure."
      : "Select resources and amounts to bridge out from the chosen Realm/Village Structure to Mainnet.";
  const structureSelectLabel = bridgeDirection === "in" ? "Bridge To" : "Bridge From";
  const bridgeButtonText = bridgeDirection === "in" ? "Bridge In" : "Bridge Out";
  const pendingButtonText = bridgeDirection === "in" ? "Bridging In..." : "Bridging Out...";

  return (
    <div className="p-2 bg-gray-800 rounded shadow-lg flex flex-col gap-4 w-full max-w-md mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">{bridgeTitle}</h2>
        <br />
        <Button onClick={toggleBridgeDirection} variant="outline" className="flex items-center gap-1">
          <ArrowLeftRight className="h-4 w-4" />
          {bridgeDirection === "in" ? "Out" : "In"}
        </Button>
      </div>

      <p className="text-gray-400">{bridgeDescription}</p>

      {bridgeDirection === "in" && (
        <>
          <h5 className="flex flex-row items-center gap-2">
            <ResourceIcon resource="Lords" size="md" /> {formatEther(lordsBalance)}
          </h5>
          {import.meta.env.VITE_PUBLIC_CHAIN !== "mainnet" && (
            <Button onClick={handleMintTestLords} disabled={isMintPending}>
              {isMintPending ? "Minting..." : "Mint Test Lords"}
            </Button>
          )}
          <hr className="border-gold/50" />
        </>
      )}

      <h6>{structureSelectLabel}</h6>
      <div>
        <Select
          value={selectedStructureId?.toString() ?? ""}
          onValueChange={(value) => setSelectedStructureId(value ? ID(value) : null)}
        >
          <SelectTrigger id="structure-select" className="w-full panel-wood">
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

      <div className="flex flex-col gap-3">
        <label className="h6">Resources</label>
        {resourcesToBridge.map((resource) => (
          <div key={resource.key} className="flex flex-col items-center gap-2 rounded">
            <div className="flex flex-row items-center gap-2 w-full">
              <Select
                value={resource.resourceId?.toString() ?? ""}
                onValueChange={(value) => handleResourceChange(resource.key, value)}
              >
                <SelectTrigger className="flex-grow-0 panel-wood">
                  <SelectValue placeholder="Select Resource..." />
                </SelectTrigger>
                <SelectContent className="panel-wood bg-dark-wood">
                  {bridgeableResources.map((br) => (
                    <SelectItem key={br.id} value={br.id.toString()}>
                      <div className="flex items-center gap-2">
                        <ResourceIcon resource={resources.find((r) => r.id === br.id)?.trait || ""} size="sm" />
                        <span>{br.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {resourcesToBridge.length > 1 && (
                <Button variant="danger" onClick={() => removeResourceEntry(resource.key)} className="flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex flex-row items-center gap-2 w-full">
              <NumberInput
                min={0}
                max={1000000000000000000}
                value={parseInt(resource.amount) || 0}
                onChange={(value) => handleAmountChange(resource.key, value.toString())}
                disabled={!resource.resourceId}
              />
            </div>

            {resourcesToBridge.length <= 1 && <div className="w-10 h-10 flex-shrink-0"></div>}
          </div>
        ))}
        <Button onClick={addResourceEntry} variant="default" className="mt-2 self-start">
          + Add Resource
        </Button>
      </div>

      <Button
        onClick={handleBridge}
        disabled={isBridgeButtonDisabled}
        className="w-full mt-4"
        variant="gold"
        isLoading={isBridgePending}
      >
        {isBridgePending ? pendingButtonText : bridgeButtonText}
      </Button>

      {bridgeError && <p className="text-red-500 text-sm mt-2">Bridge Error: {bridgeError.message}</p>}
      {mintError && <p className="text-red-500 text-sm mt-2">Mint Error: {mintError.message}</p>}
    </div>
  );
};
