import { useBattles } from "@/hooks/helpers/useBattles";
import useUIStore from "@/hooks/store/useUIStore";
import { BattleLabel } from "@/ui/components/worldmap/armies/BattleLabel";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { Position } from "@bibliothecadao/eternum";
import { useGLTF } from "@react-three/drei";
import { useCallback, useMemo } from "react";

export const Battles = () => {
  const setSelectedBattle = useUIStore((state) => state.setSelectedBattle);
  const { allBattles } = useBattles();
  const battles = allBattles();

  const onRightClick = useCallback((battle_id: any, position: Position) => {
    setSelectedBattle({ id: BigInt(battle_id), position });
  }, []);

  return (
    <group>
      {battles.map((battle, index) => {
        if (!battle?.x || !battle?.y) return null;
        const { x, y } = getUIPositionFromColRow(battle.x, battle.y, false);
        return (
          <BattleModel
            key={index}
            battle_id={battle.entity_id}
            position={[x, 0.31, -y]}
            onClick={() => onRightClick(battle.entity_id, { x, y })}
          />
        );
      })}
    </group>
  );
};

const BattleModel = ({ battle_id, position, onClick }: { battle_id: any; position: any; onClick: () => void }) => {
  const selectedBattle = useUIStore((state) => state.selectedBattle);

  const showCombatLabel = useMemo(() => {
    return selectedBattle !== undefined && selectedBattle.id === BigInt(battle_id);
  }, [selectedBattle, battle_id]);

  const model = useGLTF("/models/buildings/barracks.glb");
  const clone = useMemo(() => {
    return model.scene.clone();
  }, [model]);

  return (
    <group position={position}>
      {showCombatLabel && <BattleLabel selectedBattle={selectedBattle!.id} />}
      <primitive scale={3} object={clone} onContextMenu={onClick} />
    </group>
  );
};
