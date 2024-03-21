import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../../DojoContext";
import { useCombat } from "../../../hooks/helpers/useCombat";
import useRealmStore from "../../../hooks/store/useRealmStore";
import useUIStore from "../../../hooks/store/useUIStore";
import { getEntityIdFromKeys, getUIPositionFromColRow } from "../../../utils/utils";
import { Position, UIPosition } from "@bibliothecadao/eternum";
// @ts-ignore
import { useEffect, useMemo } from "react";
import { Subscription } from "rxjs";
import { Army } from "./Army";
import { getRealmOrderNameById } from "../../../utils/realms";

type ArmiesProps = {
  props?: any;
};

export const FRIENDLY_ARMY_MODEL_DEFAULT_COLOR: string = "green";
export const FRIENDLY_ARMY_MODEL_HOVER_COLOR: string = "yellow";
export const FRIENDLY_ARMY_MODEL_SCALE: number = 2;
export const FRIENDLY_ARMY_MODEL_DEAD_COLOR: string = "black";

export const Armies = ({}: ArmiesProps) => {
  const {
    account: { account },
    setup: {
      components: { Position, Health },
    },
  } = useDojo();

  const realms = useRealmStore((state) => state.realmEntityIds);

  const { useOwnerRaiders } = useCombat();

  const armies = useOwnerRaiders(BigInt(account.address));

  useUpdateAnimationPaths();

  const realmOrder = useMemo(() => {
    const realmId = realms[0].realmId;
    const orderName = getRealmOrderNameById(realmId);
    return orderName.charAt(0).toUpperCase() + orderName.slice(1);
  }, []);

  const armyInfo = useMemo(
    () =>
      armies
        .map((armyId) => {
          const position = getComponentValue(Position, getEntityIdFromKeys([armyId]));
          const health = getComponentValue(Health, getEntityIdFromKeys([armyId]));
          const isDead = health?.value ? false : true;

          // // if animated army dont display
          if (!position) return;
          let z = 0.32;
          return {
            contractPos: { x: position.x, y: position.y },
            uiPos: { ...getUIPositionFromColRow(position.x, position.y), z: z },
            id: position.entity_id,
            isDead,
          };
        })
        .filter(Boolean) as { contractPos: Position; uiPos: UIPosition; id: bigint; isDead: boolean }[],
    [armies],
  );

  return (
    <group>
      {armyInfo.map((info, index) => {
        // Calculate offset based on index
        const offset = {
          x: ((index % 3) - 1) * 0.8, // This will create an offset of -0.1, 0, or 0.1
          z: Math.floor(index / 3) * 0.8 - 0.8, // This creates a row offset
        };

        return (
          <Army
            key={info.id}
            info={{
              ...info,
              order: realmOrder,
              uiPos: { x: info.uiPos.x + offset.x, y: info.uiPos.y + offset.z, z: info.uiPos.z },
            }}
          />
        );
      })}
    </group>
  );
};

const useUpdateAnimationPaths = () => {
  const {
    setup: {
      updates: {
        eventUpdates: { createTravelHexEvents },
      },
    },
  } = useDojo();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const setAnimationPaths = useUIStore((state) => state.setAnimationPaths);
  const animationPaths = useUIStore((state) => state.animationPaths);

  useEffect(() => {
    let subscription: Subscription | undefined;

    const subscribeToExploreEvents = async () => {
      const observable = await createTravelHexEvents();
      const sub = observable.subscribe((event) => {
        if (event) {
          const path = [];
          const realmEntityId = BigInt(event.keys[3]);
          const myArmy = realmEntityIds.find((realm) => realm.realmEntityId === realmEntityId);
          const enemy = myArmy ? false : true;
          const id = BigInt(event.data[0]);
          const len = Number(event.data[2]);
          for (let i = 3; i < 3 + len * 2; i += 2) {
            const pos = { x: Number(event.data[i]), y: Number(event.data[i + 1]) };
            path.push(pos);
          }
          setAnimationPaths([...animationPaths, { id, path, enemy }]);
        }
      });
      subscription = sub;
    };
    subscribeToExploreEvents();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);
};
