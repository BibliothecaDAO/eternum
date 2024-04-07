import { useEffect, useMemo, useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { MarketInterface, RoadInterface, findResourceById, orderNameDict } from "@bibliothecadao/eternum";
import { ReactComponent as RatioIcon } from "../@/assets/icons/common/ratio.svg";
import { useDojo } from "../../../../../../hooks/context/DojoContext";
import * as realmsData from "../../../../../../data/geodata/realms.json";
import { useGetRealm } from "../../../../../../hooks/helpers/useRealm";
import { currencyFormat } from "../../../../../utils/utils";
import useUIStore from "../../../../../../hooks/store/useUIStore";
import { useCaravan } from "../../../../../../hooks/helpers/useCaravans";
import { useRoads } from "../../../../../../hooks/helpers/useRoads";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";

type TradeOfferProps = {
  myOffer: MarketInterface;
  roads: RoadInterface[];
  onBuildRoad: () => void;
};

export const MyOffer = ({ myOffer, roads, onBuildRoad }: TradeOfferProps) => {
  // todo: make hasRoad reactive
  // @note: in myoffers, player is always maker, so resourcesGet is always makerGets, resourcesGive is always takerGets
  const { takerId, makerGets: resourcesGet, takerGets: resourcesGive, ratio } = myOffer;

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const [isLoading, setIsLoading] = useState(false);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const { calculateDistance } = useCaravan();
  const { getHasRoad } = useRoads();

  const distance = useMemo(() => {
    return calculateDistance(takerId, realmEntityId) || 0;
  }, [takerId, realmEntityId]);

  const hasRoad = useMemo(() => {
    return getHasRoad(realmEntityId, takerId);
  }, [realmEntityId, takerId, roads]);

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

  const onCancel = async () => {
    // status 2 = cancel
    setIsLoading(true);
    optimisticCancelOffer(cancel_fungible_order)({
      signer: account,
      trade_id: myOffer.tradeId,
    });
  };

  let { realm: takerRealm } = useGetRealm(takerId);

  const getResourceTrait = useMemo(() => {
    return (resourceId: number) => findResourceById(resourceId)?.trait as any;
  }, []);

  let timeLeft = formatTimeLeft(myOffer.expiresAt - Date.now() / 1000);

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center justify-between">
        {takerRealm ? (
          <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
            {/* order of the order maker */}
            {takerRealm.order && <OrderIcon order={orderNameDict[takerRealm.order]} size="xs" className="mr-1" />}
            {realmsData["features"][Number(takerRealm.realmId) - 1]?.name || ""}
          </div>
        ) : (
          <div className="flex-1"></div>
        )}
        {!takerRealm && <div className="-mt-2 text-gold">{`Expires in ${timeLeft}`}</div>}
        {takerRealm && (
          <div className=" text-gold flex">
            <div className=" text-right">{`${distance.toFixed(0)} km`}</div>
            <Button
              onMouseEnter={() =>
                setTooltip({
                  position: "bottom",
                  content: hasRoad ? (
                    <>
                      <p className="whitespace-nowrap">A road has been built to this realm.</p>
                      <p className="whitespace-nowrap">You have +100% speed boost.</p>
                    </>
                  ) : (
                    <>
                      <p className="whitespace-nowrap">Click to build road and</p>
                      <p className="whitespace-nowrap">speed up trades with this Realm.</p>
                    </>
                  ),
                })
              }
              size="xs"
              variant="outline"
              onMouseLeave={() => setTooltip(null)}
              className="text-gold/50 relative group ml-2"
              onClick={() => {
                if (!hasRoad) {
                  onBuildRoad();
                }
              }}
            >
              {hasRoad ? "x2 speed" : "Normal speed"}
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-end">
        <div className="flex items-center justify-around flex-1">
          <div className="flex-1 text-gold flex justify-center items-center flex-wrap">
            {resourcesGive &&
              resourcesGive.map(({ resourceId, amount }) => (
                <div className="flex flex-col items-center mx-2 my-0.5" key={resourceId}>
                  <ResourceIcon resource={getResourceTrait(resourceId)} size="sm" className="mb-1" />
                  {currencyFormat(amount, 0)}
                </div>
              ))}
          </div>
          <div className="flex flex-col items-center text-white">
            <RatioIcon className="mb-1 fill-white" />
            {(1 / ratio).toFixed(2)}
          </div>
          <div className="flex-1 text-gold flex justify-center items-center flex-wrap">
            {resourcesGet &&
              resourcesGet.map(({ resourceId, amount }) => (
                <div className="flex flex-col items-center mx-2 my-0.5" key={resourceId}>
                  <ResourceIcon key={resourceId} resource={getResourceTrait(resourceId)} size="sm" />
                  {currencyFormat(amount, 0)}
                </div>
              ))}
          </div>
        </div>
        <Button
          isLoading={isLoading}
          onClick={onCancel}
          variant={"danger"}
          className="ml-auto p-2 !h-4 text-xxs !rounded-md"
        >{`Cancel`}</Button>
      </div>
    </div>
  );
};

const formatTimeLeft = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days} days`;
  } else {
    return `${hours}h:${minutes}m`;
  }
};
