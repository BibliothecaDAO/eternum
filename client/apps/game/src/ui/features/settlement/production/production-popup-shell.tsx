import { useUIStore } from "@/hooks/store/use-ui-store";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";

const PRODUCTION_POPUP_WIDTH = "min(1320px, calc(100vw - 48px))";
const PRODUCTION_POPUP_HEIGHT = "calc(100vh - 48px)";

interface ProductionPopupShellProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export const ProductionPopupShell = ({ children, onClose }: ProductionPopupShellProps) => {
  const toggleModal = useUIStore((state) => state.toggleModal);

  const handleClose = onClose ?? (() => toggleModal(null));

  return (
    <SecondaryPopup
      width={PRODUCTION_POPUP_WIDTH}
      name="production-modal"
      containerClassName="absolute left-0 top-0"
      className="pointer-events-auto"
    >
      <SecondaryPopup.Head onClose={handleClose}>Production</SecondaryPopup.Head>
      <SecondaryPopup.Body width="100%" height={PRODUCTION_POPUP_HEIGHT} className="p-4">
        {children}
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
