import { useMemo } from "react";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { getPosition } from "../../../../../utils/utils";
import { EnemyRaid } from "./EnnemyRaid";

type MarketPanelProps = {};

export const EnnemyRaidersPanel = ({}: MarketPanelProps) => {
  const { realmId } = useRealmStore();
  const realmPosition = realmId ? getPosition(realmId) : undefined;

  const { useEnemyRaidersOnPosition, getEntitiesCombatInfo } = useCombat();
  const attackingEntities = realmPosition ? useEnemyRaidersOnPosition(realmPosition) : [];

  const attackingRaiders = useMemo(() => {
    return getEntitiesCombatInfo(attackingEntities);
  }, [attackingEntities]);

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
