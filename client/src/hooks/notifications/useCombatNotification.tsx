import { ReactComponent as Checkmark } from "@/assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../ui/elements/OrderIcon";
import { Badge } from "../../ui/elements/Badge";
import { getRealmNameById, getRealmOrderNameById } from "../../ui/utils/realms";
import { ResourceCost } from "../../ui/elements/ResourceCost";
import { ReactComponent as Map } from "@/assets/icons/common/map.svg";
import {
  divideByPrecision,
  formatTimeLeftDaysHoursMinutes,
  getEntityIdFromKeys,
  getUIPositionFromColRow,
} from "../../ui/utils/utils";
import { CombatResultInterface, UIPosition, Winner } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";
import { NotificationType, RaidersData } from "../store/useNotificationsStore";
import { useRealm } from "../helpers/useRealm";
import Button from "../../ui/elements/Button";
import useRealmStore from "../store/useRealmStore";
import { useLocation } from "wouter";
import useUIStore from "../store/useUIStore";

export enum MilitaryLocation {
  Attack = "raids",
  Defence = "defence",
}

export const useGoToMilitary = () => {
  const { setRealmId, setRealmEntityId } = useRealmStore();
  const [location, setLocation] = useLocation();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);

  const goToMilitary = (realmId: bigint, realmEntityId: bigint, militaryLocation: MilitaryLocation) => {
    setIsLoadingScreenEnabled(true);
    setTimeout(() => {
      if (location.includes(`/realm`)) {
        setIsLoadingScreenEnabled(false);
      }
      setLocation(`/realm/${Number(realmEntityId)}/${militaryLocation}`);
      setRealmEntityId(realmEntityId);
      setRealmId(realmId);
    }, 500);
  };

  const goToMilitaryMap = (position: UIPosition) => {
    if (location.includes("/realm")) {
      setIsLoadingScreenEnabled(true);
      setLocation("/map");
    }
    moveCameraToTarget(position);
    setTimeout(() => {
      setIsLoadingScreenEnabled(false);
    }, 1500);
  };

  return {
    goToMilitary,
    goToMilitaryMap,
  };
};

export const useAttackedNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const data = notification.data as CombatResultInterface;

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { goToMilitary } = useGoToMilitary();

  const { getRealmAddressName } = useRealm();

  const { attackerRealmEntityId, targetRealmEntityId, damage, winner, attackTimestamp } = data;
  const { realm_id: attackerRealmId } =
    getComponentValue(Realm, getEntityIdFromKeys([BigInt(attackerRealmEntityId)])) || {};
  const { realm_id: targetRealmId } =
    getComponentValue(Realm, getEntityIdFromKeys([BigInt(targetRealmEntityId)])) || {};
  const attackerRealmOrderName = attackerRealmId ? getRealmOrderNameById(attackerRealmId) : "";
  const targetRealmOrderName = targetRealmId ? getRealmOrderNameById(targetRealmId) : "";
  const attackerAddressName = getRealmAddressName(attackerRealmEntityId);
  const targetRealmName = targetRealmId ? getRealmNameById(targetRealmId) : "";

  const time =
    attackTimestamp && nextBlockTimestamp ? formatTimeLeftDaysHoursMinutes(nextBlockTimestamp - attackTimestamp) : "";

  const youWon = winner === Winner.Target;

  return {
    type: "success",
    time,
    title: (
      <div className="flex items-center">
        <Badge size="lg" type={youWon ? "success" : "danger"} className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {youWon ? `Gave Damages ` : `Sustained Damages`}
        </Badge>

        <div className="flex items-center">
          on
          <OrderIcon size="xs" className="mx-1" order={targetRealmOrderName} />{" "}
          <div className="inline-block text-gold">{targetRealmName}</div>
        </div>
      </div>
    ),
    content: () => (
      <div className="flex flex-col">
        {damage && damage > 0 && (
          <div className="flex mt-2 ml-2 mb-1 items-center space-x-1 flex-wrap">
            <OrderIcon size="xs" className="mx-1" order={attackerRealmOrderName} />{" "}
            {winner === Winner.Attacker && <span className="text-white"> {`${attackerAddressName} gave`}</span>}
            {winner === Winner.Target && <span className="text-white"> {`${attackerAddressName} received`}</span>}
            <span className="text-anger-light"> -{damage} Damage</span>
          </div>
        )}
        <Button
          onClick={() => {
            goToMilitary(targetRealmId || 0n, targetRealmEntityId || 0n, MilitaryLocation.Defence);
          }}
          className="mt-2 w-full"
          variant="success"
          size="xs"
        >
          Go to realm
        </Button>
      </div>
    ),
  };
};

