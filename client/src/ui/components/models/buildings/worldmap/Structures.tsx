import { useDojo } from "@/hooks/context/DojoContext";
// import { ModelsIndexes } from "@/ui/components/construction/ExistingBuildings";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue } from "@dojoengine/recs";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { StructureStringToEnum, StructureType } from "@bibliothecadao/eternum";
import useUIStore from "@/hooks/store/useUIStore";

export const Structures = () => {
  //   const models = useMemo(
  //     () => ({
  //       [ModelsIndexes.Castle]: useGLTF("/models/buildings/castle.glb"),
  //       [ModelsIndexes.Bank]: useGLTF("/models/buildings/bank.glb"),
  //       [ModelsIndexes.Hyperstructure]: useGLTF("/models/buildings/bank.glb"),
  //       [ModelsIndexes.Settlement]: useGLTF("/models/buildings/barracks.glb"),
  //     }),
  //     [],
  //   );

  const models = useMemo(
    () => [
      useGLTF("/models/buildings/castle.glb"),
      useGLTF("/models/buildings/bank.glb"),
      useGLTF("/models/buildings/bank.glb"),
      useGLTF("/models/buildings/barracks.glb"),
    ],
    [],
  );

  const { setup } = useDojo();

  const existingStructures = useUIStore((state) => state.existingStructures);
  const setExistingStructures = useUIStore((state) => state.setExistingStructures);

  const builtStructures = useEntityQuery([Has(setup.components.Realm)]);

  useEffect(() => {
    let _tmp = builtStructures.map((entity) => {
      const position = getComponentValue(setup.components.Position, entity);
      const type = StructureStringToEnum["Realm"];
      return {
        col: position!.x,
        row: position!.y,
        type: type as StructureType,
        entity: entity,
      };
    });
    setExistingStructures(_tmp);
  }, [builtStructures]);
  console.log({ existingStructures });

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

  console.log({ model });

  return (
    <group position={[x, 0.31, -y]} rotation={rotation}>
      <primitive dropShadow scale={3} object={model} />
    </group>
  );
};
