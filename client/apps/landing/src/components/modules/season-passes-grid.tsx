import { Button } from "@/components/ui/button";
import { MergedNftData } from "@/routes/season-passes.lazy";
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
  data: MergedNftData;
}

interface SeasonPassRowProps {
  toggleNftSelection?: (tokenId: string, collectionAddress: string) => void;
  seasonPasses: MergedNftData[];
  setIsTransferOpen: (tokenId?: string) => void;
  checkOwner?: boolean;
  hideTransferButton?: boolean;
}

export const SeasonPassesGrid = ({
  toggleNftSelection,
  seasonPasses,
  setIsTransferOpen,
  checkOwner,
  hideTransferButton,
}: SeasonPassRowProps) => {
  const [isCompactGrid, setIsCompactGrid] = useState(true);

  if (!seasonPasses?.length) {
    return (
      <div className="relative flex flex-col items-center justify-center p-16 text-center space-y-8 min-h-[600px] rounded-xl border-2 border-dashed border-gray-200/70 bg-gradient-to-b from-gray-50/50 to-gray-100/50">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-pulse" />
        </div>

        <Crown className="w-24 h-24 text-primary/70 animate-pulse drop-shadow-lg" />

        <div className="relative space-y-6">
          <h3 className="text-3xl font-bold text-gray-900 tracking-tight">No Season Passes Yet</h3>

          <div className="space-y-4">
            <p className="text-gray-600 max-w-lg mx-auto leading-relaxed">
              Your collection of season passes will appear here until you burn them to play the game.
            </p>
            <p className="text-gray-500 max-w-lg mx-auto leading-relaxed">
              Once you burn a pass, it will be removed from this view.
            </p>
          </div>
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
      <div className="flex justify-end my-4">
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
          const tokenId =
            pass.node.tokenMetadata.__typename === "ERC721__Token" ? pass.node.tokenMetadata.tokenId : null;

          return (
            <SeasonPassCard
              toggleNftSelection={() => tokenId && setIsTransferOpen(tokenId)}
              key={`${tokenId || ""}`}
              pass={pass}
              checkOwner={checkOwner}
            />
          );
        }}
      />
    </div>
  );
};
