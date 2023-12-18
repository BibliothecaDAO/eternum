import { useMemo, useState } from "react";
import Button from "../../../elements/Button";

import { useDojo } from "../../../DojoContext";
import { getOrderName, orders } from "@bibliothecadao/eternum";
import { soundSelector, useUiSounds } from "../../../hooks/useUISound";
import { getRealm } from "../../../utils/realms";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { OrderIcon } from "../../../elements/OrderIcon";
import { useRealm } from "../../../hooks/helpers/useRealm";
import clsx from "clsx";
import { getPosition } from "../../../utils/utils";
import { order_statments } from "../../../data/orders";
import { useHyperstructure } from "../../../hooks/helpers/useHyperstructure";

export const MAX_REALMS = 5;

export const SettleRealmComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);

  const {
    setup: {
      systemCalls: { create_multiple_realms },
    },
    account: { account },
    masterAccount,
  } = useDojo();

  const { getHyperstructureIdByOrder } = useHyperstructure();

  const { getNextRealmIdForOrder, getRealmIdForOrderAfter } = useRealm();

  const { play: playSign } = useUiSounds(soundSelector.sign);

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const chosenOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId).order : undefined),
    [account, realmEntityIds],
  );
  const canSettle = realmEntityIds.length < MAX_REALMS;

  const settleRealms = async () => {
    setIsLoading(true);
    let calldata = [];

    let new_realm_id = BigInt(getNextRealmIdForOrder(chosenOrder || selectedOrder));

    for (let i = 0; i < MAX_REALMS; i++) {
      // if no realm id latest realm id is 0
      // const realm_id = await getLatestRealmId();

      if (i > 0) {
        new_realm_id = BigInt(getRealmIdForOrderAfter(chosenOrder || selectedOrder, new_realm_id));
      }
      // take next realm id
      let realm = getRealm(new_realm_id);

      let position = getPosition(new_realm_id);

      const order_hyperstructure_id = getHyperstructureIdByOrder(realm.order);

      if (order_hyperstructure_id) {
        calldata.push({
          owner: BigInt(account.address),
          realm_id: realm.realmId.toString(),
          order: realm.order,
          wonder: realm.wonder,
          regions: realm.regions,
          resource_types_count: realm.resourceTypesCount,
          resource_types_packed: realm.resourceTypesPacked,
          rivers: realm.rivers,
          harbors: realm.harbors,
          cities: realm.cities,
          position,
          order_hyperstructure_id,
        });
      }
    }

    console.log(calldata);

    // @dev: do it in 3 times because too many steps for 1 tx
    await create_multiple_realms({
      signer: masterAccount as any,
      realms: calldata.slice(0, 2),
    });
    await create_multiple_realms({
      signer: masterAccount as any,
      realms: calldata.slice(2, 4),
    });
    await create_multiple_realms({
      signer: masterAccount as any,
      realms: calldata.slice(4, 5),
    });
    setIsLoading(false);
    playSign();
  };

  return (
    <>
      <div className="flex flex-col h-min">
        <div className="grid grid-cols-8 gap-2 pt-4">
          {orders.map(({ orderId }) => (
            <div
              key={orderId}
              className={clsx(
                " flex relative group items-center justify-center  w-16 h-16 bg-black rounded-xl border",
                selectedOrder == orderId && !chosenOrder ? "border-gold !cursor-pointer" : "border-transparent",
                chosenOrder && chosenOrder == orderId && "!border-gold",
                chosenOrder && chosenOrder !== orderId && "opacity-30 cursor-not-allowed",
                !chosenOrder && "hover:bg-white/10 cursor-pointer",
              )}
              onClick={() => (!chosenOrder ? setSelectedOrder(orderId) : null)}
            >
              <OrderIcon
                size={"md"}
                withTooltip={!chosenOrder || chosenOrder == orderId}
                order={getOrderName(orderId)}
              ></OrderIcon>
            </div>
          ))}
        </div>
        <div>
          <div className="text-lg mt-2 italic text-gold">{order_statments[selectedOrder - 1]}</div>
        </div>
        <Button
          disabled={!canSettle}
          isLoading={isLoading}
          onClick={() => (!isLoading ? settleRealms() : null)}
          className="mx-auto mt-4 text-xl"
          variant={!isLoading ? "success" : "danger"}
        >
          {!isLoading ? "Settle Empire" : ""}
        </Button>
      </div>
    </>
  );
};

export default SettleRealmComponent;
