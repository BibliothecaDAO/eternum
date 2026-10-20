import { useChestOpeningStore } from "@/hooks/store/use-chest-opening-store";
import { WorldUpdateListener } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useEffect } from "react";

/** Every chest opening on the map, its reward kept for the tile panel. The player's own opening is its story's row. */
export const ChestOpenings = () => {
  const { setup } = useGame();
  useEffect(() => {
    const stop = new WorldUpdateListener(setup).Chests.onChestOpened((opening) => {
      useChestOpeningStore.getState().recordOpening(opening);
    });
    return () => {
      stop();
      useChestOpeningStore.setState({ openings: {} });
    };
  }, [setup]);
  return null;
};
