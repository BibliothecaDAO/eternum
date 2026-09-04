import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
import Factory from "lucide-react/dist/esm/icons/factory";

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
      icon={Factory}
      onClose={handleClose}
      className="w-[1320px] h-[calc(100vh-7rem)]"
      bodyClassName="overflow-hidden"
    >
      {children}
    </SurfaceFrame>
  );
};
