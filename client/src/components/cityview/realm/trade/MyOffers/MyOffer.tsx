import { useEffect, useMemo, useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { findResourceById } from "../../../../../constants/resources";
import { ReactComponent as RatioIcon } from "../../../../../assets/icons/common/ratio.svg";
import { useDojo } from "../../../../../DojoContext";
import { ResourcesOffer } from "../../../../../types";
import { orderNameDict } from "../../../../../constants/orders";
import * as realmsData from "../../../../../geodata/realms.json";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import {
  MarketInterface,
  useSyncTradeResources,
} from "../../../../../hooks/graphql/useGraphQLQueries";
import { getRealm } from "../../SettleRealmComponent";
import { useTrade } from "../../../../../hooks/helpers/useTrade";
import { numberToHex } from "../../../../../utils/utils";

type TradeOfferProps = {
  myOffer: MarketInterface;
};

export const MyOffer = ({ myOffer }: TradeOfferProps) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, [myOffer]);

  const {
    setup: {
      systemCalls: { cancel_fungible_order },
      optimisticSystemCalls: { optimisticCancelOffer },
    },
    account: { account },
  } = useDojo();

  const { realmId } = useRealmStore();

  useSyncTradeResources({
    makerOrderId: numberToHex(myOffer.takerOrderId),
    takerOrderId: numberToHex(myOffer.makerOrderId),
  });

  const { getTradeResources } = useTrade();

  const onCancel = async () => {
    // status 2 = cancel
    setIsLoading(true);
    optimisticCancelOffer(cancel_fungible_order)({
      signer: account,
      trade_id: myOffer.tradeId,
    });
  };

  let makerRealm = useMemo(
    () => (realmId ? getRealm(realmId) : undefined),
    [realmId],
  );

  // TODO: how to only call once when useSyncTradeResources has finished syncincg ?
  let resourcesGet = getTradeResources(myOffer.takerOrderId);
  let resourcesGive = getTradeResources(myOffer.makerOrderId);

  const getResourceTrait = useMemo(() => {
    return (resourceId: number) => findResourceById(resourceId)?.trait as any;
  }, []);

  const ratio = useMemo(() => {
    return resourcesGive.length > 0 && resourcesGet.length > 0
      ? calculateRatio(resourcesGive, resourcesGet)
      : undefined;
  }, [resourcesGive, resourcesGet]);

  let timeLeft = formatTimeLeft(myOffer.expiresAt - Date.now() / 1000);

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center justify-between">
        {makerRealm && (
          <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
            {/* // order of the order maker */}
            {makerRealm.order && (
              <OrderIcon
                order={orderNameDict[makerRealm.order]}
                size="xs"
                className="mr-1"
              />
            )}
            {realmsData["features"][makerRealm.realm_id - 1].name}
          </div>
        )}
        <div className="-mt-2 text-gold">{timeLeft}</div>
      </div>
      <div className="flex items-end mt-2">
        <div className="flex items-center justify-around flex-1">
          <div className="w-1/3 text-gold flex justify-center items-center flex-wrap">
            {resourcesGive &&
              resourcesGive.map(({ resourceId, amount }) => (
                <div
                  className="flex flex-col items-center mx-2 my-1"
                  key={resourceId}
                >
                  <ResourceIcon
                    resource={getResourceTrait(resourceId)}
                    size="xs"
                    className="mb-1"
                  />
                  {amount}
                </div>
              ))}
          </div>
          <div className="flex flex-col items-center text-white">
            <RatioIcon className="mb-1 fill-white" />
            {ratio?.toFixed(2) || 0}
          </div>
          <div className="w-1/3 text-gold flex justify-center items-center flex-wrap">
            {resourcesGet &&
              resourcesGet.map(({ resourceId, amount }) => (
                <div
                  className="flex flex-col items-center mx-2 my-1"
                  key={resourceId}
                >
                  <ResourceIcon
                    key={resourceId}
                    resource={getResourceTrait(resourceId)}
                    size="xs"
                  />
                  {amount}
                </div>
              ))}
          </div>
        </div>
        {!isLoading && (
          <Button
            onClick={onCancel}
            variant={"danger"}
            className="ml-auto p-2 !h-4 text-xxs !rounded-md"
          >{`Cancel`}</Button>
        )}
        {isLoading && (
          <Button
            isLoading={true}
            onClick={() => {}}
            variant="danger"
            className="ml-auto p-2 !h-4 text-xxs !rounded-md"
          >
            {}
          </Button>
        )}
      </div>
    </div>
  );
};

const formatTimeLeft = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days} days ${hours}h:${minutes}m`;
};

const calculateRatio = (
  resourcesGive: ResourcesOffer[],
  resourcesGet: ResourcesOffer[],
) => {
  let quantityGive = 0;
  for (let i = 0; i < resourcesGive.length; i++) {
    quantityGive += resourcesGive[i].amount;
  }
  let quantityGet = 0;
  for (let i = 0; i < resourcesGet.length; i++) {
    quantityGet += resourcesGet[i].amount;
  }
  return quantityGet / quantityGive;
};
