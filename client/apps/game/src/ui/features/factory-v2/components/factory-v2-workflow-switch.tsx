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
      <div className="space-y-2 text-left md:text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">What you want to do</div>
        <div
          data-testid="factory-workflow-switch"
          className="grid w-full grid-cols-2 gap-1.5 rounded-[22px] border border-black/8 bg-white/40 p-1.5 md:mx-auto md:max-w-[20rem]"
        >
          <button
            type="button"
            onClick={() => onSelect("start")}
            className={cn(
              "min-h-11 min-w-0 rounded-[16px] px-3 py-2 text-[13px] font-semibold transition-all duration-200",
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
              "min-h-11 min-w-0 rounded-[16px] px-3 py-2 text-[13px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
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
