import { Button } from "@/components/ui/button";
import { TokenBalance } from "@/routes/season-passes.lazy";
import { Castle, Grid2X2, Grid3X3 } from "lucide-react";
import { useState } from "react";
import { AnimatedGrid } from "./animated-grid";
import { RealmCard } from "./realm-card";

interface RealmGridItem {
  colSpan?: {
    sm?: number;
    md?: number;
    lg?: number;
  };
  data: TokenBalance;
}

interface SeasonPassRowProps {
  realms: TokenBalance[];
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
      <div className="relative flex flex-col items-center justify-center p-16 text-center space-y-6 min-h-[500px] rounded-xl border-2 border-dashed border-gray-200 bg-gradient-to-b from-gray-50/50 to-gray-100/50">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/5 rounded-full blur-xl" />
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-xl" />
        </div>
        <Castle className="w-20 h-20 text-primary/60 animate-pulse" />

        <div className="relative">
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight mt-6">No Realms Yet</h3>

          <p className="text-gray-600 max-w-md leading-relaxed">
            Your collection of realms will appear here once you acquire them. Get your realm to start your journey into
            Realms World!
          </p>

          {/* <a
            href={`https://market.realms.world/collection/0x07ae27a31bb6526e3de9cf02f081f6ce0615ac12a6d7b85ee58b8ad7947a2809`}
            target="_blank"
          >
            <Button variant="outline" className="mt-6 group hover:border-primary/50 transition-all duration-300">
              <Castle className="w-4 h-4 mr-2 group-hover:text-primary transition-colors" />
              Get Your Realm
            </Button>
          </a> */}
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
          if (!realm?.node) return null;

          const isSelected =
            isNftSelected?.(
              realm.node.tokenMetadata.__typename === "ERC721__Token" ? realm.node.tokenMetadata.tokenId : "",
              realm.node.tokenMetadata.__typename === "ERC721__Token" ? realm.node.tokenMetadata.contractAddress : "",
            ) ?? false;

          return (
            <RealmCard
              toggleNftSelection={toggleNftSelection}
              key={`${realm.node.tokenMetadata.__typename === "ERC721__Token" ? realm.node.tokenMetadata.tokenId : ""}`}
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
