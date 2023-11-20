import useCombatHistoryStore from "../../../../../hooks/store/useCombatHistoryStore";
import { AttackHistory } from "./AttackHistory";

type AttackHistoryPanelProps = {};

export const AttackHistoryPanel = ({}: AttackHistoryPanelProps) => {
  const combatHistory = useCombatHistoryStore((state) => state.combatHistory);

  return (
    <div className="relative flex flex-col p-2 min-h-[120px]">
      <div className="flex flex-col">
        {combatHistory.length > 0 && (
          <>
            {combatHistory.map((combatResult, i) => (
              <AttackHistory key={i} combatResult={combatResult} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};
