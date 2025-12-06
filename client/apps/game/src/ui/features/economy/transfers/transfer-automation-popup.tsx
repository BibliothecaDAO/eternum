import { useUIStore } from "@/hooks/store/use-ui-store";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { useState } from "react";
import { TransferAutomationPanel } from "./transfer-automation-panel";
import { TransferAutomationAdvancedModal } from "./transfer-automation-modal";

export const TRANSFER_POPUP_NAME = "transfer-automation";

export const TransferAutomationPopup = () => {
  const isOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const togglePopup = useUIStore((state) => state.togglePopup);
  const sourceId = useUIStore((state) => state.transferPanelSourceId);
  const [selectedTab, setSelectedTab] = useState(0);

  if (!isOpen) return null;

  const handleClose = () => {
    togglePopup(TRANSFER_POPUP_NAME);
  };

  return (
    <SecondaryPopup name={TRANSFER_POPUP_NAME} className="pointer-events-auto" width="900">
      <SecondaryPopup.Head onClose={handleClose}>Transfers</SecondaryPopup.Head>
      <SecondaryPopup.Body height="auto">
        <Tabs selectedIndex={selectedTab} onChange={(index: number) => setSelectedTab(index)} className="flex flex-col gap-2">
          <Tabs.List className="grid grid-cols-2 gap-2">
            <Tabs.Tab className="!mx-0 flex items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-gold transition hover:bg-dark/60">
              Transfer
            </Tabs.Tab>
            <Tabs.Tab className="!mx-0 flex items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-gold transition hover:bg-dark/60">
              Automation
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panels className="flex-1">
            <Tabs.Panel className="flex-1">
              <div className="p-3">
                <TransferAutomationPanel initialSourceId={sourceId ?? undefined} />
              </div>
            </Tabs.Panel>
            <Tabs.Panel className="flex-1">
              <div className="p-3">
                <TransferAutomationAdvancedModal embedded />
              </div>
            </Tabs.Panel>
          </Tabs.Panels>
        </Tabs>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
