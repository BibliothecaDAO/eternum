import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@bibliothecadao/react";
import { WinnersTable } from "./components/winners-table";

export const PrizePanel = () => {
  const result = useNativeRow("BlitzResult", { game_id: configManager.getActiveGameId() });
  const finalized = result?.complete === true;

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <p className="text-sm text-gold/70">
        {finalized
          ? "Results are final. Every player’s rank and victory points are recorded."
          : "The game operator finalizes results after the game ends. Your earned points are included automatically."}
      </p>
      {finalized && <WinnersTable />}
    </div>
  );
};
