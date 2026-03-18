import type { ReactNode } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Rocket from "lucide-react/dist/esm/icons/rocket";
import RotateCw from "lucide-react/dist/esm/icons/rotate-cw";
import { formatFactoryDurationLabel } from "../duration";
import {
  getBlitzPlayStyleOptions,
  resolveSelectedBlitzPlayStyleId,
  supportsBlitzRegistrationModes,
  type BlitzPlayStyleId,
} from "../launch-modes";
import {
  getFactoryMoreOptionField,
  type FactoryMoreOptionField,
  type FactoryMoreOptionSection,
  type FactoryMoreOptionsDraft,
  type FactoryMoreOptionsErrors,
} from "../map-options";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryDurationOption, FactoryGameMode, FactoryLaunchPreset } from "../types";
import { FactoryV2MoreOptions } from "./factory-v2-more-options";

const getPresetFacts = (preset: FactoryLaunchPreset) =>
  [
    typeof preset.defaults.durationMinutes === "number"
      ? formatFactoryDurationLabel(preset.defaults.durationMinutes)
      : null,
    preset.defaults.devMode ? "Test mode" : null,
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
  moreOptionsOpen,
  moreOptionSections,
  moreOptionDraft,
  moreOptionErrors,
  moreOptionsDisabledReason,
  onSelectPreset,
  onGameNameChange,
  onStartAtChange,
  onDurationChange,
  onToggleMapOptions,
  onMapOptionValueChange,
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
  moreOptionsOpen: boolean;
  moreOptionSections: FactoryMoreOptionSection[];
  moreOptionDraft: FactoryMoreOptionsDraft;
  moreOptionErrors: FactoryMoreOptionsErrors;
  moreOptionsDisabledReason: string | null;
  onSelectPreset: (presetId: string) => void;
  onGameNameChange: (value: string) => void;
  onStartAtChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onToggleMapOptions: () => void;
  onMapOptionValueChange: (fieldId: keyof FactoryMoreOptionsDraft, value: string) => void;
  onToggleTwoPlayerMode: () => void;
  onToggleSingleRealmMode: () => void;
  onFandomizeGameName: () => void;
  onLaunch: () => void;
  isWatcherBusy: boolean;
}) => {
  const appearance = resolveFactoryModeAppearance(mode);

  if (!selectedPreset) {
    return (
      <article className="w-full md:mx-auto md:max-w-xl">
        <div className={cn("px-4 py-5 md:rounded-[28px] md:border md:p-7", appearance.featureSurfaceClassName)}>
          <div className="text-sm leading-6 text-black/58">Pick a preset first.</div>
        </div>
      </article>
    );
  }

  const showsBlitzModes = supportsBlitzRegistrationModes(mode);
  const maxPlayersField = getFactoryMoreOptionField(mode, "maxPlayers", { twoPlayerMode });
  const blitzPlayStyleOptions = getBlitzPlayStyleOptions();
  const selectedBlitzPlayStyleId = resolveSelectedBlitzPlayStyleId({ twoPlayerMode, singleRealmMode });
  const canLaunch =
    gameName.trim().length > 0 &&
    !isWatcherBusy &&
    !existingGameName &&
    !launchDisabledReason &&
    !moreOptionsDisabledReason;
  const presetFacts = getPresetFacts(selectedPreset).join(" · ");
  const launchLabel = `Launch ${modeLabel} on ${environmentLabel}`;
  const launchButtonClassName = isMainnet
    ? "bg-[#a62f28] text-white hover:bg-[#912520]"
    : appearance.primaryButtonClassName;
  const launchSummaryItems = [
    selectedPreset.name,
    environmentLabel,
    showsDuration && durationMinutes !== null ? formatFactoryDurationLabel(durationMinutes) : null,
    showsBlitzModes ? blitzPlayStyleOptions.find((playStyle) => playStyle.id === selectedBlitzPlayStyleId)?.label ?? null : null,
  ].filter(Boolean) as string[];

  const selectBlitzPlayStyle = (playStyleId: BlitzPlayStyleId) => {
    switch (playStyleId) {
      case "multiple-players-three-realms":
        if (twoPlayerMode) {
          onToggleTwoPlayerMode();
          return;
        }

        if (singleRealmMode) {
          onToggleSingleRealmMode();
        }
        return;
      case "two-players-three-realms":
        if (!twoPlayerMode) {
          onToggleTwoPlayerMode();
        }
        return;
      case "multiple-players-one-realm":
        if (!singleRealmMode) {
          onToggleSingleRealmMode();
        }
        return;
    }
  };

  return (
    <article className="w-full md:mx-auto md:max-w-lg">
      <div className={cn("px-0 py-0 md:rounded-[28px] md:border md:px-7 md:py-8", appearance.featureSurfaceClassName)}>
        <div className="space-y-3 pb-24 md:space-y-4 md:pb-0">
          <FactoryV2StartSectionCard
            title="Launch basics"
            description="Choose the preset, name, and timing for this run."
            appearanceClassName={appearance.quietSurfaceClassName}
          >
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
                    "h-11 w-full appearance-none rounded-[18px] border border-black/10 bg-white/78 px-4 pr-11 text-left text-sm font-medium text-black outline-none transition-colors focus:border-black/25 md:text-center",
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
              <div className="flex items-center justify-between gap-3">
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
                className="mt-2 h-11 w-full rounded-[18px] border border-black/10 bg-white/78 px-4 text-left text-sm text-black outline-none transition-colors placeholder:text-black/30 focus:border-black/25 md:text-center"
              />
              {existingGameName ? (
                <p className="mt-2 text-sm leading-6 text-black/50">
                  That name is already in use. We will open that game instead.
                </p>
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
                  className="mt-2 h-11 w-full rounded-[18px] border border-black/10 bg-white/78 px-4 text-left text-sm text-black outline-none transition-colors focus:border-black/25 md:text-center"
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
                        "h-11 w-full appearance-none rounded-[18px] border border-black/10 bg-white/78 px-4 pr-11 text-left text-sm font-medium text-black outline-none transition-colors focus:border-black/25 md:text-center",
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
          </FactoryV2StartSectionCard>

          {showsBlitzModes ? (
            <FactoryV2StartSectionCard
              title="Blitz setup"
              description="Pick the realm spread, then adjust the multiplayer cap when needed."
              appearanceClassName={appearance.quietSurfaceClassName}
            >
              {maxPlayersField ? (
                <FactoryV2InlineOptionField
                  field={maxPlayersField}
                  value={moreOptionDraft.maxPlayers}
                  error={moreOptionErrors.maxPlayers}
                  onChange={(value) => onMapOptionValueChange("maxPlayers", value)}
                />
              ) : null}

              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Play style</div>
                <p className="text-sm leading-5 text-black/50">
                  Choose how players and realms are arranged for this run.
                </p>
              </div>
              <div className="space-y-1.5">
                {blitzPlayStyleOptions.map((playStyle) => (
                  <FactoryV2PlayStyleOption
                    key={playStyle.id}
                    label={playStyle.label}
                    isEnabled={selectedBlitzPlayStyleId === playStyle.id}
                    appearanceClassName={appearance.secondaryButtonClassName}
                    onClick={() => selectBlitzPlayStyle(playStyle.id)}
                  />
                ))}
              </div>
            </FactoryV2StartSectionCard>
          ) : null}

          <FactoryV2StartSectionCard
            title="Advanced"
            description="Optional map tuning for this launch only."
            appearanceClassName={appearance.quietSurfaceClassName}
          >
            <FactoryV2MoreOptions
              mode={mode}
              isOpen={moreOptionsOpen}
              sections={moreOptionSections}
              draft={moreOptionDraft}
              errors={moreOptionErrors}
              invalidReason={moreOptionsDisabledReason}
              onToggle={onToggleMapOptions}
              onValueChange={onMapOptionValueChange}
            />
          </FactoryV2StartSectionCard>

          <FactoryV2LaunchActionBar
            launchSummaryItems={launchSummaryItems}
            launchLabel={launchLabel}
            canLaunch={canLaunch}
            appearanceClassName={appearance.quietSurfaceClassName}
            buttonClassName={launchButtonClassName}
            onLaunch={onLaunch}
          />
        </div>
      </div>
    </article>
  );
};

const FactoryV2StartSectionCard = ({
  title,
  description,
  appearanceClassName,
  children,
}: {
  title: string;
  description: string;
  appearanceClassName: string;
  children: ReactNode;
}) => (
  <section className={cn("space-y-4 rounded-[24px] border border-black/8 px-4 py-4 text-left sm:px-5 sm:py-5", appearanceClassName)}>
    <div className="mx-auto max-w-sm space-y-1 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">{title}</div>
      <p className="text-sm leading-5 text-black/50">{description}</p>
    </div>
    {children}
  </section>
);

const FactoryV2InlineOptionField = ({
  field,
  value,
  error,
  onChange,
}: {
  field: FactoryMoreOptionField;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) => (
  <label className="block rounded-[20px] border border-black/8 bg-white/72 px-4 py-3.5">
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-5 text-black/74">{field.label}</span>
        <span className="block text-[11px] leading-4 text-black/38">{field.helperText}</span>
      </div>
      <div
        className={cn(
          "flex h-9 items-center gap-1 rounded-full border bg-white px-2.5 shadow-[0_1px_0_rgba(255,255,255,0.55)]",
          error ? "border-rose-400/70" : "border-black/10",
        )}
      >
        <input
          type="number"
          inputMode={field.inputMode === "percentage" ? "decimal" : "numeric"}
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-16 border-0 bg-transparent p-0 text-right text-[13px] font-semibold text-black outline-none"
        />
        {field.unitLabel ? (
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-black/42">{field.unitLabel}</span>
        ) : null}
      </div>
    </div>
    {error ? <span className="mt-1 block text-[11px] leading-5 text-rose-700">{error}</span> : null}
  </label>
);

const FactoryV2PlayStyleOption = ({
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
      "w-full rounded-[18px] border px-4 py-3 text-left transition-all duration-200",
      isEnabled
        ? "border-black/16 bg-[rgba(255,252,247,0.82)] text-[#1b140f] shadow-[0_8px_20px_rgba(44,28,15,0.08)]"
        : cn(appearanceClassName, "text-black/70 shadow-none"),
    )}
  >
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
          isEnabled ? "border-[#1b140f] bg-[#1b140f]" : "border-black/18 bg-transparent",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-colors duration-200",
            isEnabled ? "bg-[#fff7ec]" : "bg-transparent",
          )}
        />
      </span>
      <span className="text-[13px] font-semibold leading-5">{label}</span>
    </div>
  </button>
);

