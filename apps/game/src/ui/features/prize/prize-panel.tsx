import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@bibliothecadao/react";
import { WinnersTable } from "./components/winners-table";

export const PrizePanel = () => {
  const game = useNativeRow("GameRegistry", { game_id: configManager.getActiveGameId() });
  const finalized = (game?.final_trial_id ?? 0n) > 0n;

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <p className="text-sm text-gold/70">
        {finalized
          ? "Results are final. The game operator processes payouts and MMR."
          : "The game operator finalizes results after the game ends. Your earned points are included automatically."}
      </p>
      {finalized && <WinnersTable />}
    </div>
  );
};
