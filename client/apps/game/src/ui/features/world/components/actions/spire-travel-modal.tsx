import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import ArrowRightLeft from "lucide-react/dist/esm/icons/arrow-right-left";

export const SpireTravelModal = ({ onTravelThroughSpire }: { onTravelThroughSpire: () => void }) => {
  const toggleModal = useUIStore((state) => state.toggleModal);

  const closeModal = () => {
    toggleModal(null);
  };

  const handleTravel = () => {
    closeModal();
    onTravelThroughSpire();
  };

  return (
    <SecondaryPopup width="560" name="spire-travel-modal" containerClassName="absolute left-0 top-0">
      <SecondaryPopup.Head onClose={closeModal}>Spire Gate</SecondaryPopup.Head>
      <SecondaryPopup.Body width="100%" height="auto" className="p-5">
        <div className="flex flex-col gap-4 text-gold/90">
          <div className="flex items-start gap-3 rounded border border-cyan-300/25 bg-cyan-500/10 p-3">
            <Sparkles className="mt-0.5 h-4 w-4 text-cyan-200" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-cyan-100">No ethereal defenders detected</p>
              <p className="text-xs text-gold/70">
                This Spire is clear. Move through it to enter the Ethereal Layer from this coordinate.
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
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
