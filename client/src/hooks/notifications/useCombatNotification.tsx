import { ReactComponent as Checkmark } from "../../assets/icons/common/checkmark.svg";
import { OrderIcon } from "../../elements/OrderIcon";
import { Badge } from "../../elements/Badge";
import { NotificationType } from "./useNotifications";
import { getRealmNameById, getRealmOrderNameById } from "../../utils/realms";
import { ResourceCost } from "../../elements/ResourceCost";
import { divideByPrecision, formatTimeLeftDaysHoursMinutes, getEntityIdFromKeys } from "../../utils/utils";
import { CombatResultInterface, Winner } from "../store/useCombatHistoryStore";
import { getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";

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

  const { attackerRealmEntityId, targetRealmEntityId, damage, winner, attackTimestamp } = data;
  const { realm_id: attackerRealmId } =
    getComponentValue(Realm, getEntityIdFromKeys([BigInt(attackerRealmEntityId)])) || {};
  const { realm_id: targetRealmId } =
    getComponentValue(Realm, getEntityIdFromKeys([BigInt(targetRealmEntityId)])) || {};
  const attackerRealmOrderName = attackerRealmId ? getRealmOrderNameById(attackerRealmId) : undefined;
  const targetRealmOrderName = targetRealmId ? getRealmOrderNameById(targetRealmId) : undefined;
  const attackerRealmName = attackerRealmId ? getRealmNameById(attackerRealmId) : undefined;
  const targetRealmName = targetRealmId ? getRealmNameById(targetRealmId) : undefined;

  const time = attackTimestamp ? formatTimeLeftDaysHoursMinutes(nextBlockTimestamp - attackTimestamp) : "";

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
            {winner === Winner.Attacker && <span className="text-white"> {`${attackerRealmName} gave`}</span>}
            {winner === Winner.Target && <span className="text-white"> {`${attackerRealmName} received`}</span>}
            <span className="text-anger-light"> -{damage} Damage</span>
          </div>
        )}
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

  const { attackerRealmEntityId, targetRealmEntityId, stolenResources, attackTimestamp } = data;
  const { realm_id: attackerRealmId } =
    getComponentValue(Realm, getEntityIdFromKeys([BigInt(attackerRealmEntityId)])) || {};
  const { realm_id: targetRealmId } =
    getComponentValue(Realm, getEntityIdFromKeys([BigInt(targetRealmEntityId)])) || {};
  const attackerRealmOrderName = attackerRealmId ? getRealmOrderNameById(attackerRealmId) : undefined;
  const targetRealmOrderName = targetRealmId ? getRealmOrderNameById(targetRealmId) : undefined;
  const attackerRealmName = attackerRealmId ? getRealmNameById(attackerRealmId) : undefined;
  const targetRealmName = targetRealmId ? getRealmNameById(targetRealmId) : undefined;

  const time = attackTimestamp ? formatTimeLeftDaysHoursMinutes(nextBlockTimestamp - attackTimestamp) : "";

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
          <span className="text-white"> {`${attackerRealmName} stole`}</span>
          {stolenResources &&
            stolenResources.map(({ resourceId, amount }) => (
              <ResourceCost
                type="vertical"
                withTooltip
                key={resourceId}
                resourceId={resourceId}
                color="text-order-brilliance"
                amount={divideByPrecision(amount)}
              />
            ))}
        </div>
      </div>
    ),
  };
};
