import { Button } from "@/components/ui/button";
import { GetRealmsQuery } from "@/hooks/gql/graphql";
import { Crown, Grid2X2, Grid3X3 } from "lucide-react";
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

  if (!seasonPasses?.length) {
    return (
      <div className="relative flex flex-col items-center justify-center p-16 text-center space-y-6 min-h-[500px] rounded-xl border-2 border-dashed border-gray-200 bg-gradient-to-b from-gray-50/50 to-gray-100/50">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/5 rounded-full blur-xl" />
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-xl" />
        </div>
        <Crown className="w-20 h-20 text-primary/60 animate-pulse" />
        
        <div className="relative">
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight mt-6">
            No Season Passes Yet
          </h3>
          
          <p className="text-gray-600 max-w-md leading-relaxed">
            Your collection of season passes will appear here once you acquire them.
            Get your first pass to join the game and start your journey into Eternum!
          </p>
          
          <a href={`https://market.realms.world/collection/0x057675b9c0bd62b096a2e15502a37b290fa766ead21c33eda42993e48a714b80`} target="_blank">
            <Button 
              variant="outline" 
            className="mt-6 group hover:border-primary/50 transition-all duration-300"
          >
            <Crown className="w-4 h-4 mr-2 group-hover:text-primary transition-colors" />
            Buy Your First Pass 
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const gridItems: RealmGridItem[] = seasonPasses.map((pass) => ({
    colSpan: isCompactGrid ? { sm: 3, md: 2, lg: 2 } : { sm: 5, md: 3, lg: 3 },
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
