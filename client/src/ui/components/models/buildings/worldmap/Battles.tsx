import { useBattles } from "@/hooks/helpers/useBattles";
import useUIStore from "@/hooks/store/useUIStore";
import { BattleLabel } from "@/ui/components/worldmap/armies/BattleLabel";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { Position } from "@bibliothecadao/eternum";
import { useGLTF, Billboard, Image, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";

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
        if (BigInt(battle!.attack_army_health.current) === 0n && BigInt(battle!.defence_army_health.current) === 0n)
          return null;
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
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const armyLabel = useTexture("/textures/army_label.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
  });

  const showBattleLabel = useMemo(() => {
    return selectedEntity === undefined && selectedBattle !== undefined && selectedBattle.id === BigInt(battle_id);
  }, [selectedBattle, battle_id]);

  const model = useGLTF("/models/buildings/barracks.glb");
  const clone = useMemo(() => {
    return model.scene.clone();
  }, [model]);

  const testRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (testRef.current) {
      // make color pulse red based on time
      const time = state.clock.getElapsedTime();
      testRef.current.material.color.set(Math.sin(time * 4) + 2, 0, 0);
    }
  });

  return (
    <group position={position}>
      {showBattleLabel && <BattleLabel selectedBattle={selectedBattle!.id} />}
      <primitive scale={3} object={clone} onContextMenu={onClick} />
      <Billboard>
        <Image
          ref={testRef}
          texture={armyLabel}
          scale={2.2}
          position={[0, 5, 5]}
          side={THREE.DoubleSide}
          transparent
          renderOrder={5}
          color={[2, 0, 0]}
        />
      </Billboard>
    </group>
  );
};