const FactoryV2LaunchActionBar = ({
  launchSummaryItems,
  launchLabel,
  canLaunch,
  appearanceClassName,
  buttonClassName,
  onLaunch,
}: {
  launchSummaryItems: string[];
  launchLabel: string;
  canLaunch: boolean;
  appearanceClassName: string;
  buttonClassName: string;
  onLaunch: () => void;
}) => (
  <div
    data-testid="factory-start-action-bar"
    className={cn(
      "sticky bottom-3 z-10 space-y-3 rounded-[24px] border border-black/10 px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-4 text-left shadow-[0_18px_42px_rgba(23,15,8,0.16)] backdrop-blur-xl md:static md:rounded-[22px] md:border-black/8 md:px-4 md:py-4 md:shadow-none md:backdrop-blur-0",
      appearanceClassName,
    )}
  >
    <div className="flex flex-wrap justify-center gap-2">
      {launchSummaryItems.map((item) => (
        <span
          key={item}
          className="rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[11px] font-medium text-black/56"
        >
          {item}
        </span>
      ))}
    </div>

    <button
      type="button"
      onClick={onLaunch}
      disabled={!canLaunch}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonClassName,
      )}
    >
      <Rocket className="h-5 w-5" />
      {launchLabel}
    </button>
  </div>
);
