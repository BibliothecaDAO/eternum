import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { createHexagonShape } from "../worldmap/hexagon/HexagonGeometry";
import { HEX_RADIUS } from "../worldmap/hexagon/WorldHexagon";
import { getUIPositionFromColRow, pseudoRandom } from "../../utils/utils";
import { useEffect, useMemo, useState } from "react";
import { useBuildingSound, useShovelSound } from "../../../hooks/useUISound";
import useRealmStore from "@/hooks/store/useRealmStore";
import { BuildingType, getNeighborHexes } from "@bibliothecadao/eternum";
import { placeholderMaterial } from "@/shaders/placeholderMaterial";
import { Text, useGLTF } from "@react-three/drei";
import { useBuildings } from "@/hooks/helpers/useBuildings";

export const isHexOccupied = (col: number, row: number, buildings: any[]) => {
  return buildings.some((building) => building.col === col && building.row === row) || (col === 4 && row === 4);
};

const GroundGrid = () => {
  const hexPositions = useMemo(() => generateHexPositions(), []);
  const { playBuildingSound } = useBuildingSound();
  const { play: playShovel } = useShovelSound();
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const setHoveredBuildHex = useUIStore((state) => state.setHoveredBuildHex);
  const existingBuildings = useUIStore((state) => state.existingBuildings);
  const selectedResource = useUIStore((state) => state.selectedResource);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const { realmEntityId } = useRealmStore();
  const { placeBuilding } = useBuildings();
  const [isLoading, setIsLoading] = useState(false); // Loading state renamed to isLoading

  const handlePlacement = async (col: number, row: number, previewBuilding: BuildingType) => {
    if (isLoading) return; // Prevent multiple submissions
    setIsLoading(true);
    try {
      await placeBuilding(realmEntityId, col, row, previewBuilding, selectedResource ?? 0);
      setPreviewBuilding(null);
      setHoveredBuildHex(null);
      playBuildingSound(previewBuilding);
    } catch (error) {
      console.error("Failed to place building:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    setPreviewBuilding(null);
  }, [realmEntityId]);

  return (
    <>
      <group rotation={[Math.PI / -2, 0, 0]} position={[0, 2, 0]}>
        {hexPositions.map((hexPosition, index) => (
          <group key={index}>
            {!isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings) && previewBuilding && (
              <mesh
                name="free-cell-placeholder"
                position={[hexPosition.x, hexPosition.y, hexPosition.z + 0.1]}
                geometry={hexagonGeometry}
                material={placeholderMaterial}
              />
            )}

            {!isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings) && (
              <EmptyCell position={hexPosition} />
            )}

            <Hexagon
              position={hexPosition}
              onPointerEnter={() => {
                if (previewBuilding && !isLoading) {
                  setHoveredBuildHex({ col: hexPosition.col, row: hexPosition.row });
                  playShovel();
                }
              }}
              onClick={() => {
                if (
                  previewBuilding &&
                  !isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings) &&
                  !isLoading
                ) {
                  handlePlacement(hexPosition.col, hexPosition.row, previewBuilding);
                }
              }}
            />
          </group>
        ))}
      </group>
    </>
  );
};

const bigHexagonShape = createHexagonShape(HEX_RADIUS);
const smallHexagonShape = createHexagonShape(HEX_RADIUS * 0.5);
bigHexagonShape.holes.push(smallHexagonShape);

const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);
const invisibleHexagonGeometry = new THREE.ShapeGeometry(smallHexagonShape);
const mainColor = new THREE.Color(0.21389107406139374, 0.14227265119552612, 0.06926480680704117);
const mainMaterial = new THREE.MeshStandardMaterial({ color: mainColor });
const invisibleMaterial = new THREE.MeshStandardMaterial({ color: mainColor, transparent: true, opacity: 0 });

export const Hexagon = ({
  position,
  onClick,
  onPointerEnter,
}: {
  position: any;
  onClick: any;
  onPointerEnter: any;
}) => {
  return (
    <group position={[position.x, position.y, position.z]} onPointerEnter={onPointerEnter} onClick={onClick}>
      <mesh receiveShadow geometry={hexagonGeometry} material={mainMaterial} />
      <mesh receiveShadow geometry={invisibleHexagonGeometry} material={invisibleMaterial} />
    </group>
  );
};

const EmptyCell = ({ position }: { position: any }) => {
  const emptyCellModel = useGLTF("/models/buildings/empty.glb");
  const clone = useMemo(() => {
    const clone = emptyCellModel.scene.clone();
    clone.scale.set(3, 3, 3);
    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [emptyCellModel]);
  const rotation = useMemo(() => {
    const seededRandom = pseudoRandom(position.col, position.row);
    return (Math.PI / 3) * Math.floor(seededRandom * 6);
  }, [position]);
  return (
    <primitive object={clone} position={[position.x, position.y, position.z]} rotation={[Math.PI / 2, rotation, 0]} />
  );
};

export const generateHexPositions = () => {
  const color = new THREE.Color("gray");
  const center = { col: 10, row: 10 };
  const RADIUS = 4;
  const positions: any[] = [];
  const positionSet = new Set(); // To track existing positions

  // Helper function to add position if not already added
  const addPosition = (col: number, row: number) => {
    const key = `${col},${row}`;
    if (!positionSet.has(key)) {
      const position = {
        ...getUIPositionFromColRow(col, row, true),
        z: 0.315,
        color,
        col,
        row,
      };
      positions.push(position);
      positionSet.add(key);
    }
  };

  // Add center position
  addPosition(center.col, center.row);

  // Generate positions in expanding hexagonal layers
  let currentLayer = [center];
  for (let i = 0; i < RADIUS; i++) {
    const nextLayer: any = [];
    currentLayer.forEach((pos) => {
      getNeighborHexes(pos.col, pos.row).forEach((neighbor) => {
        if (!positionSet.has(`${neighbor.col},${neighbor.row}`)) {
          addPosition(neighbor.col, neighbor.row);
          nextLayer.push({ col: neighbor.col, row: neighbor.row });
        }
      });
    });
    currentLayer = nextLayer; // Move to the next layer
  }

  return positions;
};

export default GroundGrid;
