import { useDojo } from "../../../../hooks/context/DojoContext";
import useUIStore from "../../../../hooks/store/useUIStore";
import { getUIPositionFromColRow } from "../../../utils/utils";
// @ts-ignore
import { ReactElement, useEffect, useMemo, useRef } from "react";
import { Subscription } from "rxjs";
import { Army, FullArmyInfo } from "./Army";
import { ArmyAndName, useArmies } from "@/hooks/helpers/useArmies";
import { Event } from "@/dojo/events/graphqlClient";

export const Armies = () => {
  const {
    account: { account },
  } = useDojo();

  const { getArmies } = useArmies();
  const armiesList = getArmies();

  useUpdateAnimationPathsForEnnemies();

  const armies = useMemo(() => {
    return armiesList.map((army) => getArmyReactElement(army, account.address, armiesList.length));
  }, [armiesList]);

  return <group>{armies}</group>;
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
          const eventData = exractUsefulTravelEventData(event, account.address);
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

const getArmyReactElement = (army: ArmyAndName, accountAddress: string, groupLength: number): ReactElement => {
  const isMine = BigInt(army.address) === BigInt(accountAddress);
  
  const ownGroupIndex = Number(army.entity_id) % groupLength;
  const offset = calculateOffset(ownGroupIndex, groupLength);

  const offsetToAvoidOverlapping = Math.random() * 1 - 0.5;
  offset.y += offsetToAvoidOverlapping;

  const fullArmyData: FullArmyInfo = {
    uiPos: { ...getUIPositionFromColRow(army.x, army.y), z: 0.32 },
    isMine,
    ...army,
  };

  return <Army key={army.entity_id} army={fullArmyData} offset={offset} />;
};

const exractUsefulTravelEventData = (event: Event, userAccountAddress: string) => {
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

const calculateOffset = (index: number, total: number) => {
  if (total === 1) return { x: 0, y: 0 };

  const radius = 1.5; // Radius where the armies will be placed
  const angleIncrement = (2 * Math.PI) / 6; // Maximum 6 points on the circumference for the first layer
  let angle = angleIncrement * (index % 6);
  let offsetRadius = radius;

  if (index >= 6) {
    // Adjustments for more than 6 armies, placing them in another layer
    offsetRadius += 0.5; // Increase radius for each new layer
    angle += angleIncrement / 2; // Offset angle to interleave with previous layer
  }

  return {
    x: offsetRadius * Math.cos(angle),
    y: offsetRadius * Math.sin(angle),
  };
};
