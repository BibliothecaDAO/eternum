import { useEffect, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { SelectCaravanPanel } from "./CreateOffer";
import { useDojo } from "../../../../DojoContext";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import {
  MarketInterface,
  useGetTradeResources,
} from "../../../../hooks/graphql/useGraphQLQueries";

type AcceptOfferPopupProps = {
  onClose: () => void;
  selectedTrade: MarketInterface;
};

export const AcceptOfferPopup = ({
  onClose,
  selectedTrade,
}: AcceptOfferPopupProps) => {
  const [selectedCaravan, setSelectedCaravan] = useState<number>(0);
  const [isNewCaravan, setIsNewCaravan] = useState(false);
  const [donkeysCount, setDonkeysCount] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, [selectedTrade]);

  const {
    systemCalls: {
      attach_caravan,
      take_fungible_order,
      create_free_transport_unit,
      create_caravan,
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const acceptOffer = async () => {
    if (isNewCaravan) {
      setIsLoading(true);
      const transport_units_id = await create_free_transport_unit({
        realm_id: realmEntityId,
        quantity: donkeysCount,
      });
      const caravan_id = await create_caravan({
        entity_ids: [transport_units_id],
      });
      await attach_caravan({
        realm_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
        caravan_id,
      });
      await take_fungible_order({
        taker_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
      });
    } else {
      setIsLoading(true);
      await attach_caravan({
        realm_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
        caravan_id: selectedCaravan,
      });
      await take_fungible_order({
        taker_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
      });
    }
    onClose();
  };

  const { tradeResources } = useGetTradeResources({
    makerOrderId: selectedTrade.makerOrderId,
    takerOrderId: selectedTrade.takerOrderId,
  });

  let resourceWeight = 0;
  for (const [_, amount] of Object.entries(
    tradeResources.resourcesGive.map((resource) => resource.amount) || {},
  )) {
    resourceWeight += amount * 1;
  }

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Accept Offer:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body>
        <div className="flex flex-col items-center pt-2">
          <SelectCaravanPanel
            donkeysCount={donkeysCount}
            setDonkeysCount={setDonkeysCount}
            isNewCaravan={isNewCaravan}
            setIsNewCaravan={setIsNewCaravan}
            selectedCaravan={selectedCaravan}
            setSelectedCaravan={setSelectedCaravan}
            selectedResourceIdsGet={
              tradeResources.resourcesGet.map(
                (resource) => resource.resourceId,
              ) || []
            }
            selectedResourcesGetAmounts={
              tradeResources.resourcesGet.map((resource) => resource.amount) ||
              []
            }
            selectedResourceIdsGive={
              tradeResources.resourcesGive.map(
                (resource) => resource.resourceId,
              ) || []
            }
            selectedResourcesGiveAmounts={
              tradeResources.resourcesGive.map((resource) => resource.amount) ||
              []
            }
            resourceWeight={resourceWeight}
          />
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <Button
            className="!px-[6px] !py-[2px] text-xxs"
            onClick={onClose}
            variant="outline"
          >
            Cancel
          </Button>
          <div>
            {!isLoading && (
              <Button
                className="!px-[6px] !py-[2px] text-xxs"
                onClick={acceptOffer}
                variant="success"
              >
                Accept Offer
              </Button>
            )}
            {isLoading && (
              <Button
                isLoading={true}
                onClick={() => {}}
                variant="danger"
                className="ml-auto p-2 !h-4 text-xxs !rounded-md"
              >
                {" "}
                {}{" "}
              </Button>
            )}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
