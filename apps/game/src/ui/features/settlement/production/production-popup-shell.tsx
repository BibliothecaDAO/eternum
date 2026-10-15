import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { SURFACE_WORKSPACE_CLASS, SurfaceFrame } from "@/ui/design-system/molecules/popover";

interface ProductionPopupShellProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/** Production's frame inside the surface popover: the shared header strip over a scrolling body at panel size. */
export const ProductionPopupShell = ({ children, onClose }: ProductionPopupShellProps) => {
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const handleClose = onClose ?? closeSurface;

  return (
    <SurfaceFrame
      title="Production"
      icon={"production" as const}
      onClose={handleClose}
      className={SURFACE_WORKSPACE_CLASS}
      bodyClassName="overflow-hidden"
    >
      {children}
    </SurfaceFrame>
  );
};
