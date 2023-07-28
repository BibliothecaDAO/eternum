import React, { useEffect, useState } from "react";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { findResourceById } from "../../../constants/resources";
import { OrderIcon } from "../../../elements/OrderIcon";
import useRealmStore from "../../../hooks/store/useRealmStore";
import realmsNames from "../../../geodata/realms.json";
import { orderNameDict } from "../../../constants/orders";
import clsx from "clsx";
import { useGetRealm } from "../../../hooks/graphql/useGraphQLQueries";
import { getRealm } from "./SettleRealmComponent";

type RealmInfoComponentProps = {};

export const RealmInfoComponent = ({}: RealmInfoComponentProps) => {
  const { realmEntityId, realmId } = useRealmStore();

  const { realm } = useGetRealm({ entityId: realmEntityId });

  return (
    <>
      {realm && (
        <div
          className={clsx(
            "relative transition-colors duration-300 text-sm shadow-lg shadow-black/25 flex items-center px-4 py-2 text-white h-[50px]",
            `bg-order-${orderNameDict[realm.order]}`,
          )}
        >
          <div className="flex flex-col leading-4">
            <div className="font-bold">
              {realmsNames.features[realm.realmId - 1].name}
            </div>
            <div className="text-xxs text-gold">0x...loaf</div>
          </div>
          <div className="flex items-center ml-auto capitalize">
            {orderNameDict[realm?.order]}
            <OrderIcon
              className="ml-2"
              order={orderNameDict[realm?.order]}
              size="sm"
              color="white"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default RealmInfoComponent;
