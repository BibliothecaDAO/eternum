import { useDojo } from "@/hooks/context/DojoContext";
import { getUserArmiesAtPosition, useArmiesByBattleId } from "@/hooks/helpers/useArmies";
import { getStructureAtPosition } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BattleFinisher } from "./BattleFinisher";
import { OngoingBattle } from "./OngoingBattle";
import { BattleManager } from "@/dojo/modelManager/BattleManager";

export const OngoingOrFinishedBattle = ({ battleManager }: { battleManager: BattleManager }) => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);

  const position = getComponentValue(Position, getEntityIdFromKeys([battleManager.battleId]));
  const battlePosition = { x: position!.x, y: position!.y };
  const structure = getStructureAtPosition(battlePosition);

  const { userArmies } = getUserArmiesAtPosition(battlePosition);

  const armiesInBattle = useArmiesByBattleId(battleManager.battleId);

  return battleManager.battleActive(currentDefaultTick) ? (
    <OngoingBattle
      structure={structure}
      battleManager={battleManager}
      ownArmyEntityId={selectedEntity?.id}
      armiesInBattle={armiesInBattle}
      userArmiesAtPosition={userArmies}
    />
  ) : (
    <BattleFinisher
      structure={structure}
      battleManager={battleManager}
      selectedEntityId={selectedEntity?.id}
      position={position!}
      armiesInBattle={armiesInBattle}
      userArmiesAtPosition={userArmies}
    />
  );
};
