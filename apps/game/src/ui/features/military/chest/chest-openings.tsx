import { toast } from "@/ui/features/event-feed/notify";
import { configManager, entityMapPosition, WorldUpdateListener } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useEffect } from "react";

const QUALITY = ["Common", "Uncommon", "Rare", "Epic"];
const KIND = { Relic: "relic", Token: "token claim" } as const;

/** An opened chest posts one feed row at the army's position. */
export const ChestOpenings = () => {
  const { setup } = useGame();
  useEffect(
    () =>
      new WorldUpdateListener(setup).ChestRewards.onChestReward((reward) => {
        const army = setup.store.get("ExplorerTroops", {
          game_id: configManager.getActiveGameId(),
          explorer_id: reward.explorerId,
        });
        const quality = QUALITY[reward.quality];
        if (!quality) throw new Error("Invalid chest quality");
        toast.success(`Chest opened · ${quality} ${KIND[reward.kind]}`, {
          description: reward.lordsExhausted
            ? "LORDS allowance exhausted; awarded a relic of the same rarity"
            : undefined,
          id: `chest:${reward.resultKey.join(":")}`,
          location: army ? entityMapPosition(setup.store, army.game_id, army.explorer_id) : undefined,
        });
      }),
    [setup],
  );
  return null;
};
