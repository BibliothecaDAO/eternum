import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../../DojoContext";
import { useCombat } from "../../../hooks/helpers/useCombat";
import { ReactComponent as Pen } from "../../../assets/icons/common/pen.svg";
import useRealmStore from "../../../hooks/store/useRealmStore";
import useUIStore from "../../../hooks/store/useUIStore";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { ArmyModel } from "./models/ArmyModel";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { CombatInfo, Position, UIPosition, biomes } from "@bibliothecadao/eternum";
// @ts-ignore
import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { getRealmNameById, getRealmOrderNameById } from "../../../utils/realms";
import clsx from "clsx";
import { OrderIcon } from "../../../elements/OrderIcon";
import { formatSecondsLeftInDaysHours } from "../../cityview/realm/labor/laborUtils";
import ProgressBar from "../../../elements/ProgressBar";
import { useRealm } from "../../../hooks/helpers/useRealm";
import { DEPTH, Hexagon } from "../HexGrid";
import { useExplore } from "../../../hooks/helpers/useExplore";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";

type ArmiesProps = {
  props?: any;
  hexData: Hexagon[];
};

const BIOMES = biomes as Record<string, { color: string; depth: number }>;

export const Armies = ({ hexData }: ArmiesProps) => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const setTravelingEntity = useUIStore((state) => state.setTravelingEntity);
  const animationPath = useUIStore((state) => state.animationPath);

  const positionOffset: Record<string, number> = {};

  // stary only by showing your armies for now
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const { getStationaryRealmRaiders } = useCombat();
  const { isExplored } = useExplore();

  const armies = realmEntityIds.flatMap(({ realmEntityId }) => {
    return getStationaryRealmRaiders(realmEntityId);
  });

  const [hoveredArmy, setHoveredArmy] = useState<{ id: bigint; position: UIPosition } | undefined>(undefined);

  const onHover = (armyId: bigint, position: UIPosition) => {
    setHoveredArmy({ id: armyId, position });
  };

  const onUnhover = () => {
    setHoveredArmy(undefined);
  };

  const positions = armies
    .map((armyId) => {
      const position = getComponentValue(Position, armyId);
      // if animated army dont display
      if (!position || animationPath?.id === position.entity_id) return;
      const hexIndex = hexData.findIndex((h) => h.col === position.x && h.row === position.y);
      const hex = hexData[hexIndex];
      let z = DEPTH;
      if (hexIndex !== -1 && isExplored(position.x, position.y)) {
        z += BIOMES[hex.biome].depth * DEPTH;
      }
      return {
        contractPos: { x: position.x, y: position.y },
        uiPos: { ...getUIPositionFromColRow(position.x, position.y), z: z },
        id: position.entity_id,
      };
    })
    .filter(Boolean) as { contractPos: Position; uiPos: UIPosition; id: bigint }[];

  // clickable
  const onClick = (id: bigint, position: Position) => {
    setTravelingEntity({ id, position });
  };

  return (
    <group>
      {positions.map(({ contractPos, uiPos, id }, i) => {
        let offset = 0;
        if (positionOffset[JSON.stringify(uiPos)]) {
          positionOffset[JSON.stringify(uiPos)] += 1;
          if (positionOffset[JSON.stringify(uiPos)] % 2 === 0) {
            offset = positionOffset[JSON.stringify(uiPos)] * -0.3;
          } else {
            offset = positionOffset[JSON.stringify(uiPos)] * 0.3;
          }
        } else {
          positionOffset[JSON.stringify(uiPos)] = 1;
        }
        return (
          <ArmyModel
            onPointerOver={() => onHover(id, uiPos)}
            onPointerOut={onUnhover}
            onClick={() => onClick(id, contractPos)}
            key={i}
            scale={1}
            position={[uiPos.x + offset, uiPos.z, -uiPos.y]}
          ></ArmyModel>
        );
      })}
      {hoveredArmy && <ArmyInfoLabel position={hoveredArmy.position} armyId={hoveredArmy.id} />}
    </group>
  );
};

