import { Button } from "@/components/ui/button";
import { GetRealmsQuery } from "@/hooks/gql/graphql";
import { Grid2X2, Grid3X3 } from "lucide-react";
import { useState } from "react";
import { AnimatedGrid } from "./animated-grid";
import { SeasonPassCard } from "./season-pass-card";

interface RealmGridItem {
  colSpan?: {
    sm?: number;
    md?: number;
    lg?: number;
  };
  data: NonNullable<NonNullable<GetRealmsQuery["tokenBalances"]>["edges"]>[number];
}

interface SeasonPassRowProps {
  seasonPasses?: NonNullable<GetRealmsQuery["tokenBalances"]>["edges"];
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  isNftSelected?: (tokenId: string, contractAddress: string) => boolean;
}

export const SeasonPassesGrid = ({ toggleNftSelection, isNftSelected, seasonPasses }: SeasonPassRowProps) => {
  const [isCompactGrid, setIsCompactGrid] = useState(false);

  if (!seasonPasses?.length) return <div>No Season Pass Found</div>;

  const gridItems: RealmGridItem[] = seasonPasses.map((pass) => ({
    colSpan: isCompactGrid
      ? { sm: 3, md: 2, lg: 2 }
      : { sm: 5, md: 3, lg: 3 },
    data: pass!,
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
          const pass = item.data;
          if (!pass?.node) return null;

          return (
            <SeasonPassCard
              toggleNftSelection={toggleNftSelection}
              key={`${pass.node.tokenMetadata.tokenId}`}
              pass={pass}
            />
          );
        }}
      />
    </div>
  );
};
