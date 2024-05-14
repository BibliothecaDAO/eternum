import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { createHexagonShape } from "../worldmap/hexagon/HexagonGeometry";
import { HEX_RADIUS } from "../worldmap/hexagon/WorldHexagon";
import { getUIPositionFromColRow, pseudoRandom } from "../../utils/utils";
import { useEffect, useMemo } from "react";
import { useBuildingSound, useShovelSound } from "../../../hooks/useUISound";
import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import { BuildingType, getNeighborHexes } from "@bibliothecadao/eternum";
import { CairoOption, CairoOptionVariant } from "starknet";
import { placeholderMaterial } from "@/shaders/placeholderMaterial";
import { Text, useGLTF } from "@react-three/drei";
import { useBuildings } from "@/hooks/helpers/useBuildings";
import { getNeighbors } from "../worldmap/hexagon/utils";

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

  const handlePlacement = async (col: number, row: number, previewBuilding: BuildingType) => {
    await placeBuilding(realmEntityId, col, row, previewBuilding, selectedResource ?? 0);
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

            {/* {!isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings) && (
              <EmptyCell position={hexPosition} />
            )} */}

            <Hexagon
              position={hexPosition}
              onPointerEnter={() => {
                if (previewBuilding) {
                  setHoveredBuildHex({ col: hexPosition.col, row: hexPosition.row });
                  playShovel();
                }
              }}
              onClick={() => {
                if (previewBuilding && !isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings)) {
                  handlePlacement(hexPosition.col, hexPosition.row, previewBuilding);
                  setPreviewBuilding(null);
                  setHoveredBuildHex(null);
                  playBuildingSound(previewBuilding);
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
      <Text color="black" anchorX="center" anchorY="middle">
        {position.col}, {position.row}
      </Text>
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
  const _color = new THREE.Color("gray");
  const center = { col: 4, row: 4 };
  const RADIUS = 4;
  const positions = [] as any[];
  for (let i = 0; i < RADIUS; i++) {
    if (i === 0) {
      positions.push({
        ...getUIPositionFromColRow(center.col, center.row, true),
        z: 0.315,
        color: _color,
        col: center.col,
        row: center.row,
      });
      getNeighborHexes(center.col, center.row).forEach((neighbor) => {
        positions.push({
          ...getUIPositionFromColRow(neighbor.col, neighbor.row, true),
          z: 0.315,
          color: _color,
          col: neighbor.col,
          row: neighbor.row,
        });
      });
    } else {
      positions.forEach((position) => {
        getNeighborHexes(position.col, position.row).forEach((neighbor) => {
          if (!positions.find((p) => p.col === neighbor.col && p.row === neighbor.row)) {
            positions.push({
              ...getUIPositionFromColRow(neighbor.col, neighbor.row, true),
              z: 0.315,
              color: _color,
              col: neighbor.col,
              row: neighbor.row,
            });
          }
        });
      });
    }
  }

  return positions;
};

export default GroundGrid;
