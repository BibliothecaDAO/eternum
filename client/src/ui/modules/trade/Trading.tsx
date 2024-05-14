import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { trade } from "@/ui/components/navigation/Config";
import { Tabs } from "@/ui/elements/tab";
import { useCallback, useMemo, useState } from "react";
import { FastCreateOfferPopup } from "@/ui/components/cityview/realm/trade/FastCreateOffer";
import { Marketplace } from "@/ui/components/trading/Marketplace";
import { AcceptOfferPopup } from "@/ui/components/cityview/realm/trade/AcceptOffer";
import { MarketInterface } from "@bibliothecadao/eternum";
import { TransferBetweenEntities } from "@/ui/components/trading/TransferBetweenEntities";
import { ResourceArrivals } from "@/ui/components/trading/ResourceArrivals";
import { EntityList } from "@/ui/components/list/EntityList";
import { useEntities } from "@/hooks/helpers/useEntities";

export const Trading = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const [selectedTab, setSelectedTab] = useState(0);
  const isOpen = useUIStore((state) => state.isPopupOpen(trade));
  const [selectedResource, setSelectedResource] = useState<number | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<MarketInterface | null>(null);
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [isBuy, setIsBuy] = useState(false);

  const onCreateOffer = useCallback((resourceId: number | null, isBuy: boolean) => {
    setIsBuy(isBuy);
    setSelectedResource(resourceId);
    setShowCreateOffer(true);
  }, []);

  const { playerRealms, playerAccounts, otherRealms } = useEntities();

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Market</div>
          </div>
        ),
        component: <Marketplace setSelectedTrade={setSelectedTrade} onCreateOffer={onCreateOffer} />,
      },
      {
        key: "transfer",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Transfer</div>
          </div>
        ),
        component: (
          <TransferBetweenEntities
            entitiesList={[
              { entities: playerRealms(), name: "Player Realms" },
              { entities: playerAccounts(), name: "Player Bank Accounts" },
              { entities: otherRealms(), name: "Other Realms" },
            ]}
          />
        ),
      },
      {
        key: "arrivals",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Arrivals</div>
          </div>
        ),
        component: (
          <EntityList
            list={[...playerRealms(), ...playerAccounts()]}
            title="Entities"
            panel={({ entity }) => <ResourceArrivals entityId={entity.entity_id} />}
          />
        ),
      },
    ],
    [selectedTab],
  );
  return (
    <>
      <FastCreateOfferPopup
        show={showCreateOffer}
        resourceId={selectedResource || 1}
        isBuy={isBuy}
        marketplaceMode
        onClose={() => setShowCreateOffer(false)}
        onCreate={() => {}}
      />
      {selectedTrade && (
        <AcceptOfferPopup show={true} onClose={() => setSelectedTrade(null)} selectedTrade={selectedTrade!} />
      )}
      <OSWindow width="650px" onClick={() => togglePopup(trade)} show={isOpen} title={trade}>
        {/* COMPONENTS GO HERE */}
        <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-full">
          <Tabs.List>
            {tabs.map((tab, index) => (
              <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panels className="overflow-hidden">
            {tabs.map((tab, index) => (
              <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      </OSWindow>
    </>
  );
};