type TravelingArmiesProps = {
  props?: any;
  hexData: Hexagon[];
};

export const TravelingArmies = ({ hexData }: TravelingArmiesProps) => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();
  // stary only by showing your armies for now
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const animationPath = useUIStore((state) => state.animationPath);
  const setAnimationPath = useUIStore((state) => state.setAnimationPath);

  const { getMovingRealmRaiders } = useCombat();
  const { isExplored } = useExplore();

  const startAnimationTimeRef = useRef<number | undefined>(undefined);
  const animatedArmyRef = useRef<Group | null>(null);

  const [hoveredArmy, setHoveredArmy] = useState<{ id: bigint; position: UIPosition } | undefined>(undefined);

  const armies = realmEntityIds.flatMap(({ realmEntityId }) => {
    return getMovingRealmRaiders(realmEntityId);
  });

  const onHover = (armyId: bigint, position: UIPosition) => {
    setHoveredArmy({ id: armyId, position });
  };

  const onUnhover = () => {
    setHoveredArmy(undefined);
  };

  useFrame(() => {
    // animate
    if (animationPath && animatedArmyRef.current && startAnimationTimeRef.current) {
      const uiPath = animationPath.path.map((pos) => getUIPositionFromColRow(pos.x, pos.y));
      const now = Date.now();
      const timeElapsed = now - startAnimationTimeRef.current!;
      const timeToComplete = uiPath.length * 1000;
      const progress = Math.min(timeElapsed / timeToComplete, 1);

      const pathIndex = Math.floor(progress * uiPath.length);
      const currentPath: Position[] = uiPath.slice(pathIndex, pathIndex + 2);

      // stop if progress is >= 1
      if (progress >= 1 || currentPath.length < 2) {
        // reset all
        startAnimationTimeRef.current = undefined;
        setAnimationPath(undefined);
        animatedArmyRef.current = null;
        return;
      }

      // calculate progress between 2 points
      const progressBetweenPoints = (progress - (1 / uiPath.length) * pathIndex) / (1 / uiPath.length);

      const currentPos = {
        x: currentPath[0].x + (currentPath[1].x - currentPath[0].x) * progressBetweenPoints,
        y: currentPath[0].y + (currentPath[1].y - currentPath[0].y) * progressBetweenPoints,
      };

      const z = DEPTH;
      animatedArmyRef.current.position.set(currentPos.x, z, -currentPos.y);
    }
  });

  useEffect(() => {
    if (animationPath) {
      // animate
      startAnimationTimeRef.current = Date.now();
    }
  }, [animationPath]);

  const positions = armies
    .map((armyId) => {
      const position = getComponentValue(Position, armyId);
      if (!position) return;
      const hexIndex = hexData.findIndex((h) => h.col === position.x && h.row === position.y);
      const hex = hexData[hexIndex];
      let z = DEPTH;
      if (hexIndex !== -1 && isExplored(position.x, position.y)) {
        z += BIOMES[hex.biome].depth * DEPTH;
      }
      return {
        contractPos: { x: position.x, y: position.y },
        uiPos: { ...getUIPositionFromColRow(position.x, position.y), z: z },
        id: position.entity_id,
      };
    })
    .filter(Boolean) as { contractPos: Position; uiPos: UIPosition; id: bigint }[];

  return (
    <group>
      {positions
        .filter(({ id }) => id !== animationPath?.id)
        .map(({ uiPos, id }, i) => {
          return (
            <ArmyModel
              onPointerOver={() => onHover(id, uiPos)}
              onPointerOut={onUnhover}
              key={i}
              scale={1}
              position={[uiPos.x, uiPos.z, -uiPos.y]}
            ></ArmyModel>
          );
        })}
      {animationPath && <ArmyModel ref={animatedArmyRef} scale={1}></ArmyModel>}
      {hoveredArmy && <ArmyInfoLabel position={hoveredArmy.position} armyId={hoveredArmy.id} />}
    </group>
  );
};

