import { Button } from "@/components/ui/button";
import { AugmentedRealm } from "@/routes/mint.lazy";
import { Grid2X2, Grid3X3 } from "lucide-react";
import { useState } from "react";
import { AnimatedGrid } from "./animated-grid";
import { RealmCard } from "./realm-card";
interface RealmGridItem {
  colSpan?: {
    sm?: number;
    md?: number;
    lg?: number;
  };
  data: AugmentedRealm;
}

interface SeasonPassRowProps {
  realms: AugmentedRealm[];
  seasonPassTokenIds?: string[];
  toggleNftSelection: (tokenId: string, collectionAddress: string) => void;
  isNftSelected?: (tokenId: string, contractAddress: string) => boolean;
  onSeasonPassStatusChange?: (tokenId: string, hasMinted: boolean) => void;
}

export const RealmsGrid = ({
  realms,
  toggleNftSelection,
  isNftSelected,
  onSeasonPassStatusChange,
}: SeasonPassRowProps) => {
  const [isCompactGrid, setIsCompactGrid] = useState(true);

  if (!realms?.length) {
    return (
      <div className="relative flex flex-col items-center justify-center p-16 text-center space-y-6 min-h-[200px] rounded-xl border border-dashed border-gray-200 bg-gradient-to-b from-gray-50/50 to-gray-100/50">
        <div className="relative">
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight mt-6">No Realms Yet</h3>
        </div>
      </div>
    );
  }

  // Use the received realms array directly
  const gridItems: RealmGridItem[] = realms.map((realm) => ({
    colSpan: isCompactGrid ? { sm: 3, md: 2, lg: 2 } : { sm: 5, md: 3, lg: 3 },
    data: realm!,
  }));

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsCompactGrid(!isCompactGrid)}
          title={isCompactGrid ? "Switch to larger grid" : "Switch to compact grid"}
        >
          {isCompactGrid ? <Grid3X3 className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
        </Button>
      </div>
      <AnimatedGrid
        items={gridItems}
        renderItem={(item) => {
          const realm = item.data;
          //  if (!realm?.node) return null;

          const isSelected = isNftSelected?.(realm.tokenId, realm.originalRealm?.contract_address) ?? false;

          return (
            <RealmCard
              toggleNftSelection={toggleNftSelection}
              key={`${realm.tokenId}`}
              isSelected={isSelected}
              realm={realm}
              onSeasonPassStatusChange={onSeasonPassStatusChange}
            />
          );
        }}
      />
    </div>
  );
};
