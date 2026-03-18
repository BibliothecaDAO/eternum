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
        <div className="grid w-full max-w-[20rem] grid-cols-2 gap-1.5 rounded-[20px] border border-black/8 bg-white/40 p-1">
          <button
            type="button"
            onClick={() => onSelect("start")}
            className={cn(
              "min-w-0 rounded-full px-3 py-2 text-[12px] font-semibold transition-all duration-200 sm:px-4 sm:text-[13px]",
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
              "min-w-0 rounded-full px-3 py-2 text-[12px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-[13px]",
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
