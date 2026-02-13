import { Button } from "@/ui/design-system/atoms";
import { Trophy, X } from "lucide-react";

interface GameIsOverModalProps {
  isOpen: boolean;
  worldName: string;
  onReview: () => void;
  onClose: () => void;
}

export const GameIsOverModal = ({ isOpen, worldName, onReview, onClose }: GameIsOverModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-gold/30 bg-gradient-to-b from-[#0f0f10] to-[#060607] shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-gold/30 bg-gold/15">
            <Trophy className="h-6 w-6 text-gold" />
          </div>

          <h2 className="text-center font-serif text-2xl text-gold">Game Is Over</h2>
          <p className="mt-2 text-center text-sm text-gold/70">{worldName} has ended. Open the game review to see what happened.</p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={onReview}
              variant="gold"
              className="w-full justify-center !px-4 !py-2.5"
              forceUppercase={false}
            >
              Review
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full justify-center !px-4 !py-2.5"
              forceUppercase={false}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
