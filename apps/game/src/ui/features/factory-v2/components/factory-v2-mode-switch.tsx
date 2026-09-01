import { cn } from "@/ui/design-system/atoms/lib/utils";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryGameMode, FactoryModeDefinition } from "../types";

export const FactoryV2ModeSwitch = ({
  modes,
  selectedMode,
  onSelectMode,
}: {
  modes: FactoryModeDefinition[];
  selectedMode: FactoryGameMode;
  onSelectMode: (mode: FactoryGameMode) => void;
}) => {
  const appearance = resolveFactoryModeAppearance(selectedMode);

  return (
    <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
      <div className="space-y-2 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold/42">Game</div>
        <div
          data-testid="factory-game-switch"
          className="mx-auto grid w-full grid-cols-2 gap-1.5 rounded-[22px] border border-gold/10 bg-black/20 p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.10)] md:max-w-[18rem]"
        >
          {modes.map((mode) => {
            const isSelected = mode.id === selectedMode;

            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={isSelected}
                className={cn(
                  "min-h-11 min-w-0 rounded-[18px] px-3 py-2 text-[13px] font-semibold transition-all duration-200",
                  isSelected ? appearance.activeToggleClassName : appearance.inactiveToggleClassName,
                )}
                onClick={() => onSelectMode(mode.id)}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
