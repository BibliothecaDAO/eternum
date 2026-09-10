import { useRelicCrateStore } from "@/hooks/store/use-relic-crate-store";
import { toast } from "@/ui/features/event-feed/notify";
import { WorldUpdateListener } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";

/** Every crate opening on the map: one feed row that flies to the hex, and the relics kept for the tile panel. */
export const RelicCrateOpenings = () => {
  const { setup } = useDojo();
  useEffect(
    () =>
      new WorldUpdateListener(setup).RelicChest.onRelicChestOpened((opening) => {
        useRelicCrateStore.getState().recordOpening(opening);
        toast.success(`Crate opened · ${opening.relics.length} relics`, { location: opening.hex });
      }),
    [setup],
  );
  return null;
};
