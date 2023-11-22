import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { SelectCaravanPanel } from "./CreateOffer";
import { useDojo } from "../../../../DojoContext";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { MarketInterface, useTrade } from "../../../../hooks/helpers/useTrade";
import { divideByPrecision, multiplyByPrecision } from "../../../../utils/utils";
import { WEIGHT_PER_DONKEY_KG } from "@bibliothecadao/eternum";

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
      systemCalls: { accept_order },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const acceptOffer = async () => {
    if (isNewCaravan) {
      await accept_order({
        signer: account,
        taker_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
        donkeys_quantity: donkeysCount,
      });
    } else {
      await accept_order({
        signer: account,
        taker_id: realmEntityId,
        trade_id: selectedTrade.tradeId,
        caravan_id: selectedCaravan,
      });
    }
  };

  const onAccept = () => {
    setIsLoading(true);
    optimisticAcceptOffer(selectedTrade.tradeId, realmEntityId, acceptOffer)();
    onClose();
  };

  const { getTradeResources } = useTrade();

  let { resourcesGive, resourcesGet } = getTradeResources(realmEntityId, selectedTrade.tradeId);

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
    resourcesGet.forEach((resource) => {
      selectedResourcesGetAmounts[resource.resourceId] = divideByPrecision(resource.amount);
    });
    return selectedResourcesGetAmounts;
  }, [selectedTrade]);

  const selectedResourcesGiveAmounts = useMemo(() => {
    let selectedResourcesGiveAmounts: { [resourceId: number]: number } = {};
    resourcesGive.forEach((resource) => {
      selectedResourcesGiveAmounts[resource.resourceId] = divideByPrecision(resource.amount);
    });
    return selectedResourcesGiveAmounts;
  }, [selectedTrade]);

  return (
    <SecondaryPopup name="accept-offer">
      <SecondaryPopup.Head onClose={onClose}>
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
            selectedResourceIdsGet={resourcesGet.map((resource) => resource.resourceId) || []}
            selectedResourcesGetAmounts={selectedResourcesGetAmounts}
            selectedResourceIdsGive={resourcesGive.map((resource) => resource.resourceId) || []}
            selectedResourcesGiveAmounts={selectedResourcesGiveAmounts}
            resourceWeight={resourceWeight}
            hasEnoughDonkeys={hasEnoughDonkeys}
          />
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <Button className="!px-[6px] !py-[2px] text-xxs" onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={!canAcceptOffer}
            className="!px-[6px] !py-[2px] text-xxs"
            onClick={onAccept}
            variant={canAcceptOffer ? "success" : "danger"}
            isLoading={isLoading}
          >
            Accept Offer
          </Button>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
