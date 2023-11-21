import { useMemo, useState } from "react";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { CreateDefencePopup } from "./CreateDefencePopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { Defence } from "./Defence";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../../../DojoContext";
import AttacksComponent from "./AttacksComponent";

type MarketPanelProps = {};

export const DefencePanel = ({}: MarketPanelProps) => {
  const {
    setup: {
      components: { Health },
    },
  } = useDojo();

  const [showBuildDefence, setShowBuildDefence] = useState(false);
  const { realmEntityId } = useRealmStore();

  const { getEntitiesCombatInfo, getRealmWatchTower } = useCombat();

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
      </div>
      <AttacksComponent />
    </div>
  );
};
