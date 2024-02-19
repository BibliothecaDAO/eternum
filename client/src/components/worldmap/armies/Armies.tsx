import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../../DojoContext";
import { useCombat } from "../../../hooks/helpers/useCombat";
import { ReactComponent as Pen } from "../../../assets/icons/common/pen.svg";
import useRealmStore from "../../../hooks/store/useRealmStore";
import useUIStore from "../../../hooks/store/useUIStore";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { ArmyModel } from "./models/ArmyModel";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { CombatInfo, UIPosition, biomes } from "@bibliothecadao/eternum";
// @ts-ignore
import Arcs from "../../worldmap/Arcs.jsx";
import { useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import { getRealmNameById, getRealmOrderNameById } from "../../../utils/realms";
import clsx from "clsx";
import { OrderIcon } from "../../../elements/OrderIcon";
import { formatSecondsLeftInDaysHours } from "../../cityview/realm/labor/laborUtils";
import ProgressBar from "../../../elements/ProgressBar";
import { useRealm } from "../../../hooks/helpers/useRealm";
import { DEPTH, Hexagon } from "../HexGrid";
import { useExplore } from "../../../hooks/helpers/useExplore";

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
      if (!position) return;
      const hexIndex = hexData.findIndex((h) => h.col === position.x && h.row === position.y);
      const hex = hexData[hexIndex];
      let z = DEPTH;
      if (hexIndex !== -1 && isExplored(position.x, position.y)) {
        z += BIOMES[hex.biome].depth * DEPTH;
      }
      return { pos: { ...getUIPositionFromColRow(position.x, position.y), z: z }, id: position.entity_id };
    })
    .filter(Boolean) as { pos: UIPosition; id: bigint }[];

  // clickable
  const onClick = (id: bigint) => {
    setTravelingEntity(id);
  };

  return (
    <group>
      {positions.map(({ pos, id }, i) => {
        let offset = 0;
        if (positionOffset[JSON.stringify(pos)]) {
          positionOffset[JSON.stringify(pos)] += 1;
          if (positionOffset[JSON.stringify(pos)] % 2 === 0) {
            offset = positionOffset[JSON.stringify(pos)] * -0.3;
          } else {
            offset = positionOffset[JSON.stringify(pos)] * 0.3;
          }
        } else {
          positionOffset[JSON.stringify(pos)] = 1;
        }
        return (
          <ArmyModel
            onPointerOver={() => onHover(id, pos)}
            onPointerOut={onUnhover}
            onClick={() => onClick(id)}
            key={i}
            scale={1}
            position={[pos.x + offset, pos.z, -pos.y]}
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
      components: { Movable, Position, ArrivalTime },
    },
  } = useDojo();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  // stary only by showing your armies for now
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const { getMovingRealmRaiders } = useCombat();
  const { isExplored } = useExplore();

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

  const travelPosition = armies
    .map((armyId) => {
      const movable = getComponentValue(Movable, armyId);
      const position = getComponentValue(Position, armyId);
      const arrivalTime = getComponentValue(ArrivalTime, armyId);
      if (!movable || !position || !nextBlockTimestamp || !arrivalTime) return;

      const start = { col: movable.start_coord_x, row: movable.start_coord_y };
      const end = { col: position.x, row: position.y };
      const speed = movable.sec_per_km;
      const hexSizeInKm = 1;

      // Calculate total distance
      const distance = Math.sqrt(Math.pow(end.col - start.col, 2) + Math.pow(end.row - start.row, 2)) * hexSizeInKm;

      // Calculate total travel time
      const totalTravelTime = distance * speed;

      // Reverse-engineer start time using the arrival time and total travel time
      const startTime = arrivalTime.arrives_at - totalTravelTime;

      // Calculate elapsed time
      const elapsedTime = nextBlockTimestamp - startTime;

      // Calculate progress percentage
      const progress = Math.min(elapsedTime / totalTravelTime, 1); // Ensure it doesn't exceed 100%

      // Interpolate current position
      const currentPos = {
        col: start.col + progress * (end.col - start.col),
        row: start.row + progress * (end.row - start.row),
      };

      let z = DEPTH;
      const roundedCol = Math.round(currentPos.col);
      const roundedRow = Math.round(currentPos.row);
      const hexIndex = hexData.findIndex((h) => h.col === roundedCol && h.row === roundedRow);
      const hex = hexData[hexIndex];
      const explored = isExplored(roundedCol, roundedRow);
      if (hexIndex !== -1 && explored) {
        z = z + BIOMES[hex.biome].depth * DEPTH;
      }

      return {
        armyId: arrivalTime.entity_id,
        currentPos: { ...getUIPositionFromColRow(currentPos.col, currentPos.row), z },
        endPos: { ...getUIPositionFromColRow(end.col, end.row), z: DEPTH },
      };
    })
    .filter(Boolean) as { armyId: bigint; currentPos: UIPosition; endPos: UIPosition }[];

  return (
    <group>
      <Arcs
        paths={travelPosition.map(({ currentPos, endPos }) => {
          return {
            from: currentPos,
            to: endPos,
          };
        })}
      />
      {travelPosition.map(({ currentPos, armyId }, i) => {
        return (
          <ArmyModel
            onPointerOver={() => onHover(armyId, currentPos)}
            onPointerOut={onUnhover}
            key={i}
            scale={1}
            position={[currentPos.x, currentPos.z, -currentPos.y]}
          ></ArmyModel>
        );
      })}
      {hoveredArmy && <ArmyInfoLabel position={hoveredArmy.position} armyId={hoveredArmy.id} />}
    </group>
  );
};

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
