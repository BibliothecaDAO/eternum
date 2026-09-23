import { toast } from "@/ui/features/event-feed/notify";
import { configManager, WorldUpdateListener } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useEffect } from "react";

const QUALITY = ["Common", "Uncommon", "Rare", "Epic"];
const KIND = { Relic: "relic", Cosmetic: "cosmetic", Token: "token claim" } as const;

/** A captured site opens its chest where the army stands: one feed row that flies to that hex. */
export const ChestOpenings = () => {
  const { setup } = useGame();
  useEffect(
    () =>
      new WorldUpdateListener(setup).ChestRewards.onChestReward((reward) => {
        const army = setup.store.get("ExplorerTroops", {
          game_id: configManager.getActiveGameId(),
          explorer_id: reward.explorerId,
        });
        toast.success(`Chest opened · ${QUALITY[reward.quality] ?? "Common"} ${KIND[reward.kind]}`, {
          location: army ? { x: army.coord.x, y: army.coord.y } : undefined,
        });
      }),
    [setup],
  );
  return null;
};
