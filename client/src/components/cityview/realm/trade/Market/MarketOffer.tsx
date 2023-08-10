import { useEffect, useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { findResourceById } from "../../../../../constants/resources";
import { ReactComponent as RatioIcon } from "../../../../../assets/icons/common/ratio.svg";
import { ResourcesOffer } from "../../../../../types";
import { orderNameDict } from "../../../../../constants/orders";
import * as realmsData from "../../../../../geodata/realms.json";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import {
  MarketInterface,
  useGetRealm,
  useGetRealmResources,
  useGetTradeResources,
} from "../../../../../hooks/graphql/useGraphQLQueries";
import { canAcceptOffer } from "../TradeUtils";

type TradeOfferProps = {
  marketOffer: MarketInterface;
  onAccept: () => void;
};

export const MarketOffer = ({
  marketOffer,
  onAccept,
  ...props
}: TradeOfferProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [canAccept, setCanAccept] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, [marketOffer]);

  const { realmEntityId } = useRealmStore();

  let { realm: makerRealm } = useGetRealm({
    entityId: parseInt(marketOffer.makerId),
  });

  let { realmResources } = useGetRealmResources(realmEntityId);

  const {
    tradeResources: {
      resourcesGet: resourcesGive,
      resourcesGive: resourcesGet,
    },
  } = useGetTradeResources({
    makerOrderId: marketOffer.makerOrderId,
    takerOrderId: marketOffer.takerOrderId,
  });

  useEffect(() => {
    if (resourcesGive.length > 0) {
      canAcceptOffer(resourcesGive, realmResources)
        ? setCanAccept(true)
        : setCanAccept(false);
    }
  }, [resourcesGive]);

  let timeLeft = formatTimeLeft(marketOffer.expiresAt - Date.now() / 1000);

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
            {realmsData["features"][makerRealm.realmId - 1].name}
          </div>
        )}
        <div className="-mt-2 text-gold">{timeLeft}</div>
      </div>
      <div className="flex items-end mt-2">
        <div className="flex items-center justify-around flex-1">
          <div className="grid w-1/3 grid-cols-[repeat(3 ,auto)] gap-2 text-gold">
            {resourcesGive &&
              resourcesGive.map(({ resourceId, amount }) => (
                <div className="flex flex-col items-center" key={resourceId}>
                  <ResourceIcon
                    resource={findResourceById(resourceId)?.trait as any}
                    size="xs"
                    className="mb-1"
                  />
                  {amount}
                </div>
              ))}
          </div>
          <div className="flex flex-col items-center text-white">
            <RatioIcon className="mb-1 fill-white" />
            {resourcesGive &&
              resourcesGet &&
              calculateRatio(resourcesGive, resourcesGet).toFixed(2)}
          </div>
          <div className="grid w-1/3 grid-cols-[repeat(3 ,auto)] gap-2 text-gold">
            {resourcesGet &&
              resourcesGet.map(({ resourceId, amount }) => (
                <div className="flex flex-col items-center" key={resourceId}>
                  <ResourceIcon
                    resource={findResourceById(resourceId)?.trait as any}
                    size="xs"
                  />
                  {amount}
                </div>
              ))}
          </div>
        </div>
        {!isLoading && (
          <Button
            disabled={!canAccept}
            onClick={() => {
              onAccept();
            }}
            variant={canAccept ? "success" : "danger"}
            className="ml-auto p-2 !h-4 text-xxs !rounded-md"
          >{`Accept`}</Button>
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
