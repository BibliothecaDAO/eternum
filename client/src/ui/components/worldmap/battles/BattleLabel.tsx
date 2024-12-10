import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { DojoResult, useDojo } from "@/hooks/context/DojoContext";
import { useBattlesByPosition } from "@/hooks/helpers/battles/useBattles";
import { useQuery } from "@/hooks/helpers/useQuery";
import { Structure, useStructureByPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { DurationLeft, ProgressBar } from "@/ui/modules/military/battle-view/BattleProgress";
import { divideByPrecision } from "@/ui/utils/utils";
import { useMemo } from "react";

export const BattleInfoLabel = () => {
  const dojo = useDojo();
  const { isMapView } = useQuery();
  const getStructure = useStructureByPosition();
  const hoveredBattlePosition = useUIStore((state) => state.hoveredBattle);
  const currentTimestamp = useUIStore.getState().nextBlockTimestamp || 0;

  const battles = useBattlesByPosition({ x: hoveredBattlePosition?.x || 0, y: hoveredBattlePosition?.y || 0 }).filter(
    (battle) => battle.duration_left > 0,
  );

  const structure = getStructure({ x: hoveredBattlePosition?.x || 0, y: hoveredBattlePosition?.y || 0 });

  return (
    <>
      {battles.length > 0 && isMapView && (
        <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-[250px]`}>
          <div id="battle-label" className="flex flex-col gap-4 w-full">
            <Headline className="text-center text-lg">
              <div>{`Battles (${battles.length})`}</div>
            </Headline>
            {battles.map((battle) => (
              <BattleInfo
                key={battle.entity_id}
                battleEntityId={battle.entity_id}
                dojo={dojo}
                currentTimestamp={currentTimestamp}
                structure={structure as Structure}
              />
            ))}
          </div>
        </BaseThreeTooltip>
      )}
    </>
  );
};

const BattleInfo = ({
  battleEntityId,
  dojo,
  currentTimestamp,
  structure,
}: {
  battleEntityId: number;
  dojo: DojoResult;
  currentTimestamp: number;
  structure: Structure | undefined;
}) => {
  const battleManager = useMemo(() => new BattleManager(battleEntityId, dojo), [battleEntityId, dojo]);

  const { attackerHealth, defenderHealth, isOngoing, isSiege } = useMemo(() => {
    const adjustedBattle = battleManager.getUpdatedBattle(currentTimestamp);
    return {
      attackerHealth: {
        current: adjustedBattle?.attack_army_health.current || 0n,
        lifetime: adjustedBattle?.attack_army_health.lifetime || 0n,
      },
      defenderHealth: {
        current: adjustedBattle?.defence_army_health.current || 0n,
        lifetime: adjustedBattle?.defence_army_health.lifetime || 0n,
      },
      isOngoing: battleManager.isBattleOngoing(currentTimestamp),
      isSiege: battleManager.isSiege(currentTimestamp),
    };
  }, [battleManager, currentTimestamp]);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-center items-center space-x-2">
        <span className="">{Number(divideByPrecision(Number(attackerHealth.current))).toFixed(0)} troops</span>
        <span className="font-bold">vs</span>
        <span className="">{Number(divideByPrecision(Number(defenderHealth.current))).toFixed(0)} troops</span>
      </div>
      <ProgressBar className={"w-full"} attackingHealth={attackerHealth} defendingHealth={defenderHealth} />
      <div className="text-center">
        {(isOngoing || isSiege) && (
          <DurationLeft battleManager={battleManager} currentTimestamp={currentTimestamp} structure={structure} />
        )}
      </div>
    </div>
  );
};
