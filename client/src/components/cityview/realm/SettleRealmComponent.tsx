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
import realmsHexPositions from "../../../geodata/hex/realmHexPositions.json";

export const MAX_REALMS = 5;

export const SettleRealmComponent = () => {
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

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const chosenOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId)?.order : undefined),
    [account, realmEntityIds],
  );
  const canSettle = realmEntityIds.length < MAX_REALMS;

  const settleRealms = async () => {
    setIsLoading(true);
    let calldata = [];

    let new_realm_id = BigInt(getNextRealmIdForOrder(chosenOrder || selectedOrder));

    for (let i = 0; i < MAX_REALMS; i++) {
      // if no realm id latest realm id is 0
      if (i > 0) {
        new_realm_id = BigInt(getRealmIdForOrderAfter(chosenOrder || selectedOrder, new_realm_id));
      }
      // take next realm id
      let realm = getRealm(new_realm_id);
      if (!realm) return;

      let realmPositions = realmsHexPositions as { [key: number]: { col: number; row: number }[] };
      let position = realmPositions[Number(new_realm_id)][0];

      calldata.push({
        realm_id: Number(realm.realmId),
        order: realm.order,
        wonder: realm.wonder,
        regions: realm.regions,
        resource_types_count: realm.resourceTypesCount,
        resource_types_packed: realm.resourceTypesPacked,
        rivers: realm.rivers,
        harbors: realm.harbors,
        cities: realm.cities,
        position: { x: position.col, y: position.row },
      });
    }

    // @dev: do it in 1 times because too many steps for 1 tx
    // before could do it in 3 times, but now, takes too many steps so cannot multicall
    await create_multiple_realms({
      signer: account,
      realms: [calldata[0]],
    });
    await create_multiple_realms({
      signer: account,
      realms: [calldata[1]],
    });
    await create_multiple_realms({
      signer: account,
      realms: [calldata[2]],
    });
    await create_multiple_realms({
      signer: account,
      realms: [calldata[3]],
    });
    await create_multiple_realms({
      signer: account,
      realms: [calldata[4]],
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
        <div className="h-[200px] mt-2 overflow-y-auto ">
          <div className="text-lg mt-2 italic text-gold text-left">{order_statments[selectedOrder - 1]}</div>
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
