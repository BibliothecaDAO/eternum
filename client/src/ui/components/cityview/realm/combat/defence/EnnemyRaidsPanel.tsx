import { useMemo } from "react";
import { useCombat } from "../../../../../../hooks/helpers/useCombat";
import { EnemyRaid } from "./EnnemyRaid";
import clsx from "clsx";

type EnnemyRaidersPanelProps = {
  raiderIds: bigint[];
  className?: string;
};

export const EnnemyRaidersPanel = ({ raiderIds, className }: EnnemyRaidersPanelProps) => {
  const { getEntitiesCombatInfo } = useCombat();

  const attackingRaiders = useMemo(() => {
    return getEntitiesCombatInfo(raiderIds);
  }, [raiderIds]);

  return (
    <div className={clsx("relative flex flex-col", className)}>
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
