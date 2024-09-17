import { useState } from "react";
import Button from "../../../elements/Button";

import { MAX_REALMS } from "@/ui/constants";
import { getPosition, toValidAscii } from "@/ui/utils/utils";
import { getOrderName, orders } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { shortString } from "starknet";
import { order_statments } from "../../../../data/orders";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { soundSelector, useUiSounds } from "../../../../hooks/useUISound";
import { OrderIcon } from "../../../elements/OrderIcon";
import { getRealm } from "../../../utils/realms";

const SettleRealmComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);

  const {
    setup: {
      systemCalls: { create_multiple_realms },
    },
    account: { account },
  } = useDojo();

  const { getNextRealmIdForOrder, getRealmIdForOrderAfter } = useRealm();

  const { play: playSign } = useUiSounds(soundSelector.sign);

  const settleRealms = async () => {
    setIsLoading(true);
    let calldata = [];

    let new_realm_id = getNextRealmIdForOrder(selectedOrder);

    for (let i = 0; i < MAX_REALMS; i++) {
      // if no realm id latest realm id is 0
      if (i > 0) {
        new_realm_id = getRealmIdForOrderAfter(selectedOrder, new_realm_id);
      }
      // take next realm id
      let realm = getRealm(new_realm_id);
      if (!realm) return;

      const realmNameInAscii = toValidAscii(realm.name);

      const position = getPosition(new_realm_id);
      calldata.push({
        realm_name: shortString.encodeShortString(realmNameInAscii),
        realm_id: Number(realm.realmId),
        order: realm.order,
        wonder: realm.wonder,
        regions: realm.regions,
        resource_types_count: realm.resourceTypesCount,
        resource_types_packed: realm.resourceTypesPacked,
        rivers: realm.rivers,
        harbors: realm.harbors,
        cities: realm.cities,
        position,
      });
    }

    await create_multiple_realms({
      signer: account,
      realms: [calldata[0]],
    });
    setIsLoading(false);
    playSign();
  };

  return (
    <>
      <div className="flex flex-col h-min">
        <div className="grid grid-cols-8 gap-2 pt-4">
          {orders
            // remove the order of the gods
            .filter((order) => order.orderId !== 17)
            .map(({ orderId }) => (
              <div
                key={orderId}
                className={clsx(
                  " flex relative group items-center justify-center  w-16 h-16 border-2  rounded-lg",
                  selectedOrder == orderId ? "border-gold !cursor-pointer" : "border-transparent",
                  "hover:bg-white/10 cursor-pointer",
                )}
                onClick={() => setSelectedOrder(orderId)}
              >
                <OrderIcon
                  size={"md"}
                  withTooltip={selectedOrder == orderId}
                  order={getOrderName(orderId)}
                  className={clsx(selectedOrder == orderId ? "opacity-100" : "opacity-30 group-hover:opacity-100")}
                />
              </div>
            ))}
        </div>
        <div className="h-[200px] mt-2 overflow-y-auto ">
          <div className="text-lg mt-2 text-gold text-center">{order_statments[selectedOrder - 1]}</div>
        </div>
        <Button
          isLoading={isLoading}
          onClick={() => (!isLoading ? settleRealms() : null)}
          className="mx-auto mt-4 text-xl"
          variant={"primary"}
        >
          {!isLoading ? "Settle Empire" : ""}
        </Button>
      </div>
    </>
  );
};

export default SettleRealmComponent;
