import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { extend } from "@react-three/fiber";
import { OrbitControls, Text, Cone } from "@react-three/drei";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue } from "@dojoengine/recs";
// import { useStateStore } from "@/hooks/useStateStore";
// import { useDojo } from "@/dojo/useDojo";
// import { Troop } from "./Troop";
// import { isEnergySource, offset } from "@/utils";
// import { SquadOnHex } from "./SquadOnHex";
import { snoise } from "@dojoengine/utils";
// import { useGameState } from "@/hooks/useGameState";

export const MAP_AMPLITUDE = 10;

export const createHexagonGeometry = (radius: number, depth: number) => {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Adjust the angle to start the first point at the top
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }
  shape.closePath();

  // Extrude settings
  const extrudeSettings = {
    steps: 1,
    depth,
    bevelEnabled: false,
    // bevelEnabled: true,
    // bevelThickness: 0.1,
    // bevelSize: 0.1,
    // bevelSegments: 1,
  };

  // Create a geometry by extruding the shape
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
};

export const HexagonBackground = ({ position, radius, col, row }: any) => {
  //   const {
  //     setup: {
  //       clientComponents: { Position, Base },
  //     },
  //   } = useDojo();

  //   const { moveToHex, setMoveToHex, selectedHex, isSelected, findSquadByCoordinates, moves, setSelectedHex } =
  //     useStateStore();

  const meshRef = useRef<any>();

  const [lineThickness, setLineThickness] = useState(1);
  const [lineColor, setLineColor] = useState("gray");
  const [backgroundColor, setBackgroundColor] = useState("white");
  const [linePosition, setLinePosition] = useState(position);
  const [radiusPosition, setRadiusPosition] = useState(radius);
  const [depth, setDepth] = useState(1);

  // Squads on hex
  //   const squadsOnHex = useEntityQuery([Has(Position), HasValue(Position, { x: col + offset, y: row + offset })]);

  // Base on hex
  //   const baseOnHex = useEntityQuery([HasValue(Base, { x: col + offset, y: row + offset })]);

  const isMoveToHex = useMemo(() => {
    // return moveToHex?.col === col && moveToHex?.row === row && moveToHex !== null;
    return false;
    //   }, [selectedHex, moveToHex, moves]);
  }, []);

  //   const commitmentMove = findSquadByCoordinates(totalCycles, col, row);

  const handleLeftClick = () => {
    // setSelectedHex({ col, row, qty: 3 });
  };

  const handleRightClick = () => {
    // setMoveToHex({ col, row, qty: 3 });
  };

  //   const seed = Math.floor(((snoise([col / MAP_AMPLITUDE, 0, row / MAP_AMPLITUDE]) + 1) / 2) * 100);
  const seed = 61;

  useEffect(() => {
    // Determine line properties
    // if (isSelected({ col, row, qty: 3 })) {
    //   setLineThickness(5);
    //   setLineColor("red");
    // } else {
    //   setLineThickness(2);
    //   setLineColor("white");
    // }

    // Determine background color based on different conditions
    let backgroundColor = "white";
    let depth = 1;
    if (isMoveToHex) {
      backgroundColor = "red";
      // depth = 1;
    } else if (seed > 60) {
      backgroundColor = "blue";
      depth = 0.4;
    } else if (seed > 40) {
      backgroundColor = "#4F9153";
      depth = 0.7;
    } else if (seed > 30) {
      backgroundColor = "#002D04";
      depth = 1.4;
    } else if (seed > 20) {
      backgroundColor = "#2c4c3b";
      depth = 1.6;
    } else if (seed > 15) {
      backgroundColor = "gray";
      depth = 2;
    } else {
      backgroundColor = "black";
      depth = 3;
    }
    setDepth(depth);
    setBackgroundColor(backgroundColor);
    //   }, [selectedHex, moves, isMoveToHex, seed, isSelected, col, row]);
  }, [isMoveToHex, seed, col, row]);

  //   const isBase = isEnergySource({ x: col + offset, y: row + offset });
  const isBase = false;

  // todo: have a isRealm, isHyperstructure, isBank

  const hexagonGeometry = useMemo(() => createHexagonGeometry(radiusPosition, depth), [radiusPosition, depth]);

  return (
    <>
      {/* {isBase && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[position[0], position[1], 1]}>
          <Cone>
            <meshStandardMaterial color="black" />
          </Cone>
        </mesh>
      )} */}
      {/* {commitmentMove && (
        <Troop
          position={[position[0], position[1], depth]}
          text={`id: ${commitmentMove.squadId} qty: ${commitmentMove.qty}`}
        />
      )} */}
      {/* {squadsOnHex?.length > 0 &&
        squadsOnHex.map((a, index) => (
          <SquadOnHex
            commitmentMove={commitmentMove ? commitmentMove : undefined}
            key={index}
            position={position}
            entity={a}
            depth={depth}
          />
        ))} */}

      {/* {baseOnHex?.length > 0 && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[position[0], position[1], 1]}>
          <Cone>
            <meshStandardMaterial color="red" />
          </Cone>
        </mesh>
      )} */}

      <mesh position={[position[0] - 2, position[1] - 1, depth + 0.2]}>
        <Text fontSize={0.4} color="white" anchorX="center" anchorY="middle">
          {col},{row}
        </Text>
      </mesh>

      <mesh
        onPointerEnter={() => {
          setLineColor("red");
        }}
        onClick={() => handleLeftClick()}
        onContextMenu={(e) => handleRightClick()}
        onPointerLeave={() => {
          //   if (!isSelected({ col, row, qty: 3 })) {
          //     setLineColor("white");
          //   }
        }}
        ref={meshRef}
        position={position}
        geometry={hexagonGeometry}
      >
        <meshStandardMaterial color={backgroundColor} />
      </mesh>
      <lineSegments
        geometry={new THREE.EdgesGeometry(hexagonGeometry)}
        material={
          new THREE.LineBasicMaterial({
            color: lineColor,
            linewidth: lineThickness,
          })
        }
        position={linePosition}
      />
    </>
  );
};
