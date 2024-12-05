import { Button } from "@/components/ui/button";
import { GetRealmsQuery } from "@/hooks/gql/graphql";
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
  data: NonNullable<NonNullable<GetRealmsQuery["tokenBalances"]>["edges"]>[number];
}

interface SeasonPassRowProps {
  realms?: NonNullable<GetRealmsQuery["tokenBalances"]>["edges"];
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
  const [isCompactGrid, setIsCompactGrid] = useState(false);

  if (!realms?.length) return <div>No Realms found</div>;

  const gridItems: RealmGridItem[] = realms.map((realm) => ({
    colSpan: isCompactGrid
      ? { sm: 3, md: 2, lg: 2 }
      : { sm: 5, md: 3, lg: 3 },
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
          if (!realm?.node) return null;

          const isSelected =
            isNftSelected?.(realm.node.tokenMetadata.tokenId, realm.node.tokenMetadata.contractAddress) ?? false;

          return (
            <RealmCard
              toggleNftSelection={toggleNftSelection}
              key={`${realm.node.tokenMetadata.tokenId}`}
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
