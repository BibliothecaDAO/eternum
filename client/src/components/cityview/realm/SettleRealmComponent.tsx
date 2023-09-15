import { useMemo, useState } from "react";
import Button from "../../../elements/Button";

import realmCoords from "../../../geodata/coords.json";
import { useDojo } from "../../../DojoContext";
import { getOrderName, orders } from "../../../constants/orders";
import { soundSelector, useUiSounds } from "../../../hooks/useUISound";
import { getRealm } from "../../../utils/realms";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { OrderIcon } from "../../../elements/OrderIcon";
import { useRealm } from "../../../hooks/helpers/useRealm";
import clsx from "clsx";

export const MAX_REALMS = 5;

export const SettleRealmComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);

  const {
    setup: {
      systemCalls: { create_realm, mint_resources },
    },
    account: { account, masterAccount },
  } = useDojo();

  const { getNextRealmIdForOrder } = useRealm();

  const { play: playSign } = useUiSounds(soundSelector.sign);

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const chosenOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId).order : undefined),
    [account, realmEntityIds],
  );
  const canSettle = realmEntityIds.length < MAX_REALMS;

  const settleRealm = async () => {
    setIsLoading(true);
    // if no realm id latest realm id is 0
    // const realm_id = await getLatestRealmId();

    // take next realm id
    let new_realm_id = getNextRealmIdForOrder(chosenOrder || selectedOrder);
    let realm = getRealm(new_realm_id);
    let position = getPosition(new_realm_id);
    let entity_id = await create_realm({
      signer: masterAccount,
      owner: BigInt(account.address),
      ...realm,
      position,
    });
    // mint basic resources to start
    const resources = [2, 3, 253];
    for (const resource of resources) {
      await mint_resources({
        signer: masterAccount,
        entity_id,
        resource_type: resource,
        amount: 1000,
      });
    }
    setIsLoading(false);
    playSign();
  };

  return (
    <>
      <div className="flex flex-col h-min">
        <div className="text-xxs mb-2 italic text-gold">
          Choose Order of your Realms. You can select Order only once per wallet.
        </div>
        <div className="grid grid-cols-8 gap-2">
          {orders.map(({ orderId }) => (
            <div
              key={orderId}
              className={clsx(
                " flex relative group items-center justify-center  w-11 h-11 bg-black rounded-xl border",
                selectedOrder == orderId && !chosenOrder ? "border-gold !cursor-pointer" : "border-transparent",
                chosenOrder && chosenOrder == orderId && "!border-gold",
                chosenOrder && chosenOrder !== orderId && "opacity-30 cursor-not-allowed",
                !chosenOrder && "hover:bg-white/10 cursor-pointer",
              )}
              onClick={() => (!chosenOrder ? setSelectedOrder(orderId) : null)}
            >
              <OrderIcon
                size={"xs"}
                withTooltip={!chosenOrder || chosenOrder == orderId}
                order={getOrderName(orderId)}
              ></OrderIcon>
            </div>
          ))}
        </div>
        <Button
          disabled={!canSettle}
          isLoading={isLoading}
          onClick={() => (!isLoading ? settleRealm() : null)}
          className="mr-auto !h-6 mt-2 text-xxs !rounded-md !p-2"
          variant={!isLoading ? "success" : "danger"}
        >
          {!isLoading ? "Settle Realm" : ""}
        </Button>
      </div>
    </>
  );
};

export function getPosition(realm_id: number): { x: number; y: number } {
  const coords = realmCoords.features[realm_id - 1].geometry.coordinates.map((value) => parseInt(value));
  return { x: coords[0] + 1800000, y: coords[1] + 1800000 };
}

export default SettleRealmComponent;
