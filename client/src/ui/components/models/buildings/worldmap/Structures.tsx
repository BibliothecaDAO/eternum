import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { StructureType } from "@bibliothecadao/eternum";
import useUIStore from "@/hooks/store/useUIStore";
import { HyperstructureEventInterface } from "@/dojo/events/hyperstructureEventQueries";
import useLeaderBoardStore from "@/hooks/store/useLeaderBoardStore";
import { CombatLabel } from "@/ui/components/worldmap/armies/CombatLabel";

export const Structures = () => {
  const models = useMemo(
    () => [
      useGLTF("/models/buildings/hyperstructure-half-transformed.glb"),
      useGLTF("/models/buildings/castle.glb"),
      useGLTF("/models/buildings/hyperstructure.glb"),
      useGLTF("/models/buildings/bank.glb"),
      useGLTF("/models/buildings/mine.glb"),
      useGLTF("/models/buildings/castle.glb"),
    ],
    [],
  );

  const existingStructures = useUIStore((state) => state.existingStructures);
  return existingStructures.map((structure, index) => {
    return <BuiltStructure key={index} structure={structure} models={models} structureCategory={structure.type} />;
  });
};

const BuiltStructure = ({
  structure,
  models,
  structureCategory,
  rotation,
}: {
  structure: any;
  models: any;
  structureCategory: number;
  rotation?: THREE.Euler;
}) => {
  const [model, setModel] = useState(models[0].scene.clone());
  const { x, y } = getUIPositionFromColRow(structure.col, structure.row, false);
  const finishedHyperstructures = useLeaderBoardStore((state) => state.finishedHyperstructures);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  // const { camera } = useThree();

  const isAttackable = useMemo(() => {
    if (
      selectedEntity &&
      selectedEntity!.position.x === structure.col &&
      selectedEntity!.position.y === structure.row
    ) {
      return true;
    }
    return false;
  }, [selectedEntity]);

  useEffect(() => {
    let category = structureCategory;
    let model = models[category];
    model.scene.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.material = child.material.clone();
        child.material.transparent = false;
        child.material.opacity = 1; // Adjust opacity level as needed
      }
    });

    setModel(model.scene.clone());

    if (structureCategory === StructureType.Hyperstructure) {
      category = finishedHyperstructures.some((evt: HyperstructureEventInterface) => {
        return evt.hyperstructureEntityId == structure.entityId;
      })
        ? structureCategory
        : 0;
      let model = models[category];
      model.scene.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.material = child.material.clone();
          child.material.transparent = false;
          child.material.opacity = 1; // Adjust opacity level as needed
        }
      });
      setModel(model.scene.clone());
    }
  }, [models, finishedHyperstructures]);

  const scale = structureCategory === StructureType.Hyperstructure ? 1.5 : 3;
  // const { power, lpos, color } = useControls("Structures Light", {
  //   power: { value: 300, min: 0, max: 1000, step: 1 },
  //   lpos: {
  //     value: {
  //       x: 0,
  //       y: 7,
  //       z: 0,
  //     },
  //     min: -10,
  //     max: 10,
  //     step: 0.1,
  //   },
  //   color: { value: "#fcffbc", label: "Color" },
  // });

  // const pLight = useRef<any>(null);

  // if (import.meta.env.DEV) {
  //   useHelper(pLight, THREE.SpotLightHelper, "hotpink");
  // }

  // useEffect(() => {
  //   if (!pLight.current) return;
  //   pLight.current.target.position.x = x;
  //   pLight.current.target.position.z = -y;
  // }, [x, y, pLight]);

  // useFrame(({ camera }) => {
  //   if (!pLight.current) return;
  //   const distance = camera.position.distanceTo(new THREE.Vector3(x, 0, -y));
  //   pLight.current.power = Math.max(0, power * (1 - (distance - 130) / 250));
  // });

  // const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  return (
    <group position={[x, 0.31, -y]} rotation={rotation}>
      {isAttackable && (
        <CombatLabel
          structureEntityId={structure.entityId}
          attackerEntityId={selectedEntity!.id}
          isTargetMine={structure.isMine}
        />
      )}
      <primitive dropShadow scale={scale} object={model!} />
      {/* <Detailed distances={[0, 350]}>
        <pointLight
          ref={pLight}
          distance={12}
          //penumbra={0}
          position={[lpos.x, lpos.y, lpos.z]}
          color={color}
          power={power}
        />
        <mesh />
      </Detailed> */}
    </group>
  );
};
