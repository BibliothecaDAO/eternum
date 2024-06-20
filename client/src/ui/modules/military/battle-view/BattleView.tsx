import { useBattleManagerByPosition } from "@/hooks/helpers/useBattles";
import useUIStore from "@/hooks/store/useUIStore";
import { BattleStarter } from "./BattleStarter";
import { OngoingOrFinishedBattle } from "./OngoingOrFinishedBattle";

export const BattleView = () => {
  const battleView = useUIStore((state) => state.battleView);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const battleManager = useBattleManagerByPosition(
    battleView?.battle || { x: selectedEntity!.position.x, y: selectedEntity!.position.y },
  );

  return battleManager ? (
    <OngoingOrFinishedBattle battleManager={battleManager} />
  ) : (
    <BattleStarter target={battleView!.target!} />
  );
};
