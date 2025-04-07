import { useLords } from "@/hooks/use-lords";
import Button from "@/ui/elements/button";
import { cn } from "@/ui/elements/lib/utils";
import { RangeInput } from "@/ui/elements/range-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select";
import { getLordsAddress } from "@/utils/addresses";
import { ID, PlayerStructure } from "@bibliothecadao/eternum"; // Assuming PlayerStructure type exists
import { useDojo } from "@bibliothecadao/react";
import { useSendTransaction } from "@starknet-react/core";
import { Star } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { formatEther } from "viem";

interface BridgeProps {
  structures: PlayerStructure[];
}

export const Bridge = ({ structures }: BridgeProps) => {
  const {
    account: { account },
  } = useDojo();

  const { lordsBalance } = useLords();

  const { send, error, isPending } = useSendTransaction({
    calls: [
      {
        contractAddress: getLordsAddress(),
        entrypoint: "mint_test_lords",
        calldata: [],
      },
    ],
  });

  const handleMintTestLords = async () => {
    if (!account) return;
    send();
  };

  const [selectedStructureId, setSelectedStructureId] = useState<ID | null>(null);
  const [lordAmount, setLordAmount] = useState<number>(1);
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
        // Corrected property access: use structure.entity_id
        isFavorite: structure.entityId ? favorites.includes(structure.entityId) : false,
      }))
      .sort((a, b) => {
        // Corrected property access: use structure.entity_id
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

  const handleBridge = () => {
    console.log("Bridging", lordAmount, "Lords to structure ID:", selectedStructureId);
    // TODO: Add actual bridging logic here
  };

  return (
    <div className="p-2 bg-gray-800rounded shadow-lg flex flex-col gap-4 w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold">Bridge Lords</h2>
      <p className="text-gray-400">
        Briding Lords into a Structure from Mainnet. This will wrap the Lords ingame and you will not be able to use
        them on Mainnet.
      </p>
      {import.meta.env.VITE_PUBLIC_CHAIN != "mainnet" && (
        <Button onClick={handleMintTestLords} disabled={isPending}>
          {isPending ? "Minting..." : "Mint Test Lords"}
        </Button>
      )}
      <div className="flex flex-row items-center gap-2">
        <ResourceIcon resource="Lords" size="lg" />
        <h5 className=" text-gray-400">{Number(formatEther(lordsBalance)).toFixed(2)} </h5>
      </div>
      {/* Structure Selection Dropdown */}
      <div>
        <label htmlFor="structure-select" className="block text-sm font-medium mb-1">
          Select Realm/Village
        </label>
        <Select
          value={selectedStructureId?.toString() ?? ""}
          onValueChange={(value) => setSelectedStructureId(value ? ID(value) : null)}
        >
          <SelectTrigger id="structure-select" className="w-full panel-wood ">
            <SelectValue placeholder="Select Structure..." />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 border-gray-600  panel-wood bg-dark-wood">
            {structuresWithFavorites.map((structure, index) =>
              // Corrected property access: use structure.entity_id
              structure.entityId ? (
                <div key={structure.entityId || index} className="flex flex-row items-center pr-2 hover:bg-gray-600">
                  <button
                    className="p-2 text-yellow-400 hover:text-yellow-300"
                    type="button"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation(); // Prevent dropdown from closing
                      // Corrected property access: use structure.entity_id
                      if (structure.entityId) {
                        toggleFavorite(structure.entityId);
                      }
                    }}
                  >
                    <Star className={cn("h-4 w-4", structure.isFavorite ? "fill-current" : "")} />
                  </button>
                  <SelectItem
                    className="flex-grow cursor-pointer p-2"
                    // Corrected property access: use structure.entity_id
                    value={structure.entityId.toString()}
                  >
                    {/* Corrected property access: use structure.name */}
                    {structure.name || `Structure ${structure.entityId}`}
                  </SelectItem>
                </div>
              ) : null,
            )}
          </SelectContent>
        </Select>
      </div>
      {/* Lords Input */}
      <div>
        <RangeInput
          title="Number of Lords"
          value={lordAmount}
          step={1}
          min={1}
          max={Number(formatEther(lordsBalance))}
          onChange={(value) => setLordAmount(value)}
        />
      </div>
      {/* Bridge Button */}
      <Button
        onClick={handleBridge}
        disabled={!selectedStructureId || lordAmount <= 0}
        className="w-full mt-4"
        variant="gold"
      >
        Bridge {lordAmount} {lordAmount === 1 ? "Lord" : "Lords"}
      </Button>
      {error && <p className="text-red-500">{error.message}</p>}
    </div>
  );
};
