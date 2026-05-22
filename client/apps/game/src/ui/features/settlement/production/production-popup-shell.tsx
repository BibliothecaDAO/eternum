import { useUIStore } from "@/hooks/store/use-ui-store";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import Factory from "lucide-react/dist/esm/icons/factory";

interface ProductionPopupShellProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * Production-specific wrapper around the shared modal shell. Kept as a thin
 * adapter so the modal's existing consumers (and the test file) don't have
 * to change — but the chrome (backdrop, bronze frame, header strip, close
 * button) now comes from the shared CenteredModalShell so Production matches
 * Build / Military / Chat / Logistics visually.
 */
export const ProductionPopupShell = ({ children, onClose }: ProductionPopupShellProps) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const handleClose = onClose ?? (() => toggleModal(null));

  return (
    <CenteredModalShell title="Production" icon={Factory} onClose={handleClose} size="xl">
      {children}
    </CenteredModalShell>
  );
};
