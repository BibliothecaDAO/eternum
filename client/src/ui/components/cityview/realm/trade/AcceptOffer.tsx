import { useEffect, useMemo, useState } from "react";
import Button from "../../../../elements/Button";
import { useDojo } from "../../../../../hooks/context/DojoContext";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useTrade } from "../../../../../hooks/helpers/useTrade";
import { divideByPrecision } from "../../../../utils/utils";
import { MarketInterface, SPEED_PER_DONKEY } from "@bibliothecadao/eternum";
import useMarketStore from "../../../../../hooks/store/useMarketStore";
import { EventType, useNotificationsStore } from "../../../../../hooks/store/useNotificationsStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { acceptOfferTitle } from "@/ui/components/navigation/Config";
import { TravelInfo } from "@/ui/components/resources/ResourceWeight";
import { useTravel } from "@/hooks/helpers/useTravel";

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

  const { computeTravelTime } = useTravel();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const deleteTrade = useMarketStore((state) => state.deleteTrade);
  const deleteNotification = useNotificationsStore((state) => state.deleteNotification);

  const selectedResourceIdsGet = selectedTrade.takerGets.map((resource) => resource.resourceId);
  const selectedResourceIdsGive = selectedTrade.makerGets.map((resource) => resource.resourceId);

  const travelTime = useMemo(
    () => computeTravelTime(realmEntityId, selectedTrade.makerId, SPEED_PER_DONKEY),
    [realmEntityId, selectedTrade],
  );

  const onAccept = async () => {
    setIsLoading(true);
    // todo: only delete if success
    await accept_order({
      signer: account,
      taker_id: realmEntityId,
      trade_id: selectedTrade.tradeId,
      maker_gives_resources: selectedResourceIdsGet.flatMap((id) => [id, selectedResourcesGetAmounts[id]]),
      taker_gives_resources: selectedResourceIdsGive.flatMap((id) => [id, selectedResourcesGiveAmounts[id]]),
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
      selectedResourcesGetAmounts[resource.resourceId] = resource.amount;
    });
    return selectedResourcesGetAmounts;
  }, [selectedTrade]);

  const selectedResourcesGiveAmounts = useMemo(() => {
    let selectedResourcesGiveAmounts: { [resourceId: number]: number } = {};
    resourcesGive.forEach((resource) => {
      selectedResourcesGiveAmounts[resource.resourceId] = resource.amount;
    });
    return selectedResourcesGiveAmounts;
  }, [selectedTrade]);

  return (
    <OSWindow title={acceptOfferTitle} onClick={onClose} show={show} width="456px">
      <div className="flex flex-col items-center m-2 text-xxs">
        <TravelInfo
          entityId={realmEntityId}
          resources={resourcesGet.map(({ resourceId, amount }) => ({ resourceId, amount: divideByPrecision(amount) }))}
          setCanCarry={setCanCarry}
          travelTime={travelTime}
        />
        <div className="w-full">
          <Button
            disabled={!canCarry}
            className="w-full my-2"
            onClick={onAccept}
            variant={canCarry ? "success" : "danger"}
            isLoading={isLoading}
          >
            Accept Offer
          </Button>
          <Button className="w-full" onClick={onClose} variant="outline">
            Cancel
          </Button>
        </div>
      </div>
    </OSWindow>
  );
};
