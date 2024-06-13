import { useDojo } from "../../../../hooks/context/DojoContext";
import useUIStore from "../../../../hooks/store/useUIStore";
// @ts-ignore
import { Event } from "@/dojo/events/graphqlClient";
import { useArmies } from "@/hooks/helpers/useArmies";
import { useEffect, useRef } from "react";
import { Subscription } from "rxjs";
import { Army } from "./Army";

export const Armies = ({}: {}) => {
  const { getArmies } = useArmies();
  const armies = getArmies();

  // not show armies that are in a battle
  const filterArmiesNotInBattle = (armies: any) => {
    return armies.filter((army: any) => {
      return army.battle_id === 0n;
    });
  };

  useUpdateAnimationPathsForEnnemies();
  return filterArmiesNotInBattle(armies).map((army: any) => <Army key={army.entity_id} army={army} />);
};

const useUpdateAnimationPathsForEnnemies = () => {
  const {
    account: { account },
    setup: {
      updates: {
        eventUpdates: { createTravelHexEvents },
      },
    },
  } = useDojo();

  const { animationPaths, setAnimationPaths } = useUIStore(({ animationPaths, setAnimationPaths }) => ({
    animationPaths,
    setAnimationPaths,
  }));

  const subscriptionRef = useRef<Subscription | undefined>();
  const isComponentMounted = useRef(true);

  useEffect(() => {
    let subscription: Subscription | undefined;

    const subscribeToTravelEvents = async () => {
      const observable = await createTravelHexEvents();
      const subscription = observable.subscribe((event) => {
        if (!isComponentMounted.current) return;
        if (event) {
          const eventData = extractUsefulTravelEventData(event, account.address);
          if (!eventData) return;
          setAnimationPaths([...animationPaths, eventData]);
        }
      });
      subscriptionRef.current = subscription;
    };
    subscribeToTravelEvents();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);
};

const extractUsefulTravelEventData = (event: Event, userAccountAddress: string) => {
  const path = [];
  const owner = BigInt(event.keys[3]);
  const enemy = owner !== BigInt(userAccountAddress);
  // if my army, then set animation directly when firing tx
  if (!enemy) return;
  const id = BigInt(event.data[0]);
  const len = Number(event.data[2]);
  for (let i = 3; i < 3 + len * 2; i += 2) {
    const pos = { x: Number(event.data[i]), y: Number(event.data[i + 1]) };
    path.push(pos);
  }
  return { id, path, enemy };
};
