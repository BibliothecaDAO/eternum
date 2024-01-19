import { useMemo, useState } from "react";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { Defence } from "./Defence";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../../../DojoContext";
import AttacksComponent from "./AttacksComponent";
import { ManageSoldiersPopupTabs } from "../raids/ManageSoldiersPopupTabs";
import { HealPopup } from "../HealPopup";
import { LevelIndex, useLevel } from "../../../../../hooks/helpers/useLevel";
import { getComponentValue } from "@dojoengine/recs";
import { useHyperstructure } from "../../../../../hooks/helpers/useHyperstructure";

type DefencePanelProps = {};

export const DefencePanel = ({}: DefencePanelProps) => {
  const {
    setup: {
      components: { Health, Realm },
    },
  } = useDojo();

  const [showBuildDefence, setShowBuildDefence] = useState(false);
  const { realmEntityId } = useRealmStore();

  const [showHeal, setShowHeal] = useState(false);

  const { getEntitiesCombatInfo, getEntityWatchTowerId } = useCombat();

  const { getEntityLevel, getRealmLevelBonus } = useLevel();

  const { getConqueredHyperstructures } = useHyperstructure();
  const conqueredHyperstructures = useMemo(() => {
    if (realmEntityId) {
      const order = getComponentValue(Realm, getEntityIdFromKeys([realmEntityId]))?.order;
      return order ? getConqueredHyperstructures(order).length : 0;
    } else {
      return 0;
    }
  }, [realmEntityId]);

  const watchTowerId = getEntityWatchTowerId(realmEntityId);
  const watchTowerHealth = watchTowerId
    ? useComponentValue(Health, getEntityIdFromKeys([BigInt(watchTowerId)]))
    : undefined;

  const watchTower = useMemo(() => {
    const info = watchTowerId ? getEntitiesCombatInfo([watchTowerId]) : undefined;
    if (info?.length === 1) {
      return info[0];
    } else {
      return undefined;
    }
  }, [watchTowerId, watchTowerHealth]);

  const [defenderLevelBonus, defenderHyperstructureLevelBonus] = useMemo(() => {
    let level = watchTower?.entityOwnerId ? getEntityLevel(watchTower.entityOwnerId)?.level || 0 : 0;
    let levelBonus = getRealmLevelBonus(level, LevelIndex.COMBAT);
    let hyperstructureLevelBonus = conqueredHyperstructures * 25 + 100;
    return [levelBonus, hyperstructureLevelBonus];
  }, [watchTower, conqueredHyperstructures]);

  return (
    <div className="relative flex flex-col p-2 min-h-[120px]">
      {showBuildDefence && watchTower && (
        <ManageSoldiersPopupTabs
          headline={"Reinforce Defence"}
          selectedRaider={watchTower}
          onClose={() => setShowBuildDefence(false)}
        />
      )}
      {showHeal && watchTower && <HealPopup selectedRaider={watchTower} onClose={() => setShowHeal(false)} />}
      <div className="flex flex-col p-2">
        {watchTower && (
          <Defence
            onReinforce={() => setShowBuildDefence(!showBuildDefence)}
            levelBonus={defenderLevelBonus}
            conqueredHyperstructures={conqueredHyperstructures}
            setShowHeal={setShowHeal}
            watchTower={watchTower}
          />
        )}
      </div>
      <AttacksComponent />
    </div>
  );
};
