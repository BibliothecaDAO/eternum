import { useMemo } from "react";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { EnemyRaid } from "./EnnemyRaid";

type MarketPanelProps = {
  raiderIds: bigint[];
};

export const EnnemyRaidersPanel = ({ raiderIds }: MarketPanelProps) => {
  const { getEntitiesCombatInfo } = useCombat();

  const attackingRaiders = useMemo(() => {
    return getEntitiesCombatInfo(raiderIds);
  }, [raiderIds]);

  return (
    <div className="relative flex flex-col p-2 min-h-[120px]">
      {attackingRaiders.length > 0 && (
        <>
          {attackingRaiders.map((raider) => (
            <EnemyRaid key={raider.entityId} raider={raider} />
          ))}
        </>
      )}
    </div>
  );
};
