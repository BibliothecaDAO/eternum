import { useUIStore } from "@/hooks/store/use-ui-store";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { TransferAutomationPanel } from "./transfer-automation-panel";

export const TRANSFER_POPUP_NAME = "transfer-automation";

export const TransferAutomationPopup = () => {
  const isOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const togglePopup = useUIStore((state) => state.togglePopup);
  const sourceId = useUIStore((state) => state.transferPanelSourceId);

  if (!isOpen) return null;

  const handleClose = () => {
    togglePopup(TRANSFER_POPUP_NAME);
  };

  return (
    <SecondaryPopup name={TRANSFER_POPUP_NAME} className="pointer-events-auto" width="980">
      <SecondaryPopup.Head onClose={handleClose}>Transfers</SecondaryPopup.Head>
      <SecondaryPopup.Body height="auto">
        <div className="p-3">
          <TransferAutomationPanel initialSourceId={sourceId ?? undefined} />
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
