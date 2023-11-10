import { useMemo, useState } from "react";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { CreateDefencePopup } from "./CreateDefencePopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { getEntityIdFromKeys, getPosition } from "../../../../../utils/utils";
import { EnemyRaid } from "./EnnemyRaid";
import { Defence } from "./Defence";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../../../DojoContext";
import { ReactComponent as CrossSwords } from "../../../../../assets/icons/common/cross-swords.svg";

type MarketPanelProps = {};

export const DefencePanel = ({}: MarketPanelProps) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const [showBuildDefence, setShowBuildDefence] = useState(false);
  const { realmId, realmEntityId } = useRealmStore();
  const realmPosition = getPosition(realmId);

  const { useEnemyRaidersOnPosition, getEntitiesCombatInfo, getRealmWatchTower } = useCombat();
  const attackingEntities = useEnemyRaidersOnPosition(realmPosition);

  const attackingRaiders = useMemo(() => {
    return getEntitiesCombatInfo(attackingEntities);
  }, [attackingEntities]);

  const watchTowerId = getRealmWatchTower(realmEntityId);
  const watchTowerHealth = useComponentValue(Health, getEntityIdFromKeys([BigInt(watchTowerId)]));

  const watchTower = useMemo(() => {
    const info = watchTowerId ? getEntitiesCombatInfo([watchTowerId]) : undefined;
    if (info?.length === 1) {
      return info[0];
    } else {
      return undefined;
    }
  }, [watchTowerId, watchTowerHealth]);

  return (
    <div className="relative flex flex-col p-2 min-h-[120px]">
      {showBuildDefence && <CreateDefencePopup watchTower={watchTower} onClose={() => setShowBuildDefence(false)} />}
      <div className="flex flex-col p-2">
        {watchTower && (
          <Defence
            onReinforce={() => setShowBuildDefence(!showBuildDefence)}
            onHeal={() => {}}
            watchTower={watchTower}
          />
        )}

        {attackingRaiders.length > 0 && (
          <>
            <div className="font-bold text-white text-xs flex justify-center mt-4">
              <CrossSwords className="fill-white mr-2" />
              Raid Attacks
            </div>
            {attackingRaiders.map((raider) => (
              <EnemyRaid key={raider.entityId} raider={raider} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};
