import { Button } from "@/ui/design-system/atoms";
import { Trophy, X } from "lucide-react";

interface GameIsOverModalProps {
  isOpen: boolean;
  worldName: string;
  onReview: () => void;
  onClose: () => void;
  title?: string;
  description?: string;
  reviewLabel?: string;
  closeLabel?: string;
}

export const GameIsOverModal = ({
  isOpen,
  worldName,
  onReview,
  onClose,
  title = "Game Is Over",
  description,
  reviewLabel = "Review",
  closeLabel = "Close",
}: GameIsOverModalProps) => {
  if (!isOpen) return null;

  const bodyText = description ?? `${worldName} has ended. Open the game review to see what happened.`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="pointer-events-none absolute inset-0 endgame-backdrop-texture" />

      <div className="endgame-modal-enter endgame-surface panel-wood relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-gold/35 shadow-[0_24px_90px_rgba(0,0,0,0.72)]">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6 sm:p-7">
          <div className="absolute inset-x-0 top-2">
            <div className="endgame-header-ornament" />
          </div>

          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-gold/35 bg-gold/10 shadow-[0_0_24px_rgba(223,170,84,0.2)]">
            <Trophy className="h-7 w-7 text-gold" />
          </div>

          <h2 className="gold-gradient-text text-center font-serif text-2xl sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-gold/70">{bodyText}</p>

          <div className="mx-auto mt-4 h-px w-full max-w-sm bg-gradient-to-r from-transparent via-gold/45 to-transparent" />

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Button
              onClick={onReview}
              variant="gold"
              className="w-full justify-center !px-4 !py-2.5 shadow-[0_8px_20px_rgba(223,170,84,0.18)]"
              forceUppercase={false}
            >
              {reviewLabel}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full justify-center !px-4 !py-2.5"
              forceUppercase={false}
            >
              {closeLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
