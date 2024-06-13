import { useBattles } from "@/hooks/helpers/useBattles";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";

export const Battles = () => {
  const { allBattles } = useBattles();
  const battles = allBattles();

  return (
    <group>
      {battles.map((battle, index) => {
        if (!battle?.x || !battle?.y) return null;
        const { x, y } = getUIPositionFromColRow(battle.x, battle.y, false);
        return <BattleModel key={index} position={[x, 0.31, -y]} onClick={() => {}} />;
      })}
    </group>
  );
};

const BattleModel = ({ position, onClick }: { position: any; onClick: () => void }) => {
  const model = useGLTF("/models/buildings/barracks.glb");
  const clone = useMemo(() => {
    return model.scene.clone();
  }, [model]);

  return <primitive scale={3} object={clone} position={position} onClick={onClick} />;
};
