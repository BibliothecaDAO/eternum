import { useSelectedPassesStore } from "@/stores/selected-passes";
import { MergedNftData } from "@/types";
import { Crown } from "lucide-react";
import { AnimatedGrid } from "./animated-grid";
import { SeasonPassCard } from "./season-pass-card";

interface RealmGridItem {
  colSpan?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  data: MergedNftData;
}

interface SeasonPassRowProps {
  seasonPasses: MergedNftData[];
  setIsTransferOpen: (tokenId?: string) => void;
  checkOwner?: boolean;
  hideTransferButton?: boolean;
  isCompactGrid?: boolean;
  onToggleSelection?: (pass: MergedNftData) => void;
}

export const SeasonPassesGrid = ({
  seasonPasses,
  setIsTransferOpen,
  checkOwner,
  hideTransferButton,
  isCompactGrid,
  onToggleSelection,
}: SeasonPassRowProps) => {
  const isSelected = useSelectedPassesStore((state) => state.isSelected);

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
    colSpan: isCompactGrid
      ? { sm: 6, md: 6, lg: 3, xl: 2 } // 2 items on sm, 3 on md, 4 on lg
      : { sm: 6, md: 6, lg: 4, xl: 3 }, // 2 items on sm, 3 on md, 3 on lg
    data: pass!,
  }));

  return (
    <div>
      <AnimatedGrid
        items={gridItems}
        renderItem={(item) => {
          const pass = item.data;
          if (!pass) return null;
          const tokenId = pass.token_id;

          return (
            <SeasonPassCard
              key={`${tokenId || ""}`}
              pass={pass}
              checkOwner={checkOwner}
              isSelected={isSelected(tokenId.toString())}
              onToggleSelection={() => onToggleSelection?.(pass)}
              toggleNftSelection={() => tokenId && setIsTransferOpen(tokenId.toString())}
            />
          );
        }}
      />
    </div>
  );
};
