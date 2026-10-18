import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { HudWindow } from "@/ui/design-system/kit/hud-elements";

interface ProductionPopupShellProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/** Production's window inside the surface popover, a workspace on the HUD sheet. */
export const ProductionPopupShell = ({ children, onClose }: ProductionPopupShellProps) => {
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const handleClose = onClose ?? closeSurface;

  return (
    <HudWindow title="Production" icon="production" size="workspace" onClose={handleClose}>
      {children}
    </HudWindow>
  );
};
