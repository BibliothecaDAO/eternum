import { useMemo, useState } from "react";
import Button from "../../../elements/Button";
import realms from "../../../data/realms.json";
import realmCoords from "../../../geodata/coords.json";
import { useDojo } from "../../../DojoContext";
import { Realm } from "../../../types";
import { findResourceIdByTrait } from "../../../constants/resources";
import { packResources } from "../../../utils/packedData";
import { getOrderName, orders } from "../../../constants/orders";
import { soundSelector, useUiSounds } from "../../../hooks/useUISound";
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
                [selectedOrder, chosenOrder].includes(orderId) ? "border-gold !cursor-pointer" : "border-transparent",
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

interface Attribute {
  trait_type: string;
  value: any;
}

export function getRealm(realm_id: number): Realm {
  const realmsData = realms as {
    [key: string]: any;
  };
  const realm = realmsData[realm_id.toString()];
  const resourceIds = realm.attributes
    .filter(({ trait_type }: Attribute) => trait_type === "Resource")
    .map(({ value }: Attribute) => findResourceIdByTrait(value));
  const resource_types_packed = parseInt(packResources(resourceIds));
  let cities: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Cities") {
      cities = value;
    }
  });
  let harbors: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Harbors") {
      harbors = value;
    }
  });
  let rivers: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Rivers") {
      rivers = value;
    }
  });
  let regions: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Regions") {
      regions = value;
    }
  });

  const wonder: number = 1;

  let order: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Order") {
      const name: string = value.split(" ").pop() || "";
      orders.forEach(({ orderId, orderName }) => {
        if (name === orderName) {
          order = orderId;
        }
      });
    }
  });

  return {
    realm_id,
    resource_types_packed,
    resource_types_count: resourceIds.length,
    cities,
    harbors,
    rivers,
    regions,
    wonder,
    order,
  };
}

export default SettleRealmComponent;
