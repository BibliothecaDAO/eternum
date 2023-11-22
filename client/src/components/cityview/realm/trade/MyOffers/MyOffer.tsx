import { useEffect, useMemo, useState } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";
import { ResourceIcon } from "../../../../../elements/ResourceIcon";
import { findResourceById, orderNameDict } from "@bibliothecadao/eternum";
import { ReactComponent as RatioIcon } from "../../../../../assets/icons/common/ratio.svg";
import { useDojo } from "../../../../../DojoContext";
import * as realmsData from "../../../../../geodata/realms.json";
import { MarketInterface } from "../../../../../hooks/helpers/useTrade";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { currencyFormat } from "../../../../../utils/utils";
import useUIStore from "../../../../../hooks/store/useUIStore";

type TradeOfferProps = {
  myOffer: MarketInterface;
  onBuildRoad: () => void;
};

export const MyOffer = ({ myOffer, onBuildRoad }: TradeOfferProps) => {
  const { takerId, hasRoad, distance, resourcesGet, resourcesGive, ratio } = myOffer;

  const [isLoading, setIsLoading] = useState(false);
  const setTooltip = useUIStore((state) => state.setTooltip);

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
            {realmsData["features"][takerRealm.realmId - 1].name}
          </div>
        ) : (
          <div className="flex-1"></div>
        )}
        {!takerRealm && <div className="-mt-2 text-gold">{timeLeft}</div>}
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
              onClick={onBuildRoad}
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
                  <ResourceIcon resource={getResourceTrait(resourceId)} size="xs" className="mb-1" />
                  {currencyFormat(amount, 0)}
                </div>
              ))}
          </div>
          <div className="flex flex-col items-center text-white">
            <RatioIcon className="mb-1 fill-white" />
            {ratio.toFixed(2)}
          </div>
          <div className="flex-1 text-gold flex justify-center items-center flex-wrap">
            {resourcesGet &&
              resourcesGet.map(({ resourceId, amount }) => (
                <div className="flex flex-col items-center mx-2 my-0.5" key={resourceId}>
                  <ResourceIcon key={resourceId} resource={getResourceTrait(resourceId)} size="xs" />
                  {currencyFormat(amount, 0)}
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
