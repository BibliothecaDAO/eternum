import useUIStore from "../../../hooks/store/useUIStore";
import * as THREE from "three";
import { createHexagonShape } from "../worldmap/hexagon/HexagonGeometry";
import { HEX_RADIUS } from "../worldmap/hexagon/WorldHexagon";
import { getUIPositionFromColRow, pseudoRandom } from "../../utils/utils";
import { useEffect, useMemo } from "react";
import { useBuildingSound, useShovelSound } from "../../../hooks/useUISound";
import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import { BuildingType } from "@bibliothecadao/eternum";
import { CairoOption, CairoOptionVariant } from "starknet";
import { placeholderMaterial } from "@/shaders/placeholderMaterial";
import { useGLTF } from "@react-three/drei";
import { useBuildings } from "@/hooks/helpers/useBuildings";

export const isHexOccupied = (col: number, row: number, buildings: any[]) => {
  return buildings.some((building) => building.col === col && building.row === row) || (col === 4 && row === 4);
};

const GroundGrid = () => {
  const hexPositions = useMemo(() => generateHexPositions(), []);
  const { playBuildingSound } = useBuildingSound();
  const { play: playShovel } = useShovelSound();
  const { previewBuilding, setHoveredBuildHex, existingBuildings, selectedResource, setPreviewBuilding } = useUIStore(
    (state) => state,
  );
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

            {!isHexOccupied(hexPosition.col, hexPosition.row, existingBuildings) && (
              <EmptyCell position={hexPosition} />
            )}

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

const hexagonGeometry = new THREE.ShapeGeometry(createHexagonShape(HEX_RADIUS));
const mainColor = new THREE.Color(0.21389107406139374, 0.14227265119552612, 0.06926480680704117);
const secondaryColor = mainColor.clone().lerp(new THREE.Color(1, 1, 1), 0.2);
const mainMaterial = new THREE.MeshStandardMaterial({ color: mainColor });
const secondaryMaterial = new THREE.MeshStandardMaterial({ color: secondaryColor });

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
      <mesh receiveShadow geometry={hexagonGeometry} scale={0.5} position={[0, 0, 0.01]} material={secondaryMaterial} />
      <mesh receiveShadow geometry={hexagonGeometry} material={mainMaterial} />
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
  const addOffset = center.row % 2 === 0 && center.row > 0 ? 0 : 1;
  const radius = 4;
  const positions = [] as any[];
  const normalizedCenter = { col: 4, row: 4 };
  const shifted = { col: center.col - normalizedCenter.col, row: center.row - normalizedCenter.row };
  for (let _row = normalizedCenter.row - radius; _row <= normalizedCenter.row + radius; _row++) {
    const basicCount = 9;
    const decrease = Math.abs(_row - radius);
    const colsCount = basicCount - decrease;
    let startOffset = _row % 2 === 0 ? (decrease > 0 ? Math.floor(decrease / 2) : 0) : Math.floor(decrease / 2);
    if (addOffset > 0 && _row % 2 !== 0) {
      if (center.row < 0 && center.row % 2 === 0) startOffset += 1;
    }
    for (
      let _col = startOffset + normalizedCenter.col - radius;
      _col < normalizedCenter.col - radius + colsCount + startOffset;
      _col++
    ) {
      positions.push({
        ...getUIPositionFromColRow(_col + shifted.col, _row + shifted.row, true),
        z: 0.315,
        color: _color,
        col: _col + shifted.col,
        row: _row + shifted.row,
        startOffset: startOffset,
      });
    }
  }

  return positions;
};

export default GroundGrid;
