import clsx from "clsx";
import { CombatResultInterface, Winner } from "../../../../../hooks/store/useCombatHistoryStore";
import { getComponentValue } from "@latticexyz/recs";
import { divideByPrecision, getEntityIdFromKeys } from "../../../../../utils/utils";
import { useDojo } from "../../../../../DojoContext";
import { getRealmNameById, getRealmOrderNameById } from "../../../../../utils/realms";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import { useMemo } from "react";
import useUIStore from "../../../../../hooks/store/useUIStore";
// import ProgressBar from "../../../../../elements/ProgressBar";
import { ResourceCost } from "../../../../../elements/ResourceCost";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { formatSecondsLeftInDaysHours } from "../../labor/laborUtils";
import { useRealm } from "../../../../../hooks/helpers/useRealm";

type AttackHistoryProps = {
  combatResult: CombatResultInterface;
} & React.HTMLAttributes<HTMLDivElement>;

export const AttackHistory = ({ combatResult, ...props }: AttackHistoryProps) => {
  const {
    setup: {
      components: { Realm, Quantity, Attack, Health, Defence },
    },
  } = useDojo();

  const { attackerRealmEntityId, attackingEntityIds, stolenResources, winner, damage, attackTimestamp } = combatResult;

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const setTooltip = useUIStore((state) => state.setTooltip);
  const { getRealmAddressName } = useRealm();

  let { realm_id: attackerRealmId } = getComponentValue(Realm, getEntityIdFromKeys([BigInt(attackerRealmEntityId)]));
  let attackerName = attackerRealmId ? getRealmNameById(attackerRealmId) : undefined;
  let attackerAddressName = getRealmAddressName(attackerRealmEntityId);

  const attackerTotalSoldiers = useMemo(() => {
    let total = 0;
    for (const id of attackingEntityIds) {
      let { value } = getComponentValue(Quantity, getEntityIdFromKeys([BigInt(id)]));
      total += value;
    }
    return total;
  }, [attackingEntityIds]);

  const attackerTotalAttack = useMemo(() => {
    let total = 0;
    for (const id of attackingEntityIds) {
      let { value } = getComponentValue(Attack, getEntityIdFromKeys([BigInt(id)]));
      total += value;
    }
    return total;
  }, [attackingEntityIds]);

  const attackerTotalHealth = useMemo(() => {
    let total = 0;
    for (const id of attackingEntityIds) {
      let { value } = getComponentValue(Health, getEntityIdFromKeys([BigInt(id)]));
      total += value;
    }
    return total;
  }, [attackingEntityIds]);

  const attackerTotalDefence = useMemo(() => {
    let total = 0;
    for (const id of attackingEntityIds) {
      let { value } = getComponentValue(Defence, getEntityIdFromKeys([BigInt(id)]));
      total += value;
    }
    return total;
  }, [attackingEntityIds]);

  return (
    <div
      className={clsx(
        "flex flex-col w-full mb-1 pb-1 pr-1 border rounded-md border-gray-gold text-xxs text-gray-gold",
        props.className,
      )}
      onClick={props.onClick}
    >
      <div className="flex items-center text-xxs">
        {winner && (
          <div
            className={clsx(
              "flex items-center p-1 border text-light-pink rounded-br-md rounded-tl-md border-gray-gold",
              winner === Winner.Target && "!text-order-brilliance !border-order-brilliance",
              winner === Winner.Attacker && "!text-order-giants !border-order-giants",
            )}
          >
            {winner === Winner.Target && "Failed"}
            {winner === Winner.Attacker && "Success"}
          </div>
        )}
        <div className="flex items-center pt-1 ml-1 -mt-2">
          {stolenResources.length === 0 && attackerRealmId && (
            <div className="flex items-center">
              <div className="flex items-center ml-1 mr-1 text-gold">
                <span className={"mr-1"}>{attackerAddressName.slice(0, 10)}</span>
                <OrderIcon order={getRealmOrderNameById(attackerRealmId)} className="mr-1" size="xxs" />
                {attackerName}
              </div>
              {winner === Winner.Attacker && (
                <span className="italic text-light-pink">{`Attacked with ${attackerTotalSoldiers} battalions`}</span>
              )}
              {winner === Winner.Target && (
                <span className="italic text-light-pink">{`Failed to attack with ${attackerTotalSoldiers} battalions`}</span>
              )}
            </div>
          )}
          {stolenResources.length > 0 && attackerRealmId && (
            <div className="flex items-center">
              <div className="flex items-center ml-1 mr-1 text-gold">
                <span className={"mr-1"}>{attackerAddressName.slice(0, 10)}</span>
                <OrderIcon order={getRealmOrderNameById(attackerRealmId)} className="mr-1" size="xxs" />
                {attackerName}
              </div>
              <span className="italic text-light-pink">{`Has stolen ${stolenResources.length} resources`}</span>
            </div>
          )}
        </div>
        {attackTimestamp && nextBlockTimestamp && (
          <div className="flex ml-auto -mt-1 italic text-light-pink">
            {formatSecondsLeftInDaysHours(nextBlockTimestamp - attackTimestamp)}
          </div>
        )}
      </div>
      <div className="flex flex-col mt-2 space-y-2">
        <div className="flex relative justify-between text-xxs text-lightest w-full">
          <div className="flex items-center">
            <div className="flex items-center h-6 mr-2">
              <img src="/images/units/troop-icon.png" className="h-[28px]" />
              <div className="flex ml-1 text-center">
                <div className="bold mr-1">x{attackerTotalSoldiers}</div>
                Battalions
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
                <div className="bold ">{attackerTotalAttack}</div>
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
                <div className="bold ">{attackerTotalDefence}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="text-order-brilliance">{attackerTotalHealth && attackerTotalHealth.toLocaleString()}</div>
            &nbsp;/ {10 * attackerTotalSoldiers} HP
          </div>
        </div>
        {/* {attackerTotalHealth !== undefined && (
          <div className="grid grid-cols-12 gap-0.5">
            <ProgressBar
              containerClassName="col-span-12 !bg-order-giants"
              rounded
              progress={(attackerTotalHealth / (attackerTotalSoldiers * 10)) * 100}
            />
          </div>
        )} */}
        <div className="flex items-center justify-between mt-[8px] text-xxs">
          {stolenResources && stolenResources.length > 0 && (
            <div className="flex justify-center items-center space-x-1 flex-wrap">
              {stolenResources.map(
                (resource) =>
                  resource && (
                    <ResourceCost
                      key={resource.resourceId}
                      type="vertical"
                      color="text-order-brilliance"
                      resourceId={resource.resourceId}
                      amount={divideByPrecision(resource.amount)}
                    />
                  ),
              )}
            </div>
          )}
          {damage && damage > 0 && (
            <div className="flex justify-center ml-2 mb-1 items-center space-x-1 flex-wrap">
              {winner === Winner.Attacker && <span className="text-white"> Attacker gave</span>}
              {winner === Winner.Target && <span className="text-white"> Attacker received</span>}
              <span className="text-anger-light"> -{damage} Damage</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
