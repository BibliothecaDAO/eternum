import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
import Button from "@/ui/design-system/atoms/button";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import ArrowRightLeft from "lucide-react/dist/esm/icons/arrow-right-left";

export const SpireTravelModal = ({
  onTravelThroughSpire,
  essenceCost,
}: {
  onTravelThroughSpire: () => void;
  essenceCost: number;
}) => {
  const closeSurface = usePopoverStore((state) => state.closeSurface);

  const closeModal = () => {
    closeSurface();
  };

  const handleTravel = () => {
    closeModal();
    onTravelThroughSpire();
  };

  return (
    <SurfaceFrame title="Spire Gate" icon={Sparkles} onClose={closeModal} className="w-[560px]" bodyClassName="p-5">
      <div className="flex flex-col gap-4 text-gold/90">
        <div className="flex items-start gap-3 rounded border border-cyan-300/25 bg-cyan-500/10 p-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-cyan-200" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-cyan-100">Public portal</p>
            <p className="text-xs text-gold/70">
              Cross between the surface and ethereal at the same coordinates. Each crossing costs {essenceCost} Essence
              from your army’s home structure, including the return journey.
            </p>
          </div>
        </div>
        <Button
          size="md"
          forceUppercase={false}
          className="w-full border-cyan-300/50 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25"
          onClick={handleTravel}
        >
          <span className="inline-flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Travel Through Spire
          </span>
        </Button>
      </div>
    </SurfaceFrame>
  );
};
