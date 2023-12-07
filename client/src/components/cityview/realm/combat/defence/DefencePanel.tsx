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

type DefencePanelProps = {};

export const DefencePanel = ({}: DefencePanelProps) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const [showBuildDefence, setShowBuildDefence] = useState(false);
  const { realmEntityId } = useRealmStore();

  const [showHeal, setShowHeal] = useState(false);

  const { getEntitiesCombatInfo, getRealmWatchTowerId } = useCombat();

  const { getEntityLevel, getRealmLevelBonus } = useLevel();

  const watchTowerId = getRealmWatchTowerId(realmEntityId);
  const watchTowerHealth = useComponentValue(Health, getEntityIdFromKeys([BigInt(watchTowerId)]));

  const watchTower = useMemo(() => {
    const info = watchTowerId ? getEntitiesCombatInfo([watchTowerId]) : undefined;
    if (info?.length === 1) {
      return info[0];
    } else {
      return undefined;
    }
  }, [watchTowerId, watchTowerHealth]);

  const [defenderLevelBonus, defenderHyperstructureLevelBonus] = useMemo(() => {
    let level = getEntityLevel(watchTower.entityOwnerId)?.level || 0;
    let hyperstructureLevel = getEntityLevel(watchTower.hyperstructureId)?.level || 0;
    let levelBonus = getRealmLevelBonus(level, LevelIndex.COMBAT);
    let hyperstructureLevelBonus = getRealmLevelBonus(hyperstructureLevel, LevelIndex.COMBAT);
    return [levelBonus, hyperstructureLevelBonus];
  }, [watchTower]);

  return (
    <div className="relative flex flex-col p-2 min-h-[120px]">
      {showBuildDefence && (
        <ManageSoldiersPopupTabs
          headline={"Reinforce Defence"}
          selectedRaider={watchTower}
          onClose={() => setShowBuildDefence(false)}
        />
      )}
      {showHeal && <HealPopup selectedRaider={watchTower} onClose={() => setShowHeal(false)} />}
      <div className="flex flex-col p-2">
        {watchTower && (
          <Defence
            onReinforce={() => setShowBuildDefence(!showBuildDefence)}
            levelBonus={defenderLevelBonus}
            hyperstructureLevelBonus={defenderHyperstructureLevelBonus}
            setShowHeal={setShowHeal}
            watchTower={watchTower}
          />
        )}
      </div>
      <AttacksComponent />
    </div>
  );
};
