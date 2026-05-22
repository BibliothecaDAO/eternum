import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ActorType, ID } from "@bibliothecadao/types";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import X from "lucide-react/dist/esm/icons/x";
import { Suspense, useCallback, useEffect } from "react";
import { ChestContainer } from "./chest-container";

export const ChestModal = ({
  selected,
  chestHex,
}: {
  selected: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  chestHex: { x: number; y: number };
}) => {
  const toggleModal = useUIStore((state) => state.toggleModal);
  const close = useCallback(() => toggleModal(null), [toggleModal]);

  // Esc to dismiss, matching every other centered HUD modal.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto"
      onClick={close}
    >
      <div
        className={cn(
          "pointer-events-auto flex w-[920px] max-w-[92vw] h-[700px] max-h-[calc(100vh-64px)] flex-col overflow-hidden rounded-xl",
          OVERLAY_SURFACE_BASE,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header — matches the etched-bronze pill row. Title left, close icon
            right, same h-9 visual rhythm as the top bar pills. */}
        <div className="flex items-center justify-between gap-2 border-b border-gold/15 px-4 py-2.5">
          <span className={cn("flex items-center gap-2", HUD_LABEL_BRIGHT)}>
            <Sparkles className="h-4 w-4 text-gold" />
            Open Relic Crate
          </span>
          <button
            type="button"
            onClick={close}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gold/30 bg-black/30 text-gold/80 transition hover:border-gold hover:bg-gold/15 hover:text-gold"
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <Suspense fallback={<LoadingAnimation />}>
            <ChestContainer explorerEntityId={selected.id} chestHex={chestHex} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};
