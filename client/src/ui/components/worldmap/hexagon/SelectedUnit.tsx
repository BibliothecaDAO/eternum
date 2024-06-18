import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { Image, Points } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";

interface SelectedUnitProps {
  position: {
    x: number;
    y: number;
  };
}

const PARTICLES_COUNT = 30;
const PARTICLE_SPEED = 0.1;
const PARTICLE_RESET_Y = 5;
const PARTICLE_START_Y = -5;
const PARICLE_COLOR = 0xf9e076;

export const SelectedUnit = ({ position }: SelectedUnitProps) => {
  const imageRef = useRef<any>();
  const [pointsPositions, setPointsPositions] = useState(() => {
    const arr = new Float32Array(PARTICLES_COUNT * 3);
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      arr[i * 3] = Math.random() * 4 - 2; // x
      arr[i * 3 + 1] = Math.random() * 10 - 5; // y
      arr[i * 3 + 2] = Math.random() * 5 - 5; // z
    }
    return arr;
  });

  useFrame(() => {
    if (imageRef.current) {
      imageRef.current.rotation.z += 0.01;
    }

    const newPositions = new Float32Array(pointsPositions);
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      newPositions[i * 3 + 1] += PARTICLE_SPEED;
      if (newPositions[i * 3 + 1] > PARTICLE_RESET_Y) {
        newPositions[i * 3 + 1] = PARTICLE_START_Y;
      }
    }
    setPointsPositions(newPositions);
  });

  const selectedUnitPosition = useMemo(() => {
    if (!position) return { x: 0, y: 0 };
    return getUIPositionFromColRow(position.x, position.y);
  }, [position]);

  return (
    <group position={[selectedUnitPosition.x, 0, -selectedUnitPosition.y]}>
      <Image
        ref={imageRef}
        position={[0, 0.6, 0]}
        zoom={1}
        opacity={0.2}
        transparent
        scale={5}
        url="/textures/aura.png"
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
        color={PARICLE_COLOR}
      />
      <Points limit={PARTICLES_COUNT} range={PARTICLES_COUNT} positions={pointsPositions}>
        <pointsMaterial color={PARICLE_COLOR} size={1} />
      </Points>
      <pointLight position={[0, 1.5, 0]} power={25} />
    </group>
  );
};
