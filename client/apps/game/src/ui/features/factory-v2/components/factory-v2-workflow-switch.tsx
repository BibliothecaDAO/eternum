import { cn } from "@/ui/design-system/atoms/lib/utils";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryGameMode } from "../types";

export type FactoryWorkflowView = "start" | "watch";

export const FactoryV2WorkflowSwitch = ({
  mode,
  selectedView,
  canWatch,
  onSelect,
}: {
  mode: FactoryGameMode;
  selectedView: FactoryWorkflowView;
  canWatch: boolean;
  onSelect: (view: FactoryWorkflowView) => void;
}) => {
  const appearance = resolveFactoryModeAppearance(mode);

  return (
    <section className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">What you want to do</div>
        <div className="inline-flex w-auto flex-nowrap gap-1.5 rounded-full border border-black/8 bg-white/40 p-1">
          <button
            type="button"
            onClick={() => onSelect("start")}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200",
              selectedView === "start" ? appearance.activeToggleClassName : appearance.inactiveToggleClassName,
            )}
          >
            Start a game
          </button>

          <button
            type="button"
            onClick={() => onSelect("watch")}
            disabled={!canWatch}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
              selectedView === "watch" ? appearance.activeToggleClassName : appearance.inactiveToggleClassName,
            )}
          >
            Check a game
          </button>
        </div>
      </div>
    </section>
  );
};
