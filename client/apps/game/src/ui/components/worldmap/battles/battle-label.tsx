import { useUIStore } from "@/hooks/store/use-ui-store";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { Headline } from "@/ui/elements/headline";
import { DurationLeft, ProgressBar } from "@/ui/modules/military/battle-view/battle-progress";
import { divideByPrecision } from "@/ui/utils/utils";
import { BattleManager, ContractAddress, getStructureAtPosition, Structure } from "@bibliothecadao/eternum";
import { useBattlesAtPosition, useDojo, useQuery } from "@bibliothecadao/react";
import { useMemo } from "react";

export const BattleInfoLabel = () => {
  const dojo = useDojo();

  const { isMapView } = useQuery();
  const hoveredBattlePosition = useUIStore((state) => state.hoveredBattle);
  const currentTimestamp = useUIStore.getState().nextBlockTimestamp || 0;

  const battles = useBattlesAtPosition({ x: hoveredBattlePosition?.x || 0, y: hoveredBattlePosition?.y || 0 });
  const structure = getStructureAtPosition(
    { x: hoveredBattlePosition?.x || 0, y: hoveredBattlePosition?.y || 0 },
    ContractAddress(dojo.account.account.address),
    dojo.setup.components,
  );

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
                key={battle}
                battleEntityId={battle}
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
  currentTimestamp,
  structure,
}: {
  battleEntityId: number;
  currentTimestamp: number;
  structure: Structure | undefined;
}) => {
  const dojo = useDojo();

  const battleManager = useMemo(
    () => new BattleManager(dojo.setup.components, dojo.network.provider, battleEntityId),
    [battleEntityId, dojo],
  );

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
