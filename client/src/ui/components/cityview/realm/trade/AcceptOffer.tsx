import { useEffect, useMemo, useState } from "react";
import Button from "../../../../elements/Button";
import { useDojo } from "../../../../../hooks/context/DojoContext";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useTrade } from "../../../../../hooks/helpers/useTrade";
import { divideByPrecision } from "../../../../utils/utils";
import { MarketInterface } from "@bibliothecadao/eternum";
import useMarketStore from "../../../../../hooks/store/useMarketStore";
import { EventType, useNotificationsStore } from "../../../../../hooks/store/useNotificationsStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { acceptOfferTitle } from "@/ui/components/navigation/Config";
import { ResourceWeightsInfo } from "@/ui/components/resources/ResourceWeight";

type AcceptOfferPopupProps = {
  onClose: () => void;
  selectedTrade: MarketInterface;
  show: boolean;
};

export const AcceptOfferPopup = ({ onClose, selectedTrade, show }: AcceptOfferPopupProps) => {
  const [canCarry, setCanCarry] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(false);
  }, [selectedTrade]);

  const {
    account: { account },
    setup: {
      systemCalls: { accept_order },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const deleteTrade = useMarketStore((state) => state.deleteTrade);
  const deleteNotification = useNotificationsStore((state) => state.deleteNotification);

  const onAccept = async () => {
    setIsLoading(true);
    // todo: only delete if success
    await accept_order({
      signer: account,
      taker_id: realmEntityId,
      trade_id: selectedTrade.tradeId,
    });
    deleteTrade(selectedTrade.tradeId);
    if (selectedTrade.takerId === realmEntityId) {
      deleteNotification([selectedTrade.tradeId.toString()], EventType.DirectOffer);
    }
    onClose();
  };

  const { getTradeResourcesFromEntityViewpoint } = useTrade();

  let { resourcesGive, resourcesGet } = getTradeResourcesFromEntityViewpoint(realmEntityId, selectedTrade.tradeId);

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
    <OSWindow title={acceptOfferTitle} onClick={onClose} show={show} width="456px">
      <div className="flex justify-between m-2 text-xxs">
        <ResourceWeightsInfo entityId={realmEntityId} resources={resourcesGet} setCanCarry={setCanCarry} />
        <Button className="!px-[6px] !py-[2px] text-xxs" onClick={onClose} variant="outline">
          Cancel
        </Button>
        <Button
          disabled={!canCarry}
          className="!px-[6px] !py-[2px] text-xxs"
          onClick={onAccept}
          variant={canCarry ? "success" : "danger"}
          isLoading={isLoading}
        >
          Accept Offer
        </Button>
      </div>
    </OSWindow>
  );
};
