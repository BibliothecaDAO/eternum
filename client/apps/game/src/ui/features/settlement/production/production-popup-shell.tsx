import { useUIStore } from "@/hooks/store/use-ui-store";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";

interface ProductionPopupShellProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export const ProductionPopupShell = ({ children, onClose }: ProductionPopupShellProps) => {
  const toggleModal = useUIStore((state) => state.toggleModal);

  const handleClose = onClose ?? (() => toggleModal(null));

  return (
    <SecondaryPopup
      width="min(1320px, calc(100vw - 48px))"
      name="production-modal"
      containerClassName="absolute left-0 top-0"
      className="pointer-events-auto"
    >
      <SecondaryPopup.Head onClose={handleClose}>Production</SecondaryPopup.Head>
      <SecondaryPopup.Body width="100%" height="min(78vh, 820px)" className="p-4">
        {children}
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
