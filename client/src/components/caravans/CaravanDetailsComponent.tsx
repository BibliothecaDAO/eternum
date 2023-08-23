import { useMemo } from "react";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import { ReactComponent as CloseIcon } from "../../assets/icons/common/cross.svg";
import Button from "../../elements/Button";
import { OrderIcon } from "../../elements/OrderIcon";
import { ResourceCost } from "../../elements/ResourceCost";
import useBlockchainStore from "../../hooks/store/useBlockchainStore";
import {
  getRealmIdByPosition,
  getRealmNameById,
  getRealmOrderNameById,
} from "../cityview/realm/trade/TradeUtils";
import {
  CaravanInterface,
  useGetCounterPartyOrderId,
} from "../../hooks/graphql/useGraphQLQueries";
import { useCaravan } from "../../hooks/helpers/useCaravans";
import { useTrade } from "../../hooks/helpers/useTrade";

type CaravanDetailsProps = {
  caravan: CaravanInterface;
  onClose: () => void;
};

// TODO: use graphql here
export const CaravanDetails = ({ caravan, onClose }: CaravanDetailsProps) => {
  const { nextBlockTimestamp } = useBlockchainStore();

  const { counterPartyOrderId } = useGetCounterPartyOrderId(caravan.orderId);

  const { getCaravanInfo } = useCaravan();
  const caravanInfo = getCaravanInfo(caravan.caravanId, caravan.orderId);

  const { getTradeResources } = useTrade();
  let resourcesGive = getTradeResources(caravan.orderId);
  let resourcesGet = getTradeResources(counterPartyOrderId);

  // TODO: change that
  let resourceWeight = 0;

  const destinationRealmId = useMemo(() => {
    return (
      caravanInfo?.destination && getRealmIdByPosition(caravanInfo.destination)
    );
  }, [caravanInfo]);
  const destinationRealmName =
    destinationRealmId && getRealmNameById(destinationRealmId);

  const isTravelling =
    nextBlockTimestamp &&
    caravanInfo &&
    caravanInfo.arrivalTime &&
    caravanInfo.arrivalTime > nextBlockTimestamp;
  return (
    <SecondaryPopup>
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          {caravanInfo && (
            <div className="mr-0.5">
              Caravan #{caravan.caravanId} {resourceWeight} /{" "}
              {caravanInfo.capacity}
            </div>
          )}
          <CloseIcon className="w-3 h-3 cursor-pointer fill-white" />
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body>
        {isTravelling && destinationRealmName && (
          <div className="flex items-center mt-2 ml-2 text-xxs">
            <span className="italic text-light-pink">Traveling to</span>
            <div className="flex items-center ml-1 mr-1 text-gold">
              <OrderIcon
                order={getRealmOrderNameById(destinationRealmId)}
                className="mr-1"
                size="xs"
              />
              {destinationRealmName}
            </div>
            <span className="italic text-light-pink">with</span>
          </div>
        )}
        {caravanInfo && (
          <div className="flex justify-center items-center flex-wrap space-x-2 px-2 py-1 mt-1">
            {resourcesGive.map(
              (resource) =>
                resource && (
                  <ResourceCost
                    key={resource.resourceId}
                    resourceId={resource.resourceId}
                    amount={resource.amount}
                  />
                ),
            )}
          </div>
        )}
        <div className="flex items-center mt-3 ml-2 text-xxs">
          <span className="italic text-light-pink">You will get</span>
        </div>
        {caravanInfo && (
          <div className="flex justify-center items-center flex-wrap space-x-2 px-2 py-1">
            {resourcesGet.map(
              (resource) =>
                resource && (
                  <ResourceCost
                    key={resource.resourceId}
                    resourceId={resource.resourceId}
                    amount={resource.amount}
                  />
                ),
            )}
          </div>
        )}
        <div className="flex justify-start m-2">
          <Button onClick={onClose} variant="primary">
            Close
          </Button>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
