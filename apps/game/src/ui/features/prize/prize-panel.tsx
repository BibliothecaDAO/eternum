import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { activeGameRows } from "@/sync/recs-rows";
import { useDojo } from "@bibliothecadao/react";
import { useMemo } from "react";
import { WinnersTable } from "./components/winners-table";

export const PrizePanel = () => {
  const {
    setup: { components },
  } = useDojo();
  const revision = useWorldSlicesStore((state) => state.leaderboardRevision);
  const finalized = useMemo(() => {
    void revision;
    return BigInt(activeGameRows(components.GameRegistry).at(0)?.final_trial_id ?? 0) > 0n;
  }, [components, revision]);

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
