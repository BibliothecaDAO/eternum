import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import Button from "@/ui/design-system/atoms/button";
import { ChestInfo } from "@bibliothecadao/torii";
import { MapPin, Navigation } from "lucide-react";
import { useMemo } from "react";
import { getChestName } from "./index";

interface ChestListProps {
  chests: ChestInfo[];
}

export const ChestList = ({ chests }: ChestListProps) => {
  const setNavigationTarget = useUIStore((state) => state.setNavigationTarget);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const handleNavigateToChest = (chest: ChestInfo) => {
    setNavigationTarget({
      col: chest.position.x,
      row: chest.position.y,
    });
  };

  const sortedChests = useMemo(
    () =>
      [...chests]
        .sort((a, b) => a.distance - b.distance)
        .map((chest) => ({
          ...chest,
          name: getChestName(chest.entityId),
          position: new Position({ x: chest.position.x, y: chest.position.y }).getNormalized(),
        })),
    [chests],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-gold" />
        <h3 className="text-lg font-bold text-gold">Nearby Crates</h3>
        <span className="text-sm text-gold/60">({chests.length} found)</span>
      </div>
      <div className="text-xs text-gold/50 mb-2 ml-7">Crates are sorted by distance: closest to furthest.</div>
      {chests.length === 0 ? (
        <div className="text-center py-8 text-gold/60">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <div>No crates found in this area</div>
          <div className="text-sm mt-1">Explore more to discover Relic Crates!</div>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedChests.map((chest) => (
            <div
              key={chest.entityId}
              className="flex items-center justify-between p-3 bg-gold/5 rounded-lg border border-gold/10 hover:bg-gold/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-semibold text-gold">{chest.name}</div>
                  <div className="text-sm text-gold/70">
                    Position: ({chest.position.x}, {chest.position.y})
                  </div>
                  <div className="text-xs text-gold/60">Distance: {chest.distance.toFixed(1)} tiles</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleNavigateToChest(chest)}
                  onMouseEnter={() =>
                    setTooltip({
                      content: "Navigate to this crate location",
                      position: "top",
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                  className="flex items-center gap-1"
                >
                  <Navigation className="w-3 h-3" />
                  Go
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
