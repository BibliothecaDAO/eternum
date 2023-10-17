import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { SelectCaravanPanel } from "./CreateOffer";
import { useDojo } from "../../../../DojoContext";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { MarketInterface, useTrade } from "../../../../hooks/helpers/useTrade";
import { divideByPrecision, multiplyByPrecision } from "../../../../utils/utils";
import { WEIGHT_PER_DONKEY_KG } from "../../../../constants/travel";

type AcceptOfferPopupProps = {
  onClose: () => void;
  selectedTrade: MarketInterface;
};

export const AcceptOfferPopup = ({ onClose, selectedTrade }: AcceptOfferPopupProps) => {
  const [selectedCaravan, setSelectedCaravan] = useState<number>(0);
  const [isNewCaravan, setIsNewCaravan] = useState(false);
  const [donkeysCount, setDonkeysCount] = useState(1);
  const [hasEnoughDonkeys, setHasEnoughDonkeys] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, [selectedTrade]);

  const {
    account: { account },
    setup: {
      optimisticSystemCalls: { optimisticAcceptOffer },
      systemCalls: { attach_caravan, take_fungible_order, create_free_transport_unit, create_caravan },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  // DISCUSS: put all tx in one system call?
  const acceptOffer = async () => {
    if (isNewCaravan) {
      const transport_units_id = await create_free_transport_unit({
        signer: account,
        realm_id: realmEntityId,
        quantity: donkeysCount,
      });
      const caravan_id = await create_caravan({
        signer: account,
        entity_ids: [transport_units_id],
      });
      await attach_caravan({
        signer: account,
        realm_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
        caravan_id,
      });
      await take_fungible_order({
        signer: account,
        taker_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
      });
    } else {
      await attach_caravan({
        signer: account,
        realm_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
        caravan_id: selectedCaravan,
      });
      await take_fungible_order({
        signer: account,
        taker_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
      });
    }
  };

  const onAccept = () => {
    setIsLoading(true);
    optimisticAcceptOffer(selectedTrade.tradeId, realmEntityId, acceptOffer)();
    onClose();
  };

  const { getTradeResources } = useTrade();

  // TODO: how to avoid getting at every render but also getting after data sync is done
  let resourcesGet = getTradeResources(selectedTrade.takerOrderId);
  let resourcesGive = getTradeResources(selectedTrade.makerOrderId);

  let resourceWeight = 0;
  for (const [_, amount] of Object.entries(resourcesGet.map((resource) => resource.amount) || {})) {
    resourceWeight += amount * 1;
  }

  const canAcceptOffer = useMemo(() => {
    return selectedCaravan !== 0 || (isNewCaravan && hasEnoughDonkeys);
  }, [selectedCaravan, hasEnoughDonkeys, isNewCaravan]);

  useEffect(() => {
    if (multiplyByPrecision(donkeysCount * WEIGHT_PER_DONKEY_KG) >= resourceWeight) {
      setHasEnoughDonkeys(true);
    } else {
      setHasEnoughDonkeys(false);
    }
  }, [donkeysCount, resourceWeight]);

  const selectedResourcesGetAmounts = useMemo(() => {
    let selectedResourcesGetAmounts: { [resourceId: number]: number } = {};
    resourcesGive.forEach((resource) => {
      selectedResourcesGetAmounts[resource.resourceId] = divideByPrecision(resource.amount);
    });
    return selectedResourcesGetAmounts;
  }, [selectedTrade]);

  const selectedResourcesGiveAmounts = useMemo(() => {
    let selectedResourcesGiveAmounts: { [resourceId: number]: number } = {};
    resourcesGet.forEach((resource) => {
      selectedResourcesGiveAmounts[resource.resourceId] = divideByPrecision(resource.amount);
    });
    return selectedResourcesGiveAmounts;
  }, [selectedTrade]);

  return (
    <SecondaryPopup name="accept-offer">
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Accept Offer:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"476px"}>
        <div className="flex flex-col items-center pt-2">
          <SelectCaravanPanel
            donkeysCount={donkeysCount}
            setDonkeysCount={setDonkeysCount}
            isNewCaravan={isNewCaravan}
            setIsNewCaravan={setIsNewCaravan}
            selectedCaravan={selectedCaravan}
            setSelectedCaravan={setSelectedCaravan}
            selectedResourceIdsGet={resourcesGive.map((resource) => resource.resourceId) || []}
            selectedResourcesGetAmounts={selectedResourcesGetAmounts}
            selectedResourceIdsGive={resourcesGet.map((resource) => resource.resourceId) || []}
            selectedResourcesGiveAmounts={selectedResourcesGiveAmounts}
            resourceWeight={resourceWeight}
            hasEnoughDonkeys={hasEnoughDonkeys}
          />
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <Button className="!px-[6px] !py-[2px] text-xxs" onClick={onClose} variant="outline">
            Cancel
          </Button>
          <div>
            {!isLoading && (
              <Button
                disabled={!canAcceptOffer}
                className="!px-[6px] !py-[2px] text-xxs"
                onClick={onAccept}
                variant={canAcceptOffer ? "success" : "danger"}
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
