import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { Badge } from "../../elements/Badge";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";
import { ResourceCost } from "../../elements/ResourceCost";
import { divideByPrecision, formatTimeLeftDaysHoursMinutes, getEntityIdFromKeys } from "../../utils/utils";
import { CombatResultInterface, Winner } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";
import { NotificationType, RaidersData } from "../store/useNotificationsStore";
import { useRealm } from "../helpers/useRealm";
import Button from "../../elements/Button";
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

  const goToMilitary = (realmId: bigint, realmEntityId: bigint, militaryLocation: MilitaryLocation) => {
    setIsLoadingScreenEnabled(true);
    setTimeout(() => {
      if (location.includes(`/realm`)) {
        setIsLoadingScreenEnabled(false);
      }
      setLocation(`/realm/${Number(realmId)}/${militaryLocation}`);
      setRealmEntityId(realmEntityId);
      setRealmId(realmId);
    }, 500);
  };

  return {
    goToMilitary,
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
    content: (onClose: () => void) => (
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
    content: (onClose: () => void) => (
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
  const { realm_id: targetRealmId } = raiders?.locationRealmEntityId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.locationRealmEntityId)])) || { realm_id: undefined }
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
    content: (onClose: () => void) => (
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
            goToMilitary(targetRealmId || 0n, raiders.locationRealmEntityId || 0n, MilitaryLocation.Defence);
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
  const { realm_id: targetRealmId } = raiders?.locationRealmEntityId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.locationRealmEntityId)])) || { realm_id: undefined }
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
    content: (onClose: () => void) => (
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
            goToMilitary(targetRealmId || 0n, raiders.locationRealmEntityId || 0n, MilitaryLocation.Defence);
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

  const { goToMilitary } = useGoToMilitary();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { raiders } = data;
  const { realm_id: attackerRealmId } = raiders?.entityOwnerId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.entityOwnerId)])) || { realm_id: undefined }
    : { realm_id: undefined };
  const { realm_id: targetRealmId } = raiders?.locationRealmEntityId
    ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(raiders.locationRealmEntityId)])) || { realm_id: undefined }
    : { realm_id: undefined };
  const attackerRealmOrderName = attackerRealmId ? getRealmOrderNameById(attackerRealmId) : "";
  const targetRealmOrderName = targetRealmId ? getRealmOrderNameById(targetRealmId) : "";
  const targetRealmName = targetRealmId ? getRealmNameById(targetRealmId) : "";
  const attackerRealmName = attackerRealmId ? getRealmNameById(attackerRealmId) : "";

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

        <div className="flex items-center">
          on <OrderIcon size="xs" className="mx-1" order={targetRealmOrderName} />{" "}
          <div className="inline-block text-gold">{targetRealmName}</div>
        </div>
      </div>
    ),
    content: (onClose: () => void) => (
      <div className="flex flex-col">
        <div className="flex mt-2 w-full items-center flex-wrap space-x-2 space-y-1">
          <OrderIcon size="xs" className="mx-1" order={attackerRealmOrderName} />{" "}
          <span className="text-white"> {`${raiders.attack / 10} raiders from ${attackerRealmName} have arrived`}</span>
        </div>
        <Button
          onClick={() => {
            goToMilitary(targetRealmId || 0n, raiders.entityOwnerId || 0n, MilitaryLocation.Attack);
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
