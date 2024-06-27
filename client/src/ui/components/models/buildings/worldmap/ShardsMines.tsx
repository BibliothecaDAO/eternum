import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { Billboard, useGLTF, Image, useTexture } from "@react-three/drei";
import { useMemo } from "react";
import { useEntityQuery } from "@dojoengine/react";
import { HasValue, getComponentValue } from "@dojoengine/recs";
import { useDojo } from "@/hooks/context/DojoContext";
import * as THREE from "three";

export const ShardsMines = () => {
  const { setup } = useDojo();
  const mines = useEntityQuery([HasValue(setup.components.Structure, { category: "FragmentMine" })]);

  const minesPositions = useMemo(() => {
    return Array.from(mines).map((mine) => {
      const position = getComponentValue(setup.components.Position, mine);
      return {
        position: position!,
        entityId: position?.entity_id,
        uiPos: getUIPositionFromColRow(position?.x || 0, position?.y || 0, false),
      };
    });
  }, [mines]);

  const handleModelClick = (entityId: any) => {};

  return (
    <group>
      {minesPositions.map((mine, index) => {
        return (
          <ShardsMineModel
            key={index}
            position={[mine.uiPos.x, 0.35, -mine.uiPos.y]}
            onClick={() => handleModelClick(mine.entityId)}
          />
        );
      })}
    </group>
  );
};

const ShardsMineModel = ({ position, onClick }: { position: any; onClick: () => void }) => {
  const shardsMineModel = useGLTF("/models/buildings/mine.glb");
  const shardLabel = useTexture("/textures/shard_label.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
  });

  const clone = useMemo(() => {
    return shardsMineModel.scene.clone();
  }, [shardsMineModel]);

  return (
    <group position={position}>
      <primitive scale={3} object={clone} onClick={onClick} />
      <Billboard>
        <Image
          texture={shardLabel}
          scale={2.3}
          position={[0, 5, 0]}
          side={THREE.DoubleSide}
          transparent
          renderOrder={2}
        />
      </Billboard>
    </group>
  );
};
