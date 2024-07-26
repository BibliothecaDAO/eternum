import { useDojo } from "@/hooks/context/DojoContext";
import { useAllBattles } from "@/hooks/helpers/battles/useBattles";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { HasValue, runQuery } from "@dojoengine/recs";
import { Billboard, Image, useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export const Battles = () => {
  const {
    setup: {
      components: { Army },
    },
  } = useDojo();

  const battles = useAllBattles();

  const nonEmptyBattles = useMemo(() => {
    return battles.filter((battle) => runQuery([HasValue(Army, { battle_id: battle.entity_id })]).size > 0);
  }, [battles]);

  return (
    <group>
      {nonEmptyBattles.map((battle, index) => {
        if (!battle?.position.x || !battle?.position.y) return null;
        const { x, y } = getUIPositionFromColRow(battle.position.x, battle.position.y, false);
        return <BattleModel key={index} position={[x, 0.31, -y]} />;
      })}
    </group>
  );
};

const BattleModel = ({ position }: { position: any }) => {
  const armyLabel = useTexture("/textures/army_label.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
  });

  const model = useGLTF("/models/buildings/barracks.glb");
  const clone = useMemo(() => {
    return model.scene.clone();
  }, [model]);

  const testRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (testRef.current) {
      // make color pulse red based on time
      const time = state.clock.getElapsedTime();
      const material = testRef.current.material as any;
      material.color.set(Math.sin(time * 4) + 2, 0, 0);
    }
  });

  return (
    <group position={position}>
      <primitive scale={3} object={clone} />
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
