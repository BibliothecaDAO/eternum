import { useMemo } from "react";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import Button from "../../elements/Button";
import { OrderIcon } from "../../elements/OrderIcon";
import { ResourceCost } from "../../elements/ResourceCost";
import useBlockchainStore from "../../hooks/store/useBlockchainStore";
import { CaravanInterface } from "../../hooks/graphql/useGraphQLQueries";
import { useTrade } from "../../hooks/helpers/useTrade";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../utils/realms";
import useRealmStore from "../../hooks/store/useRealmStore";
import { divideByPrecision } from "../../utils/utils";

type CaravanDetailsProps = {
  caravan: CaravanInterface;
  onClose: () => void;
};

export const CaravanDetails = ({ caravan, onClose }: CaravanDetailsProps) => {
  const { resourcesChestId, destination, arrivalTime, capacity, pickupArrivalTime } = caravan;
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { getTradeResources, getTradeIdFromResourcesChestId } = useTrade();

  let tradeId = resourcesChestId ? getTradeIdFromResourcesChestId(resourcesChestId) : undefined;

  let { resourcesGive, resourcesGet } = tradeId
    ? getTradeResources(realmEntityId, tradeId)
    : { resourcesGive: [], resourcesGet: [] };

  let resourceWeight = 0;

  const destinationRealmId = useMemo(() => {
    return destination && getRealmIdByPosition(destination);
  }, [destination]);
  const destinationRealmName = destinationRealmId && getRealmNameById(destinationRealmId);
  const hasArrivedPickupPosition =
    pickupArrivalTime !== undefined && nextBlockTimestamp !== undefined && pickupArrivalTime <= nextBlockTimestamp;

  const isTravelling = nextBlockTimestamp && arrivalTime && arrivalTime > nextBlockTimestamp;
  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          {capacity && (
            <div className="mr-0.5">
              Caravan #{caravan.caravanId} {divideByPrecision(resourceWeight)} / {divideByPrecision(capacity)}
            </div>
          )}
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body>
        {isTravelling && destinationRealmName && (
          <div className="flex items-center mt-2 ml-2 text-xxs">
            <span className="italic text-light-pink">Traveling {hasArrivedPickupPosition ? "from" : "to"}</span>
            <div className="flex items-center ml-1 mr-1 text-gold">
              <OrderIcon order={getRealmOrderNameById(destinationRealmId)} className="mr-1" size="xs" />
              {destinationRealmName}
            </div>
            <span className="italic text-light-pink">{hasArrivedPickupPosition ? "with" : "to pick up"}</span>
          </div>
        )}
        <div className="flex justify-center items-center flex-wrap space-x-2 px-2 py-1 mt-1">
          {resourcesGet.map(
            (resource) =>
              resource && (
                <ResourceCost
                  key={resource.resourceId}
                  resourceId={resource.resourceId}
                  amount={divideByPrecision(resource.amount)}
                />
              ),
          )}
        </div>
        {resourcesGive.length > 0 && (
          <div className="flex items-center mt-3 ml-2 text-xxs">
            <span className="italic text-light-pink">They will get</span>
          </div>
        )}
        <div className="flex justify-center items-center flex-wrap space-x-2 px-2 py-1">
          {resourcesGive.map(
            (resource) =>
              resource && (
                <ResourceCost
                  key={resource.resourceId}
                  resourceId={resource.resourceId}
                  amount={divideByPrecision(resource.amount)}
                />
              ),
          )}
        </div>
        <div className="flex justify-start m-2">
          <Button onClick={onClose} variant="primary">
            Close
          </Button>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
