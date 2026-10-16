import { useRelicCrateStore } from "@/hooks/store/use-relic-crate-store";
import { toast } from "@/ui/features/event-feed/notify";
import { WorldUpdateListener } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useEffect } from "react";

/**
 * Every crate opening on the map: one feed row, titled as the history titles it (its pack and where its relics went),
 * that flies to the hex, and the relics kept for the tile panel.
 */
export const RelicCrateOpenings = () => {
  const { setup } = useGame();
  useEffect(() => {
    return new WorldUpdateListener(setup).RelicChest.onRelicChestOpened((opening) => {
      useRelicCrateStore.getState().recordOpening(opening);
      toast.success(opening.title, { location: opening.hex });
    });
  }, [setup]);
  return null;
};
