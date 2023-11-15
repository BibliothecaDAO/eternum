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
import { getPosition, multiplyByPrecision } from "../../../utils/utils";
import { initialResources } from "@bibliothecadao/eternum";
import { BigNumberish } from "starknet";

export const MAX_REALMS = 5;

export const SettleRealmComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);

  const {
    setup: {
      systemCalls: { create_realm },
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

    // create array of initial resources
    let resources: BigNumberish[] = [];
    const isDev = import.meta.env.VITE_DEV === "true";
    const dev_multiplier = isDev ? 10 : 1;
    for (let i = 0; i < 22; i++) {
      resources = [...resources, i + 1, multiplyByPrecision(initialResources[i]) * dev_multiplier];
    }
    if (isDev) {
      resources = [...resources, 254, multiplyByPrecision(1000000)];
      resources = [...resources, 255, multiplyByPrecision(1000000)];
    } else {
      resources = [...resources, 254, multiplyByPrecision(7560)];
      resources = [...resources, 255, multiplyByPrecision(2520)];
    }

    await create_realm({
      signer: masterAccount,
      owner: BigInt(account.address),
      ...realm,
      position,
      resources,
    });
    setIsLoading(false);
    playSign();
  };

  return (
    <>
      <div className="flex flex-col h-min">
        <div className="text-xxs mb-2 italic text-gold">
          {`Choose Order of your Realms. You can only select one Order per wallet. You can settle up to ${MAX_REALMS} Realms per wallet.`}
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

export default SettleRealmComponent;
