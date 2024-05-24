import { useDojo } from "@/hooks/context/DojoContext";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue } from "@dojoengine/recs";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { StructureType } from "@bibliothecadao/eternum";
import useUIStore from "@/hooks/store/useUIStore";

export const Structures = () => {
  const models = useMemo(
    () => [
      useGLTF("/models/buildings/castle.glb"),
      useGLTF("/models/buildings/castle.glb"),
      useGLTF("/models/buildings/hyperstructure.glb"),
      useGLTF("/models/buildings/bank.glb"),
      useGLTF("/models/buildings/mine.glb"),
      useGLTF("/models/buildings/castle.glb"),
    ],
    [],
  );

  const { setup } = useDojo();

  const existingStructures = useUIStore((state) => state.existingStructures);
  const setExistingStructures = useUIStore((state) => state.setExistingStructures);

  const builtStructures = useEntityQuery([Has(setup.components.Structure)]);

  const _tmp = useMemo(() => {
    return builtStructures.map((entity) => {
      const position = getComponentValue(setup.components.Position, entity);
      const structure = getComponentValue(setup.components.Structure, entity);
      const type = StructureType[structure!.category as keyof typeof StructureType];
      return {
        col: position!.x,
        row: position!.y,
        type: type as StructureType,
        entity: entity,
      };
    });
  }, [builtStructures.length]);

  useEffect(() => {
    setExistingStructures(_tmp);
  }, [_tmp]);

  return existingStructures.map((structure, index) => {
    return <BuiltStructure key={index} position={structure} models={models} structureCategory={structure.type} />;
  });
};

const BuiltStructure = ({
  position,
  models,
  structureCategory,
  rotation,
}: {
  position: any;
  models: any;
  structureCategory: number;
  rotation?: THREE.Euler;
}) => {
  const { x, y } = getUIPositionFromColRow(position.col, position.row, false);

  const model = useMemo(() => {
    let model = models[structureCategory];
    if (!model) return new THREE.Mesh();
    model.scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.material = child.material.clone();
        child.material.transparent = false;
        child.material.opacity = 1; // Adjust opacity level as needed
      }
    });
    return model.scene.clone();
  }, [models]);

  const scale = structureCategory === StructureType.Hyperstructure ? 1.5 : 3;

  return (
    <group position={[x, 0.31, -y]} rotation={rotation}>
      <primitive dropShadow scale={scale} object={model} />
    </group>
  );
};
