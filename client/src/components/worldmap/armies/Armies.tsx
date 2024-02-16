import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../../DojoContext";
import { useCombat } from "../../../hooks/helpers/useCombat";
import useRealmStore from "../../../hooks/store/useRealmStore";
import useUIStore from "../../../hooks/store/useUIStore";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { ArmyModel } from "./models/ArmyModel";
import { getUIPositionFromColRow } from "../../../utils/utils";
import { Position } from "@bibliothecadao/eternum";
// @ts-ignore
import Arcs from "../../worldmap/Arcs.jsx";

type ArmiesProps = {
  props?: any;
};

export const Armies = ({}: ArmiesProps) => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const setTravelingEntity = useUIStore((state) => state.setTravelingEntity);

  // stary only by showing your armies for now
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const { getStationaryRealmRaiders } = useCombat();

  const armies = realmEntityIds.flatMap(({ realmEntityId }) => {
    return getStationaryRealmRaiders(realmEntityId);
  });

  const positions = armies
    .map((armyId) => {
      const position = getComponentValue(Position, armyId);
      if (!position) return;
      return { pos: getUIPositionFromColRow(position.x, position.y), id: position.entity_id };
    })
    .filter(Boolean) as { pos: Position; id: bigint }[];

  // clickable
  const onClick = (id: bigint) => {
    setTravelingEntity(id);
  };

  return (
    <group>
      {positions.map(({ pos, id }, i) => {
        // todo: check
        return <ArmyModel onClick={() => onClick(id)} key={i} position={[pos.x, 10, -pos.y]}></ArmyModel>;
      })}
    </group>
  );
};

type TravelingArmiesProps = {
  props?: any;
};

export const TravelingArmies = ({}: TravelingArmiesProps) => {
  const {
    setup: {
      components: { Movable, Position, ArrivalTime },
    },
  } = useDojo();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  // stary only by showing your armies for now
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const { getMovingRealmRaiders } = useCombat();

  const armies = realmEntityIds.flatMap(({ realmEntityId }) => {
    return getMovingRealmRaiders(realmEntityId);
  });

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

      return {
        currentPos: getUIPositionFromColRow(currentPos.col, currentPos.row),
        endPos: getUIPositionFromColRow(end.col, end.row),
      };
    })
    .filter(Boolean) as { currentPos: Position; endPos: Position }[];

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
      {travelPosition.map(({ currentPos }, i) => {
        // todo: check
        return <ArmyModel key={i} position={[currentPos.x, 10, -currentPos.y]}></ArmyModel>;
      })}
    </group>
  );
};
