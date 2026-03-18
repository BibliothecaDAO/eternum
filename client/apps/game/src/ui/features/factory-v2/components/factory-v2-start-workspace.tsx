import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Rocket from "lucide-react/dist/esm/icons/rocket";
import RotateCw from "lucide-react/dist/esm/icons/rotate-cw";
import { formatFactoryDurationLabel } from "../duration";
import { supportsBlitzRegistrationModes } from "../launch-modes";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryDurationOption, FactoryGameMode, FactoryLaunchPreset } from "../types";

const getPresetFacts = (preset: FactoryLaunchPreset) =>
  [
    typeof preset.defaults.durationMinutes === "number"
      ? formatFactoryDurationLabel(preset.defaults.durationMinutes)
      : null,
    preset.defaults.devMode ? "Dev mode" : null,
  ].filter(Boolean);

export const FactoryV2StartWorkspace = ({
  mode,
  modeLabel,
  environmentLabel,
  isMainnet,
  presets,
  selectedPreset,
  gameName,
  startAt,
  durationMinutes,
  showsDuration,
  durationOptions,
  twoPlayerMode,
  singleRealmMode,
  existingGameName,
  notice,
  launchDisabledReason,
  onSelectPreset,
  onGameNameChange,
  onStartAtChange,
  onDurationChange,
  onToggleTwoPlayerMode,
  onToggleSingleRealmMode,
  onFandomizeGameName,
  onLaunch,
  isWatcherBusy,
}: {
  mode: FactoryGameMode;
  modeLabel: string;
  environmentLabel: string;
  isMainnet: boolean;
  presets: FactoryLaunchPreset[];
  selectedPreset: FactoryLaunchPreset | null;
  gameName: string;
  startAt: string;
  durationMinutes: number | null;
  showsDuration: boolean;
  durationOptions: FactoryDurationOption[];
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
  existingGameName: string | null;
  notice: string | null;
  launchDisabledReason: string | null;
  onSelectPreset: (presetId: string) => void;
  onGameNameChange: (value: string) => void;
  onStartAtChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onToggleTwoPlayerMode: () => void;
  onToggleSingleRealmMode: () => void;
  onFandomizeGameName: () => void;
  onLaunch: () => void;
  isWatcherBusy: boolean;
}) => {
  const appearance = resolveFactoryModeAppearance(mode);

  if (!selectedPreset) {
    return (
      <article className="mx-auto max-w-xl">
        <div className={cn("rounded-[28px] border p-6 md:p-7", appearance.featureSurfaceClassName)}>
          <div className="text-sm leading-6 text-black/58">Pick a preset first.</div>
        </div>
      </article>
    );
  }

  const showsBlitzModes = supportsBlitzRegistrationModes(mode);
  const canLaunch = gameName.trim().length > 0 && !isWatcherBusy && !existingGameName && !launchDisabledReason;
  const presetFacts = getPresetFacts(selectedPreset).join(" · ");
  const launchLabel = `Launch ${modeLabel} game on ${environmentLabel}`;
  const launchButtonClassName = isMainnet
    ? "bg-[#a62f28] text-white hover:bg-[#912520]"
    : appearance.primaryButtonClassName;

  return (
    <article className="mx-auto max-w-lg">
      <div
        className={cn(
          "rounded-[28px] border px-6 py-7 text-center md:px-7 md:py-8",
          appearance.featureSurfaceClassName,
        )}
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="factory-preset"
              className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42"
            >
              Preset
            </label>
            <div className="relative mt-2">
              <select
                id="factory-preset"
                value={selectedPreset.id}
                onChange={(event) => onSelectPreset(event.target.value)}
                className={cn(
                  "h-11 w-full appearance-none rounded-[18px] border border-black/10 bg-white/78 px-4 pr-11 text-center text-sm font-medium text-black outline-none transition-colors focus:border-black/25",
                  appearance.listItemClassName,
                )}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
            </div>
            <p className="mt-3 text-sm leading-6 text-black/48">{selectedPreset.description}</p>
            {presetFacts ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-black/40">{presetFacts}</p>
            ) : null}
          </div>

          <div>
            <div className="flex flex-col items-center gap-2">
              <label
                htmlFor="factory-game-name"
                className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42"
              >
                Game name
              </label>
              <button
                type="button"
                onClick={onFandomizeGameName}
                aria-label="Fandomize game name"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  appearance.secondaryButtonClassName,
                )}
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
            <input
              id="factory-game-name"
              value={gameName}
              onChange={(event) => onGameNameChange(event.target.value)}
              placeholder={mode === "eternum" ? "etrn-sunrise-01" : "bltz-sprint-01"}
              className="mt-2 h-11 w-full rounded-[18px] border border-black/10 bg-white/78 px-4 text-center text-sm text-black outline-none transition-colors placeholder:text-black/30 focus:border-black/25"
            />
            {existingGameName ? (
              <p className="mt-2 text-sm leading-6 text-black/50">That game already exists. We will open its live status.</p>
            ) : null}
            {!existingGameName && notice ? <p className="mt-2 text-sm leading-6 text-black/50">{notice}</p> : null}
            {!existingGameName && launchDisabledReason ? (
              <p className="mt-2 text-sm leading-6 text-black/50">{launchDisabledReason}</p>
            ) : null}
          </div>

          <div className={cn("grid gap-4", showsDuration ? "sm:grid-cols-2" : "")}>
            <div>
              <label
                htmlFor="factory-start-at"
                className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42"
              >
                Start time
              </label>
              <input
                id="factory-start-at"
                type="datetime-local"
                value={startAt}
                onChange={(event) => onStartAtChange(event.target.value)}
                className="mt-2 h-11 w-full rounded-[18px] border border-black/10 bg-white/78 px-4 text-center text-sm text-black outline-none transition-colors focus:border-black/25"
              />
            </div>

            {showsDuration && durationMinutes !== null ? (
              <div>
                <label
                  htmlFor="factory-duration"
                  className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42"
                >
                  Duration
                </label>
                <div className="relative mt-2">
                  <select
                    id="factory-duration"
                    value={String(durationMinutes)}
                    onChange={(event) => onDurationChange(Number(event.target.value))}
                    className={cn(
                      "h-11 w-full appearance-none rounded-[18px] border border-black/10 bg-white/78 px-4 pr-11 text-center text-sm font-medium text-black outline-none transition-colors focus:border-black/25",
                      appearance.listItemClassName,
                    )}
                  >
                    {durationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                </div>
              </div>
            ) : null}
          </div>

          {showsBlitzModes ? (
            <div className={cn("space-y-2 rounded-[22px] px-4 py-4", appearance.quietSurfaceClassName)}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Play style</div>
              <div className="grid grid-cols-2 gap-2">
                <FactoryV2LaunchToggle
                  label="Two player"
                  isEnabled={twoPlayerMode}
                  appearanceClassName={appearance.secondaryButtonClassName}
                  onClick={onToggleTwoPlayerMode}
                />
                <FactoryV2LaunchToggle
                  label="Single realm"
                  isEnabled={singleRealmMode}
                  appearanceClassName={appearance.secondaryButtonClassName}
                  onClick={onToggleSingleRealmMode}
                />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onLaunch}
            disabled={!canLaunch}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              launchButtonClassName,
            )}
          >
            <Rocket className="h-5 w-5" />
            {launchLabel}
          </button>
        </div>
      </div>
    </article>
  );
};

const FactoryV2LaunchToggle = ({
  label,
  isEnabled,
  appearanceClassName,
  onClick,
}: {
  label: string;
  isEnabled: boolean;
  appearanceClassName: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={isEnabled}
    className={cn(
      "w-full rounded-[16px] px-4 py-3 text-sm font-semibold transition-colors",
      isEnabled ? "bg-black text-white" : appearanceClassName,
    )}
  >
    {label}
  </button>
);
