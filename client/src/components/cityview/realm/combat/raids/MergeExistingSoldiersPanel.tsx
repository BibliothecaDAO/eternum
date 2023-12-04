import { useEffect, useMemo, useState } from "react";
import { CombatInfo, useCombat } from "../../../../../hooks/helpers/useCombat";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { Headline } from "../../../../../elements/Headline";
import useUIStore from "../../../../../hooks/store/useUIStore";
import Button from "../../../../../elements/Button";
import { useDojo } from "../../../../../DojoContext";
import { SelectMergeRaiders } from "./SelectMergeRaiders";
import { useResources } from "../../../../../hooks/helpers/useResources";

type MergeSoldiersPanelProps = {
  isDefence: boolean;
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const MergeExistingSoldiersPanel = ({ isDefence, selectedRaider, onClose }: MergeSoldiersPanelProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { merge_soldiers },
    },
  } = useDojo();

  const [selectedRaiders, setSelectedRaiders] = useState<Record<string, number>>({});
  const [canBuild, setCanBuild] = useState(false);
  const [loading, setLoading] = useState(false);

  const { getRealmRaidersOnPosition, getDefenceOnRealm, getEntitiesCombatInfo } = useCombat();

  useEffect(() => {
    if (Object.values(selectedRaiders).reduce((a, b) => a + b, 0) > 0) {
      setCanBuild(true);
    } else {
      setCanBuild(false);
    }
  }, [selectedRaiders]);

  const selectedIsDefence = useMemo(() => {
    return selectedRaider.sec_per_km === 0;
  }, [selectedRaider]);

  const [totalAttack, totalDefence, totalHealth, totalQuantity] = useMemo(() => {
    const raidersInfo = getEntitiesCombatInfo(Object.keys(selectedRaiders).map((id) => parseInt(id)));
    let totalAttack = 0;
    let totalDefence = 0;
    let totalHealth = 0;
    let totalQuantity = 0;
    raidersInfo.forEach((raider) => {
      let proportion = selectedRaiders[raider.entityId] / raider.quantity;
      totalAttack += raider.attack * proportion;
      totalDefence += raider.defence * proportion;
      totalHealth += raider.health * proportion;
      totalQuantity += raider.quantity * proportion;
    });
    return [
      Math.round(totalAttack + selectedRaider.attack),
      Math.round(totalDefence + selectedRaider.defence),
      Math.round(totalHealth + selectedRaider.health),
      Math.round(totalQuantity + selectedRaider.quantity),
    ];
  }, [selectedRaiders]);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const { getResourcesFromInventory } = useResources();

  const realmRaiderIds = getRealmRaidersOnPosition(realmEntityId, selectedRaider.position).filter((id) => {
    const inventoryResources = getResourcesFromInventory(id);
    return id !== selectedRaider.entityId && inventoryResources.resources.length === 0;
  });
  const realmDefence = useMemo(() => {
    const defence = getDefenceOnRealm(realmEntityId);
    return defence.quantity > 0 ? defence : undefined;
  }, [realmEntityId]);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const onBuild = async () => {
    setLoading(true);
    await merge_soldiers({
      signer: account,
      merge_into_unit_id: selectedRaider.entityId,
      units: Object.keys(selectedRaiders).flatMap((unit) => [unit, selectedRaiders[unit]]),
    });
    setLoading(false);
    onClose();
  };

  const realmRaiders = useMemo(() => {
    return getEntitiesCombatInfo(realmRaiderIds);
  }, [realmRaiderIds]);

  return (
    <div>
      <div className="flex flex-col items-center p-2">
        <Headline size="big">Military units</Headline>
        <div className="flex relative mt-1 justify-between text-xxs text-lightest w-full">
          <div className="flex items-center">
            <div className="flex items-center h-6 mr-2">
              <img src="/images/units/troop-icon.png" className="h-[28px]" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold">{`x${totalQuantity} ${isDefence ? "Defenders" : "Raiders"}`}</div>
              </div>
            </div>
          </div>
          <div className="flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Attack power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/attack.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{totalAttack}</div>
              </div>
            </div>
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Defence power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/defence.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{totalDefence}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center">{totalHealth} HP</div>
        </div>
        <SelectMergeRaiders
          selectedRaiders={selectedRaiders}
          setSelectedRaiders={setSelectedRaiders}
          attackingRaiders={realmDefence && !selectedIsDefence ? [realmDefence, ...realmRaiders] : realmRaiders}
        ></SelectMergeRaiders>
      </div>
      <div className="flex flex-col items-end justify-center mr-2 mb-2">
        <div className="flex">
          <Button className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto" onClick={onClose} variant="outline">
            {`Cancel`}
          </Button>
          <Button
            className="!px-[6px] !py-[2px] text-xxs ml-auto"
            disabled={!canBuild}
            onClick={onBuild}
            variant="outline"
            isLoading={loading}
          >
            {`Build`}
          </Button>
        </div>
        {!canBuild && <div className="text-xxs text-order-giants/70">Merge at least 1 unit</div>}
      </div>
    </div>
  );
};