// export const TravelingArmies = ({ hexData }: TravelingArmiesProps) => {
//   const {
//     setup: {
//       components: { Movable, Position, ArrivalTime },
//     },
//   } = useDojo();
//   const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
//   // stary only by showing your armies for now
//   const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
//   const { getMovingRealmRaiders } = useCombat();
//   const { isExplored } = useExplore();

//   const [hoveredArmy, setHoveredArmy] = useState<{ id: bigint; position: UIPosition } | undefined>(undefined);

//   const armies = realmEntityIds.flatMap(({ realmEntityId }) => {
//     return getMovingRealmRaiders(realmEntityId);
//   });

//   const onHover = (armyId: bigint, position: UIPosition) => {
//     setHoveredArmy({ id: armyId, position });
//   };

//   const onUnhover = () => {
//     setHoveredArmy(undefined);
//   };

//   const travelPosition = armies
//     .map((armyId) => {
//       const movable = getComponentValue(Movable, armyId);
//       const position = getComponentValue(Position, armyId);
//       const arrivalTime = getComponentValue(ArrivalTime, armyId);
//       if (!movable || !position || !nextBlockTimestamp || !arrivalTime) return;

//       const start = { col: movable.start_coord_x, row: movable.start_coord_y };
//       const end = { col: position.x, row: position.y };
//       const speed = movable.sec_per_km;
//       const hexSizeInKm = 1;

//       // Calculate total distance
//       const distance = Math.sqrt(Math.pow(end.col - start.col, 2) + Math.pow(end.row - start.row, 2)) * hexSizeInKm;

//       // Calculate total travel time
//       const totalTravelTime = distance * speed;

//       // Reverse-engineer start time using the arrival time and total travel time
//       const startTime = arrivalTime.arrives_at - totalTravelTime;

//       // Calculate elapsed time
//       const elapsedTime = nextBlockTimestamp - startTime;

//       // Calculate progress percentage
//       const progress = Math.min(elapsedTime / totalTravelTime, 1); // Ensure it doesn't exceed 100%

//       // Interpolate current position
//       const currentPos = {
//         col: start.col + progress * (end.col - start.col),
//         row: start.row + progress * (end.row - start.row),
//       };

//       let z = DEPTH;
//       const roundedCol = Math.round(currentPos.col);
//       const roundedRow = Math.round(currentPos.row);
//       const hexIndex = hexData.findIndex((h) => h.col === roundedCol && h.row === roundedRow);
//       const hex = hexData[hexIndex];
//       const explored = isExplored(roundedCol, roundedRow);
//       if (hexIndex !== -1 && explored) {
//         z = z + BIOMES[hex.biome].depth * DEPTH;
//       }

//       return {
//         armyId: arrivalTime.entity_id,
//         currentPos: { ...getUIPositionFromColRow(currentPos.col, currentPos.row), z },
//         endPos: { ...getUIPositionFromColRow(end.col, end.row), z: DEPTH },
//       };
//     })
//     .filter(Boolean) as { armyId: bigint; currentPos: UIPosition; endPos: UIPosition }[];

//   return (
//     <group>
//       <Arcs
//         paths={travelPosition.map(({ currentPos, endPos }) => {
//           return {
//             from: currentPos,
//             to: endPos,
//           };
//         })}
//       />
//       {travelPosition.map(({ currentPos, armyId }, i) => {
//         return (
//           <ArmyModel
//             onPointerOver={() => onHover(armyId, currentPos)}
//             onPointerOut={onUnhover}
//             key={i}
//             scale={1}
//             position={[currentPos.x, currentPos.z, -currentPos.y]}
//           ></ArmyModel>
//         );
//       })}
//       {hoveredArmy && <ArmyInfoLabel position={hoveredArmy.position} armyId={hoveredArmy.id} />}
//     </group>
//   );
// };

type ArmyInfoLabelProps = {
  position: UIPosition;
  armyId: bigint;
};