export const useStolenResourcesNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const data = notification.data as CombatResultInterface;

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { getRealmAddressName } = useRealm();

  const { goToMilitary } = useGoToMilitary();

  const { attackerRealmEntityId, targetRealmEntityId, stolenResources, attackTimestamp } = data;
  const { realm_id: attackerRealmId } =
    getComponentValue(Realm, getEntityIdFromKeys([BigInt(attackerRealmEntityId)])) || {};
  const { realm_id: targetRealmId } =
    getComponentValue(Realm, getEntityIdFromKeys([BigInt(targetRealmEntityId)])) || {};
  const attackerRealmOrderName = attackerRealmId ? getRealmOrderNameById(attackerRealmId) : "";
  const targetRealmOrderName = targetRealmId ? getRealmOrderNameById(targetRealmId) : "";
  const targetRealmName = targetRealmId ? getRealmNameById(targetRealmId) : "";
  const attackerAddressName = getRealmAddressName(attackerRealmEntityId);

  const time =
    nextBlockTimestamp && attackTimestamp ? formatTimeLeftDaysHoursMinutes(nextBlockTimestamp - attackTimestamp) : "";

  return {
    type: "success",
    time,
    title: (
      <div className="flex items-center">
        <Badge size="lg" type="danger" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Stolen Resources`}
        </Badge>

        <div className="flex items-center">
          on <OrderIcon size="xs" className="mx-1" order={targetRealmOrderName} />{" "}
          <div className="inline-block text-gold">{targetRealmName}</div>
        </div>
      </div>
    ),
    content: () => (
      <div className="flex flex-col">
        <div className="flex mt-2 w-full items-center flex-wrap space-x-2 space-y-1">
          <OrderIcon size="xs" className="mx-1" order={attackerRealmOrderName} />{" "}
          <span className="text-white"> {`${attackerAddressName} stole`}</span>
          {stolenResources &&
            stolenResources.map(({ resourceId, amount }) => (
              <ResourceCost
                type="vertical"
                withTooltip
                key={resourceId}
                resourceId={resourceId}
                color="text-order-giants"
                amount={-divideByPrecision(Number(amount))}
              />
            ))}
        </div>
        <Button
          onClick={() => {
            goToMilitary(targetRealmId || 0n, targetRealmEntityId || 0n, MilitaryLocation.Defence);
          }}
          className="mt-2 w-full"
          variant="success"
          size="xs"
        >
          Go to realm
        </Button>
      </div>
    ),
  };
};

export const useEnemyRaidersHaveArrivedNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const data = notification.data as RaidersData;

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { goToMilitary } = useGoToMilitary();

  const { getRealmAddressName } = useRealm();

  const { raiders } = data;
  const { realm_id: attackerRealmId } = raiders?.entityOwnerId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.entityOwnerId)])) || { realm_id: undefined }
    : { realm_id: undefined };
  const { realm_id: targetRealmId } = raiders?.locationEntityId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.locationEntityId)])) || { realm_id: undefined }
    : { realm_id: undefined };
  const attackerRealmOrderName = attackerRealmId ? getRealmOrderNameById(attackerRealmId) : "";
  const targetRealmOrderName = targetRealmId ? getRealmOrderNameById(targetRealmId) : "";
  const targetRealmName = targetRealmId ? getRealmNameById(targetRealmId) : "";
  const attackerAddressName = raiders?.entityOwnerId ? getRealmAddressName(raiders.entityOwnerId) : "";

  const time =
    nextBlockTimestamp && raiders?.arrivalTime
      ? formatTimeLeftDaysHoursMinutes(nextBlockTimestamp - raiders.arrivalTime)
      : "";

  return {
    type: "danger",
    time,
    title: (
      <div className="flex items-center">
        <Badge size="lg" type="danger" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Enemy Raiders Have Arrived`}
        </Badge>

        <div className="flex items-center">
          on <OrderIcon size="xs" className="mx-1" order={targetRealmOrderName} />{" "}
          <div className="inline-block text-gold">{targetRealmName}</div>
        </div>
      </div>
    ),
    content: () => (
      <div className="flex flex-col">
        <div className="flex mt-2 w-full items-center flex-wrap space-x-2 space-y-1">
          <OrderIcon size="xs" className="mx-1" order={attackerRealmOrderName} />{" "}
          <span className="text-white">
            {" "}
            {`${raiders.attack / 10} raiders from ${attackerAddressName} have arrived`}
          </span>
        </div>
        <Button
          onClick={() => {
            goToMilitary(targetRealmId || 0n, raiders.locationEntityId || 0n, MilitaryLocation.Defence);
          }}
          className="mt-2 w-full"
          variant="success"
          size="xs"
        >
          Go to realm
        </Button>
      </div>
    ),
  };
};

export const useEnemyRaidersAreTravelingNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const data = notification.data as RaidersData;

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { goToMilitary } = useGoToMilitary();
  const { getRealmAddressName } = useRealm();

  const { raiders } = data;
  const { realm_id: attackerRealmId } = raiders?.entityOwnerId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.entityOwnerId)])) || { realm_id: undefined }
    : { realm_id: undefined };
  const { realm_id: targetRealmId } = raiders?.locationEntityId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.locationEntityId)])) || { realm_id: undefined }
    : { realm_id: undefined };
  const attackerRealmOrderName = attackerRealmId ? getRealmOrderNameById(attackerRealmId) : "";
  const targetRealmOrderName = targetRealmId ? getRealmOrderNameById(targetRealmId) : "";
  const targetRealmName = targetRealmId ? getRealmNameById(targetRealmId) : "";
  const attackerAddressName = raiders?.entityOwnerId ? getRealmAddressName(raiders.entityOwnerId) : "";

  const time =
    nextBlockTimestamp && raiders?.arrivalTime
      ? formatTimeLeftDaysHoursMinutes(raiders.arrivalTime - nextBlockTimestamp)
      : "";

  return {
    type: "danger",
    time,
    title: (
      <div className="flex items-center">
        <Badge size="lg" type="danger" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Enemy Raiders Are Coming`}
        </Badge>

        <div className="flex items-center">
          on <OrderIcon size="xs" className="mx-1" order={targetRealmOrderName} />{" "}
          <div className="inline-block text-gold">{targetRealmName}</div>
        </div>
      </div>
    ),
    content: () => (
      <div className="flex flex-col">
        <div className="flex mt-2 w-full items-center flex-wrap space-x-2 space-y-1">
          <OrderIcon size="xs" className="mx-1" order={attackerRealmOrderName} />{" "}
          <span className="text-white">
            {" "}
            {`${raiders.attack / 10} raiders from ${attackerAddressName} arriving in ${time}`}
          </span>
        </div>
        <Button
          onClick={() => {
            goToMilitary(targetRealmId || 0n, raiders.locationEntityId || 0n, MilitaryLocation.Defence);
          }}
          className="mt-2 w-full"
          variant="success"
          size="xs"
        >
          Go to realm
        </Button>
      </div>
    ),
  };
};

export const useYourRaidersHaveArrivedNotification = (
  notification: NotificationType,
): {
  type: string;
  time: string;
  title: React.ReactElement;
  content: (onClose: any) => React.ReactElement;
} => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const data = notification.data as RaidersData;

  const { goToMilitary, goToMilitaryMap } = useGoToMilitary();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { raiders } = data;
  const { realm_id: attackerRealmId } = raiders?.entityOwnerId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.entityOwnerId)])) || { realm_id: undefined }
    : { realm_id: undefined };
  const { realm_id: targetRealmId } = raiders?.locationEntityId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.locationEntityId)])) || { realm_id: undefined }
    : { realm_id: undefined };
  const attackerRealmOrderName = attackerRealmId ? getRealmOrderNameById(attackerRealmId) : "";
  const targetRealmOrderName = targetRealmId ? getRealmOrderNameById(targetRealmId) : "";
  const targetRealmName = targetRealmId ? getRealmNameById(targetRealmId) : "";
  const attackerRealmName = attackerRealmId ? getRealmNameById(attackerRealmId) : "";

  let uiPosition: UIPosition | undefined;
  if (raiders.position) {
    uiPosition = { ...getUIPositionFromColRow(raiders.position.x, raiders.position.y), z: 0 };
  }

  const time =
    nextBlockTimestamp && raiders?.arrivalTime
      ? formatTimeLeftDaysHoursMinutes(nextBlockTimestamp - raiders.arrivalTime)
      : "";

  return {
    type: "success",
    time,
    title: (
      <div className="flex items-center">
        <Badge size="lg" type="success" className="mr-2">
          <Checkmark className="fill-current mr-1" />
          {`Your Raiders Have Arrived`}
        </Badge>

        {targetRealmOrderName && targetRealmName && (
          <div className="flex items-center">
            on <OrderIcon size="xs" className="mx-1" order={targetRealmOrderName} />{" "}
            <div className="inline-block text-gold">{targetRealmName}</div>
          </div>
        )}
      </div>
    ),
    content: () => (
      <div className="flex flex-col">
        <div className="flex mt-2 w-full items-center flex-wrap space-x-2 space-y-1">
          <OrderIcon size="xs" className="mx-1" order={attackerRealmOrderName} />{" "}
          <span className="text-white"> {`${raiders.attack / 10} raiders from ${attackerRealmName} have arrived`}</span>
        </div>
        <div className="flex flex-row mt-2">
          <Button
            onClick={() => {
              goToMilitary(attackerRealmId || 0n, raiders.entityOwnerId || 0n, MilitaryLocation.Attack);
            }}
            className=" w-full mr-2"
            variant="success"
            size="xs"
          >
            Go to realm
          </Button>
          <Button
            onClick={() => uiPosition && goToMilitaryMap(uiPosition)}
            variant="outline"
            className="p-1 !h-4 text-xxs w-[80%] !rounded-md"
          >
            <Map className="mr-1 fill-current" />
            Show on map
          </Button>
        </div>
      </div>
    ),
  };
};
