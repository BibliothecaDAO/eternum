import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ReactNode } from "react";
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
      <div className="space-y-4 text-left md:text-center">
        <FactoryV2ToggleGroup title="Network">
          <div
            data-testid="factory-network-switch"
            className="grid w-full grid-cols-2 gap-1.5 rounded-[22px] border border-black/8 bg-white/50 p-1.5 md:mx-auto md:max-w-[18rem]"
          >
            {environmentOptions.map((environment) => {
              const isSelected = environment.id === selectedEnvironmentId;

              return (
                <button
                  key={environment.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={cn(
                    "min-h-11 min-w-0 rounded-[16px] px-3 py-2 text-[13px] font-semibold transition-all duration-200",
                    isSelected ? appearance.activeToggleClassName : appearance.inactiveToggleClassName,
                  )}
                  onClick={() => onSelectEnvironment(environment.id)}
                >
                  {environment.label}
                </button>
              );
            })}
          </div>
        </FactoryV2ToggleGroup>

        <FactoryV2ToggleGroup title="Game">
          <div
            data-testid="factory-game-switch"
            className="grid w-full grid-cols-2 gap-1.5 rounded-[22px] border border-black/8 bg-white/40 p-1.5 md:mx-auto md:max-w-[18rem]"
          >
            {modes.map((mode) => {
              const isSelected = mode.id === selectedMode;

              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={cn(
                    "min-h-11 min-w-0 rounded-[16px] px-3 py-2 text-[13px] font-semibold transition-all duration-200",
                    isSelected ? appearance.activeToggleClassName : appearance.inactiveToggleClassName,
                  )}
                  onClick={() => onSelectMode(mode.id)}
                >
                  {MODE_LABELS[mode.id]}
                </button>
              );
            })}
          </div>
        </FactoryV2ToggleGroup>
      </div>
    </section>
  );
};

const FactoryV2ToggleGroup = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="space-y-2 text-left md:text-center">
    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/42">{title}</div>
    {children}
  </div>
);
