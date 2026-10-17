import { useRelicCrateStore } from "@/hooks/store/use-relic-crate-store";
import { WorldUpdateListener } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useEffect } from "react";

/** Every crate opening on the map, its relics kept for the tile panel. The player's own opening is its story's row. */
export const RelicCrateOpenings = () => {
  const { setup } = useGame();
  useEffect(() => {
    return new WorldUpdateListener(setup).RelicChest.onRelicChestOpened((opening) => {
      useRelicCrateStore.getState().recordOpening(opening);
    });
  }, [setup]);
  return null;
};
