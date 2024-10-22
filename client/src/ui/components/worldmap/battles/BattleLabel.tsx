import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useBattlesByPosition } from "@/hooks/helpers/battles/useBattles";
import { useQuery } from "@/hooks/helpers/useQuery";
import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { DurationLeft, ProgressBar } from "@/ui/modules/military/battle-view/BattleProgressBar";
import { divideByPrecision } from "@/ui/utils/utils";
import { useMemo } from "react";

export const BattleInfoLabel = () => {
  const dojo = useDojo();
  const { isMapView } = useQuery();
  const hoveredBattlePosition = useUIStore((state) => state.hoveredBattle);
  const currentTimestamp = useUIStore.getState().nextBlockTimestamp || 0;

  const battles = useBattlesByPosition({ x: hoveredBattlePosition?.x || 0, y: hoveredBattlePosition?.y || 0 });

  const battleManager = useMemo(() => new BattleManager(battles[0]?.entity_id || 0, dojo), [battles, dojo]);

  const { attackerHealth, defenderHealth, isOngoing } = useMemo(() => {
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
    };
  }, [battleManager, currentTimestamp]);

  return (
    <>
      {battles[0]?.entity_id && isMapView && (
        <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-[250px]`}>
          <div id="battle-label" className="flex flex-col gap-1 w-full">
            <Headline className="text-center text-lg">
              <div>{"Battle"}</div>
            </Headline>
            <div className="flex justify-center items-center space-x-2">
              <span className="">{Number(divideByPrecision(Number(attackerHealth.current))).toFixed(0)} troops</span>
              <span className="font-bold">vs</span>
              <span className="">{Number(divideByPrecision(Number(defenderHealth.current))).toFixed(0)} troops</span>
            </div>
            <ProgressBar className={"w-full"} attackingHealth={attackerHealth} defendingHealth={defenderHealth} />
            <div className="text-center">
              {isOngoing && (
                <DurationLeft battleManager={battleManager} currentTimestamp={currentTimestamp} structure={undefined} />
              )}
            </div>
          </div>
        </BaseThreeTooltip>
      )}
    </>
  );
};