const ArmyInfoLabel = ({ position, armyId }: ArmyInfoLabelProps) => {
  const { getEntitiesCombatInfo } = useCombat();

  const raider = useMemo(() => {
    return getEntitiesCombatInfo([armyId])[0];
  }, [armyId]);

  const { getRealmAddressName } = useRealm();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  return (
    <Html scale={1} position={[position.x, position.z, -position.y]}>
      <RaiderInfo
        key={raider.entityId}
        raider={raider}
        getRealmAddressName={getRealmAddressName}
        nextBlockTimestamp={nextBlockTimestamp}
      />
    </Html>
  );
};

const RaiderInfo = ({
  raider,
  getRealmAddressName,
  nextBlockTimestamp,
}: {
  raider: CombatInfo;
  getRealmAddressName: (name: bigint) => string;
  nextBlockTimestamp: number | undefined;
}) => {
  const { entityOwnerId, entityId, health, quantity, attack, defence, originRealmId, arrivalTime } = raider;

  const setTooltip = useUIStore((state) => state.setTooltip);
  const attackerAddressName = entityOwnerId ? getRealmAddressName(entityOwnerId) : "";

  const isTraveling = arrivalTime && nextBlockTimestamp ? arrivalTime > nextBlockTimestamp : false;
  const originRealmName = originRealmId ? getRealmNameById(originRealmId) : "";

  return (
    <div
      className={clsx(
        "w-[300px] flex flex-col p-2 mb-1 bg-black border rounded-md border-gray-gold text-xxs text-gray-gold",
      )}
    >
      <div className="flex items-center text-xxs">
        {entityId.toString() && (
          <div className="flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold">
            #{entityId.toString()}
          </div>
        )}
        <div className="flex items-center ml-1 -mt-2">
          {isTraveling && originRealmId?.toString() && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Traveling from</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <OrderIcon order={getRealmOrderNameById(originRealmId)} className="mr-1" size="xxs" />
                {originRealmName}
                <span className="italic text-light-pink ml-1">with</span>
              </div>
            </div>
          )}
          {!isTraveling && originRealmId?.toString() && (
            <div className="flex items-center ml-1">
              <span className="italic text-light-pink">Owned by</span>
              <div className="flex items-center ml-1 mr-1 text-gold">
                <span className={"mr-1"}>{attackerAddressName.slice(0, 10)}</span>
                <OrderIcon order={getRealmOrderNameById(originRealmId)} className="mr-1" size="xxs" />
                {originRealmName}
              </div>
            </div>
          )}
        </div>
        {!isTraveling && (
          <div className="flex ml-auto -mt-2 italic text-gold">
            Idle
            <Pen className="ml-1 fill-gold" />
          </div>
        )}
        {raider.arrivalTime && isTraveling && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-2 italic text-light-pink">
            {formatSecondsLeftInDaysHours(raider.arrivalTime - nextBlockTimestamp)}
          </div>
        )}
      </div>
      <div className="flex flex-col mt-2 space-y-2">
        <div className="flex relative justify-between text-xxs text-lightest w-full">
          <div className="flex items-center">
            <div className="flex items-center h-6 mr-2">
              <img src="/images/units/troop-icon.png" className="h-[28px]" />
              <div className="flex ml-1 text-center">
                <div className="bold mr-1">x{quantity}</div>
                Raiders
              </div>
            </div>
          </div>
          <div className="flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center">
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Attack power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/attack.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{attack}</div>
              </div>
            </div>
            <div
              className="flex items-center h-6 mr-2"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Defence power</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <img src="/images/icons/defence.png" className="h-full" />
              <div className="flex flex-col ml-1 text-center">
                <div className="bold ">{defence}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="text-order-brilliance">{health && health.toLocaleString()}</div>&nbsp;/ {10 * quantity} HP
          </div>
        </div>
        {health && (
          <div className="grid grid-cols-12 gap-0.5">
            <ProgressBar
              containerClassName="col-span-12 !bg-order-giants"
              rounded
              progress={(health / (10 * quantity)) * 100}
            />
          </div>
        )}
      </div>
    </div>
  );
};
