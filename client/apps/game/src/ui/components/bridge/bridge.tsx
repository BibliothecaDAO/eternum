import Button from "@/ui/elements/button";
import { cn } from "@/ui/elements/lib/utils";
// Remove RangeInput if no longer needed, or keep if used elsewhere
// import { RangeInput } from "@/ui/elements/range-input";
import { useLords } from "@/hooks/use-lords";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { getClientFeeRecipient, getLordsAddress, getResourceAddresses } from "@/utils/addresses";
import { ID, PlayerStructure, resources } from "@bibliothecadao/eternum";
import { useBridgeAsset, useDojo } from "@bibliothecadao/react";
import { useSendTransaction } from "@starknet-react/core";
import { Star, X } from "lucide-react"; // Added X icon
import React, { useCallback, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";

// --- TODO: Replace with actual data source (e.g., fetched config, constants) ---
// Using the provided sepolia.json structure as a base
// const bridgeableResources = [
//   { id: 37, name: "Lords", tokenAddress: "0x3212cafb8c7120cdf4f786789d3ea0c7dd96a94bbdef167540d576e205bb82" },
//   { id: 1, name: "Stone", tokenAddress: "0x4fe949657fb56768beee0157f22bd24088697b7cb5746a1b668c5c9dd48d306" },
//   { id: 3, name: "Wood", tokenAddress: "0x7ec41f8344d213b93ae2b883968a703796a17ad9c5919710e618fac38693336" },
//   // Add other resources from sepolia.json or your config here
// ];
// --- END TODO ---

interface BridgeProps {
  structures: PlayerStructure[];
}

interface ResourceToBridge {
  key: number; // Unique key for React list rendering
  resourceId: number | null;
  amount: string; // Store amount as string for input field flexibility
  tokenAddress: string | null;
}

export const Bridge = ({ structures }: BridgeProps) => {
  const {
    account: { account },
  } = useDojo();

  // Remove useLords if balance display is no longer needed or adapt it
  const { lordsBalance } = useLords(); // Keep or remove based on UI decision

  const resourceAddresses = getResourceAddresses();

  const bridgeableResources = Object.entries(resourceAddresses)
    .map(([key, value]) => ({
      id: value[0],
      name: key,
      tokenAddress: value[1] as string,
    }))
    .filter((a) => a.id === 37);

  // Test lords minting (optional, for dev environments)
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

  // Manage bridge state manually
  const { bridgeDepositIntoRealm } = useBridgeAsset();
  const [isBridgePending, setIsBridgePending] = useState(false);
  const [bridgeError, setBridgeError] = useState<Error | null>(null);

  const [selectedStructureId, setSelectedStructureId] = useState<ID | null>(null);
  const [resourcesToBridge, setResourcesToBridge] = useState<ResourceToBridge[]>([
    // Start with one empty resource entry
    { key: Date.now(), resourceId: null, amount: "", tokenAddress: null },
  ]);
  const [favorites, setFavorites] = useState<number[]>(() => {
    const saved = localStorage.getItem("favoriteStructures");
    return saved ? JSON.parse(saved) : [];
  });

  // Memoized structure list with favorites
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
        return bFav - aFav; // Sort favorites to top
      });
  }, [favorites, structures]);

  // Toggle favorite status for a structure
  const toggleFavorite = useCallback((entityId: number) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId];
      localStorage.setItem("favoriteStructures", JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  // Update resource type selection
  const handleResourceChange = (key: number, selectedResourceId: string) => {
    const resourceIdNum = parseInt(selectedResourceId, 10);
    const selectedResource = bridgeableResources.find((r) => r.id === resourceIdNum);
    setResourcesToBridge((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, resourceId: resourceIdNum, tokenAddress: selectedResource?.tokenAddress || null } : r,
      ),
    );
  };

  // Update resource amount input
  const handleAmountChange = (key: number, amount: string) => {
    // Basic validation: allow only numbers and a single decimal point
    if (/^\d*\.?\d*$/.test(amount) || amount === "") {
      setResourcesToBridge((prev) => prev.map((r) => (r.key === key ? { ...r, amount } : r)));
    }
  };

  // Add a new empty resource entry line
  const addResourceEntry = () => {
    setResourcesToBridge((prev) => [...prev, { key: Date.now(), resourceId: null, amount: "", tokenAddress: null }]);
  };

  // Remove a resource entry line by its key
  const removeResourceEntry = (key: number) => {
    setResourcesToBridge((prev) => prev.filter((r) => r.key !== key));
  };

  // Execute the bridge transaction
  const handleBridge = async () => {
    setBridgeError(null); // Clear previous error
    setIsBridgePending(true);
    if (!account || !selectedStructureId || resourcesToBridge.length === 0 || isBridgePending) return;

    const transfers = resourcesToBridge
      .filter((r) => r.tokenAddress && r.amount && parseFloat(r.amount) > 0) // Filter valid entries
      .map((r) => ({
        tokenAddress: r.tokenAddress!, // Non-null assertion due to filter
        // TODO: Verify if all resources use 18 decimals. Adjust if necessary.
        amount: BigInt(parseEther(r.amount)),
      }));

    if (transfers.length === 0) {
      console.warn("No valid resources selected or amounts entered for bridging.");
      // Consider adding a user-facing notification here
      setIsBridgePending(false);
      return;
    }

    try {
      console.log("Attempting to bridge:", transfers, "to structure ID:", selectedStructureId);
      await bridgeDepositIntoRealm(transfers, BigInt(selectedStructureId), BigInt(getClientFeeRecipient()));
      // Optionally clear form or show success message here
      setResourcesToBridge([{ key: Date.now(), resourceId: null, amount: "", tokenAddress: null }]); // Reset form on success
    } catch (error) {
      console.error("Bridging failed:", error);
      setBridgeError(error instanceof Error ? error : new Error("An unknown bridging error occurred"));
    } finally {
      setIsBridgePending(false);
    }
  };

  // Memoized check to disable the bridge button
  const isBridgeButtonDisabled = useMemo(() => {
    if (!selectedStructureId || isBridgePending) return true;
    // Enable if at least one resource has ID, address, and a positive amount entered
    return !resourcesToBridge.some((r) => r.resourceId && r.tokenAddress && r.amount && parseFloat(r.amount) > 0);
  }, [selectedStructureId, resourcesToBridge, isBridgePending]);

  return (
    <div className="p-2 bg-gray-800 rounded shadow-lg flex flex-col gap-4 w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold">Bridge Resources</h2>
      <p className="text-gray-400">
        Select resources and amounts to bridge from Mainnet into the chosen Realm/Village Structure.
      </p>

      <h5 className="flex flex-row items-center gap-2">
        <ResourceIcon resource="Lords" size="sm" /> {formatEther(lordsBalance)}
      </h5>

      {/* Optional: Mint Test Lords Button (for non-mainnet) */}
      {import.meta.env.VITE_PUBLIC_CHAIN !== "mainnet" && (
        <Button onClick={handleMintTestLords} disabled={isMintPending}>
          {isMintPending ? "Minting..." : "Mint Test Lords"}
        </Button>
      )}

      <hr className="border-gold/50" />

      <h6>Bridge To</h6>

      {/* Structure Selection */}
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
                      e.stopPropagation(); // Prevent closing dropdown
                      toggleFavorite(structure.entityId!); // Assert non-null as filtered
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

      {/* Dynamic Resource Inputs Section */}
      <div className="flex flex-col gap-3">
        <label className=" h6">Resources</label>
        {resourcesToBridge.map((resource) => (
          <div key={resource.key} className="flex flex-col items-center gap-2 rounded">
            {/* Resource Type Dropdown */}

            <div className="flex flex-row items-center gap-2 w-full">
              <Select
                value={resource.resourceId?.toString() ?? ""}
                onValueChange={(value) => handleResourceChange(resource.key, value)}
              >
                <SelectTrigger className="flex-grow-0 panel-wood">
                  {" "}
                  {/* Ensure minimum width */}
                  <SelectValue placeholder="Select Resource..." />
                </SelectTrigger>
                <SelectContent className=" panel-wood bg-dark-wood">
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

              {/* Remove Resource Line Button */}
              {resourcesToBridge.length > 1 && ( // Show only if there's more than one line
                <Button variant="danger" onClick={() => removeResourceEntry(resource.key)} className="flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex flex-row items-center gap-2 w-full">
              {/* Amount Input Field */}
              <NumberInput
                min={0}
                max={1000000000000000000}
                value={parseInt(resource.amount) || 0}
                onChange={(value) => handleAmountChange(resource.key, value.toString())}
                className=" " // Fixed width, prevent shrinking
                disabled={!resource.resourceId} // Disable until resource is selected
              />
            </div>

            {/* Placeholder for single item to maintain layout */}
            {resourcesToBridge.length <= 1 && (
              <div className="w-10 h-10 flex-shrink-0"></div> // Match button size
            )}
          </div>
        ))}
        {/* Add New Resource Line Button */}
        <Button onClick={addResourceEntry} variant="default" className="mt-2 self-start">
          + Add Resource
        </Button>
      </div>

      {/* Bridge Action Button */}
      <Button
        onClick={handleBridge}
        disabled={isBridgeButtonDisabled}
        className="w-full mt-4"
        variant="gold"
        isLoading={isBridgePending} // Show loading state on button
      >
        {isBridgePending ? "Bridging..." : "Bridge Selected Resources"}
      </Button>

      {/* Error Display Area */}
      {bridgeError && <p className="text-red-500 text-sm mt-2">Bridge Error: {bridgeError.message}</p>}
      {mintError && <p className="text-red-500 text-sm mt-2">Mint Error: {mintError.message}</p>}
    </div>
  );
};
