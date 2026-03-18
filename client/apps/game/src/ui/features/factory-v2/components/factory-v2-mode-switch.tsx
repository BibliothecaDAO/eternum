import { cn } from "@/ui/design-system/atoms/lib/utils";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryEnvironmentOption, FactoryGameMode, FactoryModeDefinition } from "../types";

const MODE_LABELS: Record<FactoryGameMode, string> = {
  eternum: "Eternum",
  blitz: "Blitz",
};

export const FactoryV2ModeSwitch = ({
  modes,
  selectedMode,
  environmentOptions,
  selectedEnvironmentId,
  onSelectEnvironment,
  onSelectMode,
}: {
  modes: FactoryModeDefinition[];
  selectedMode: FactoryGameMode;
  environmentOptions: FactoryEnvironmentOption[];
  selectedEnvironmentId: string;
  onSelectEnvironment: (environmentId: string) => void;
  onSelectMode: (mode: FactoryGameMode) => void;
}) => {
  const selectedDefinition = modes.find((mode) => mode.id === selectedMode) ?? modes[0];

  if (!selectedDefinition) {
    return null;
  }

  const appearance = resolveFactoryModeAppearance(selectedDefinition.id);

  return (
    <section className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
      <div className="space-y-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">Network</div>
          <div className="inline-flex w-full max-w-[15rem] flex-wrap gap-1.5 rounded-full border border-black/8 bg-white/50 p-1">
            {environmentOptions.map((environment) => {
              const isSelected = environment.id === selectedEnvironmentId;

              return (
                <button
                  key={environment.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={cn(
                    "flex-1 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                    isSelected ? appearance.activeToggleClassName : appearance.inactiveToggleClassName,
                  )}
                  onClick={() => onSelectEnvironment(environment.id)}
                >
                  {environment.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">Game</div>
            <div className="inline-flex w-full max-w-[15rem] flex-wrap gap-1.5 rounded-full border border-black/8 bg-white/40 p-1">
              {modes.map((mode) => {
                const isSelected = mode.id === selectedMode;

                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={isSelected}
                    className={cn(
                      "flex-1 rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200",
                      isSelected ? appearance.activeToggleClassName : appearance.inactiveToggleClassName,
                    )}
                    onClick={() => onSelectMode(mode.id)}
                  >
                    {MODE_LABELS[mode.id]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
