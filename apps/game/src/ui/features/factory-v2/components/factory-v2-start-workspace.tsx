import { useState, type ReactNode } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import Info from "lucide-react/dist/esm/icons/info";
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
  type FactoryMoreOptionSection,
  type FactoryMoreOptionsDraft,
  type FactoryMoreOptionsErrors,
} from "../map-options";
import type {
  FactoryBiomeClimateDraft,
  FactoryBiomeClimateErrors,
  FactoryBiomeClimateFieldId,
} from "../biome-climate-options";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import {
  buildFactoryStartAtValue,
  formatFactoryStartDateLabel,
  formatFactoryStartTimeLabel,
  resolveFactoryStartDatePart,
  resolveFactoryStartTimePart,
} from "../start-time";
import type {
  FactoryDurationOption,
  FactoryGameMode,
  FactoryLaunchChain,
  FactoryLaunchPreset,
  FactoryLaunchTargetKind,
  FactoryRotationEvaluationIntervalMinutes,
  FactoryRotationPreviewGame,
  FactorySeriesGameDraft,
  FactorySeriesRetryIntervalMinutes,
} from "../types";
import { FactoryV2DeployerWalletCard } from "./factory-v2-deployer-wallet-card";
import { FactoryV2StartAdvanced } from "./factory-v2-start-advanced";
import {
  FACTORY_FIELD_CONTROL_CLASS_NAME,
  FACTORY_SELECT_CONTROL_CLASS_NAME,
  FactoryV2StartSectionCard,
} from "./factory-v2-start-primitives";

const getPresetFacts = (preset: FactoryLaunchPreset) =>
  [
    typeof preset.defaults.durationMinutes === "number"
      ? formatFactoryDurationLabel(preset.defaults.durationMinutes)
      : null,
    preset.defaults.devMode ? "Test mode" : null,
  ].filter(Boolean);

const FACTORY_SCHEDULE_PANEL_CLASS_NAME =
  "block min-w-0 overflow-hidden rounded-[20px] border border-gold/10 bg-black/20 px-3 py-3 shadow-[0_8px_22px_rgba(0,0,0,0.12)] backdrop-blur-[6px] transition-colors focus-within:border-gold/25";

const FACTORY_MOBILE_PICKER_INPUT_CLASS_NAME =
  "absolute inset-0 h-full w-full min-w-0 max-w-full cursor-pointer opacity-0";

const FACTORY_DESKTOP_PICKER_INPUT_CLASS_NAME =
  "sm:static sm:mt-2 sm:block sm:h-11 sm:w-full sm:min-w-0 sm:max-w-full sm:rounded-[18px] sm:border sm:border-gold/15 sm:bg-black/25 sm:px-4 sm:text-left sm:text-sm sm:font-medium sm:text-gold sm:opacity-100 sm:outline-none sm:transition-colors sm:focus:border-gold/30 sm:[color-scheme:dark]";

const FACTORY_NATIVE_PICKER_INPUT_CLASS_NAME = `${FACTORY_MOBILE_PICKER_INPUT_CLASS_NAME} ${FACTORY_DESKTOP_PICKER_INPUT_CLASS_NAME}`;

const FACTORY_SCHEDULE_VALUE_SURFACE_CLASS_NAME =
  "pointer-events-none mt-2 flex h-11 items-center gap-3 rounded-[18px] border border-gold/15 bg-black/25 px-4 text-left text-[13px] text-gold shadow-none sm:hidden";

const FACTORY_SERIES_RETRY_OPTIONS: FactorySeriesRetryIntervalMinutes[] = [5, 15, 30, 60];
const FACTORY_ROTATION_EVALUATION_OPTIONS: FactoryRotationEvaluationIntervalMinutes[] = [5, 15, 30, 60];

type FactoryV2StartWorkspaceProps = {
  mode: FactoryGameMode;
  modeLabel: string;
  environmentLabel: string;
  launchTargetKind: FactoryLaunchTargetKind;
  presets: FactoryLaunchPreset[];
  selectedPreset: FactoryLaunchPreset | null;
  gameName: string;
  seriesName: string;
  rotationName: string;
  startAt: string;
  durationMinutes: number | null;
  seriesGameCount: number;
  seriesGames: FactorySeriesGameDraft[];
  rotationPreviewGames: FactoryRotationPreviewGame[];
  rotationGameIntervalMinutes: number;
  rotationMaxGames: number;
  rotationAdvanceWindowGames: number;
  rotationEvaluationIntervalMinutes: FactoryRotationEvaluationIntervalMinutes;
  autoRetryIntervalMinutes: FactorySeriesRetryIntervalMinutes;
  showsDuration: boolean;
  durationOptions: FactoryDurationOption[];
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
  devModeOn: boolean;
  seriesSuggestions: Array<{
    name: string;
    lastGameNumber: number | null;
    nextGameNumber: number;
  }>;
  isLoadingSeries: boolean;
  seriesLookupError: string | null;
  existingRunName: string | null;
  notice: string | null;
  moreOptionSections: FactoryMoreOptionSection[];
  moreOptionDraft: FactoryMoreOptionsDraft;
  moreOptionErrors: FactoryMoreOptionsErrors;
  moreOptionsDisabledReason: string | null;
  biomeClimateDraft: FactoryBiomeClimateDraft;
  biomeClimateErrors: FactoryBiomeClimateErrors;
  biomeClimateTargets: Array<{ id: string; label: string }>;
  selectedBiomeClimateTargetId: string;
  biomeClimateDisabledReason: string | null;
  onSelectLaunchTargetKind: (kind: FactoryLaunchTargetKind) => void;
  onSelectPreset: (presetId: string) => void;
  onGameNameChange: (value: string) => void;
  onSeriesNameChange: (value: string) => void;
  onRotationNameChange: (value: string) => void;
  onStartAtChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onSeriesGameCountChange: (value: number) => void;
  onSeriesGameNameChange: (gameId: string, value: string) => void;
  onSeriesGameStartAtChange: (gameId: string, value: string) => void;
  onRotationGameIntervalMinutesChange: (value: number) => void;
  onRotationMaxGamesChange: (value: number) => void;
  onRotationAdvanceWindowGamesChange: (value: number) => void;
  onRotationEvaluationIntervalChange: (value: FactoryRotationEvaluationIntervalMinutes) => void;
  onAutoRetryIntervalChange: (value: FactorySeriesRetryIntervalMinutes) => void;
  onSelectSeriesSuggestion: (seriesName: string) => void;
  onMapOptionValueChange: (fieldId: keyof FactoryMoreOptionsDraft, value: string) => void;
  onSelectBiomeClimateTarget: (targetId: string) => void;
  onBiomeClimateValueChange: (fieldId: FactoryBiomeClimateFieldId, value: string) => void;
  onRandomizeBiomeClimateSeeds: () => void;
  onResetBiomeClimate: () => void;
  onApplyBiomeClimateToAll: () => void;
  onToggleTwoPlayerMode: () => void;
  onToggleSingleRealmMode: () => void;
  onToggleDevMode: () => void;
  onFandomizeGameName: () => void;
  chain: FactoryLaunchChain;
  onLaunch: () => void;
  isWatcherBusy: boolean;
};

type FactoryV2StartWorkspaceState = {
  showsBlitzModes: boolean;
  blitzPlayStyleOptions: ReturnType<typeof getBlitzPlayStyleOptions>;
  selectedBlitzPlayStyleId: BlitzPlayStyleId;
  isSeriesLaunch: boolean;
  isRotationLaunch: boolean;
  canLaunch: boolean;
  presetFacts: string;
  launchLabel: string;
  launchButtonClassName: string;
  launchSummaryItems: string[];
  launchBasicsTitle: string;
  launchBasicsDescription: string;
  timingHelperText: string;
};

type FactoryV2ConfiguredStartWorkspaceProps = FactoryV2StartWorkspaceProps & {
  selectedPreset: FactoryLaunchPreset;
  appearance: ReturnType<typeof resolveFactoryModeAppearance>;
  workspace: FactoryV2StartWorkspaceState;
};

type FactoryV2ResolvedStartWorkspaceProps = FactoryV2StartWorkspaceProps & {
  selectedPreset: FactoryLaunchPreset;
};

export const FactoryV2StartWorkspace = (props: FactoryV2StartWorkspaceProps) => {
  const appearance = resolveFactoryModeAppearance(props.mode);
  const selectedPreset = props.selectedPreset;

  if (!selectedPreset) {
    return <FactoryV2StartWorkspaceEmptyState appearanceClassName={appearance.featureSurfaceClassName} />;
  }

  return (
    <FactoryV2ConfiguredStartWorkspace
      {...props}
      appearance={appearance}
      selectedPreset={selectedPreset}
      workspace={resolveStartWorkspaceState({ ...props, selectedPreset }, appearance)}
    />
  );
};

function resolveStartWorkspaceState(
  {
    mode,
    modeLabel,
    environmentLabel,
    launchTargetKind,
    selectedPreset,
    gameName,
    seriesName,
    seriesGames,
    rotationName,
    startAt,
    rotationGameIntervalMinutes,
    rotationMaxGames,
    rotationAdvanceWindowGames,
    rotationEvaluationIntervalMinutes,
    autoRetryIntervalMinutes,
    showsDuration,
    durationMinutes,
    twoPlayerMode,
    singleRealmMode,
    isWatcherBusy,
    moreOptionsDisabledReason,
    biomeClimateDisabledReason,
  }: FactoryV2ResolvedStartWorkspaceProps,
  appearance: ReturnType<typeof resolveFactoryModeAppearance>,
): FactoryV2StartWorkspaceState {
  const showsBlitzModes = supportsBlitzRegistrationModes(mode);
  const blitzPlayStyleOptions = getBlitzPlayStyleOptions();
  const selectedBlitzPlayStyleId = resolveSelectedBlitzPlayStyleId({ twoPlayerMode, singleRealmMode });
  const isSeriesLaunch = launchTargetKind === "series";
  const isRotationLaunch = launchTargetKind === "rotation";

  return {
    showsBlitzModes,
    blitzPlayStyleOptions,
    selectedBlitzPlayStyleId,
    isSeriesLaunch,
    isRotationLaunch,
    canLaunch:
      resolveLaunchReadiness({
        isSeriesLaunch,
        isRotationLaunch,
        gameName,
        seriesName,
        seriesGames,
        rotationName,
        startAt,
        rotationGameIntervalMinutes,
        rotationMaxGames,
        rotationAdvanceWindowGames,
      }) &&
      !isWatcherBusy &&
      !moreOptionsDisabledReason &&
      !biomeClimateDisabledReason,
    presetFacts: getPresetFacts(selectedPreset).join(" · "),
    launchLabel: resolveLaunchLabel({
      isSeriesLaunch,
      isRotationLaunch,
      environmentLabel,
      modeLabel,
      seriesGameCount: seriesGames.length,
    }),
    launchButtonClassName: appearance.primaryButtonClassName,
    launchSummaryItems: resolveLaunchSummaryItems({
      isSeriesLaunch,
      isRotationLaunch,
      presetName: selectedPreset.name,
      environmentLabel,
      seriesGameCount: seriesGames.length,
      autoRetryIntervalMinutes,
      rotationMaxGames,
      rotationAdvanceWindowGames,
      rotationEvaluationIntervalMinutes,
      showsDuration,
      durationMinutes,
      showsBlitzModes,
      selectedBlitzPlayStyleLabel:
        blitzPlayStyleOptions.find((playStyle) => playStyle.id === selectedBlitzPlayStyleId)?.label ?? null,
    }),
    launchBasicsTitle: resolveLaunchBasicsTitle({ isSeriesLaunch, isRotationLaunch }),
    launchBasicsDescription: resolveLaunchBasicsDescription({ isSeriesLaunch, isRotationLaunch }),
    timingHelperText: resolveLaunchTimingHelperText({ isSeriesLaunch, isRotationLaunch }),
  };
}

const FactoryV2StartWorkspaceEmptyState = ({ appearanceClassName }: { appearanceClassName: string }) => (
  <article className="w-full md:mx-auto md:max-w-xl">
    <div className={cn("px-4 py-5 md:rounded-[28px] md:border md:p-7", appearanceClassName)}>
      <div className="text-sm leading-6 text-gold/58">Pick a preset first.</div>
    </div>
  </article>
);

const FactoryV2ConfiguredStartWorkspace = ({
  mode,
  launchTargetKind,
  presets,
  selectedPreset,
  gameName,
  seriesName,
  rotationName,
  startAt,
  durationMinutes,
  seriesGameCount,
  seriesGames,
  rotationPreviewGames,
  rotationGameIntervalMinutes,
  rotationMaxGames,
  rotationAdvanceWindowGames,
  rotationEvaluationIntervalMinutes,
  autoRetryIntervalMinutes,
  showsDuration,
  durationOptions,
  twoPlayerMode,
  singleRealmMode,
  devModeOn,
  seriesSuggestions,
  isLoadingSeries,
  seriesLookupError,
  existingRunName,
  notice,
  moreOptionSections,
  moreOptionDraft,
  moreOptionErrors,
  moreOptionsDisabledReason,
  biomeClimateDraft,
  biomeClimateErrors,
  biomeClimateTargets,
  selectedBiomeClimateTargetId,
  biomeClimateDisabledReason,
  onSelectLaunchTargetKind,
  onSelectPreset,
  onGameNameChange,
  onSeriesNameChange,
  onRotationNameChange,
  onStartAtChange,
  onDurationChange,
  onSeriesGameCountChange,
  onSeriesGameNameChange,
  onSeriesGameStartAtChange,
  onRotationGameIntervalMinutesChange,
  onRotationMaxGamesChange,
  onRotationAdvanceWindowGamesChange,
  onRotationEvaluationIntervalChange,
  onAutoRetryIntervalChange,
  onSelectSeriesSuggestion,
  onMapOptionValueChange,
  onSelectBiomeClimateTarget,
  onBiomeClimateValueChange,
  onRandomizeBiomeClimateSeeds,
  onResetBiomeClimate,
  onApplyBiomeClimateToAll,
  onToggleTwoPlayerMode,
  onToggleSingleRealmMode,
  onToggleDevMode,
  onFandomizeGameName,
  chain,
  environmentLabel,
  onLaunch,
  appearance,
  workspace,
}: FactoryV2ConfiguredStartWorkspaceProps) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const maxPlayersField = getFactoryMoreOptionField(mode, "maxPlayers", { twoPlayerMode });

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
          <FactoryV2LaunchSetupSection
            mode={mode}
            selectedPreset={selectedPreset}
            presets={presets}
            workspace={workspace}
            gameName={gameName}
            seriesName={seriesName}
            rotationName={rotationName}
            startAt={startAt}
            seriesGameCount={seriesGameCount}
            rotationGameIntervalMinutes={rotationGameIntervalMinutes}
            rotationMaxGames={rotationMaxGames}
            rotationAdvanceWindowGames={rotationAdvanceWindowGames}
            rotationEvaluationIntervalMinutes={rotationEvaluationIntervalMinutes}
            autoRetryIntervalMinutes={autoRetryIntervalMinutes}
            seriesSuggestions={seriesSuggestions}
            isLoadingSeries={isLoadingSeries}
            seriesLookupError={seriesLookupError}
            existingRunName={existingRunName}
            notice={notice}
            appearanceClassName={appearance.listItemClassName}
            cardAppearanceClassName={appearance.quietSurfaceClassName}
            onSelectPreset={onSelectPreset}
            onGameNameChange={onGameNameChange}
            onSeriesNameChange={onSeriesNameChange}
            onRotationNameChange={onRotationNameChange}
            onStartAtChange={onStartAtChange}
            onSeriesGameCountChange={onSeriesGameCountChange}
            onRotationGameIntervalMinutesChange={onRotationGameIntervalMinutesChange}
            onRotationMaxGamesChange={onRotationMaxGamesChange}
            onRotationAdvanceWindowGamesChange={onRotationAdvanceWindowGamesChange}
            onRotationEvaluationIntervalChange={onRotationEvaluationIntervalChange}
            onAutoRetryIntervalChange={onAutoRetryIntervalChange}
            onSelectSeriesSuggestion={onSelectSeriesSuggestion}
            onFandomizeGameName={onFandomizeGameName}
          />

          {workspace.isSeriesLaunch ? (
            <FactoryV2SeriesGamesSection
              games={seriesGames}
              appearanceClassName={appearance.quietSurfaceClassName}
              onSeriesGameNameChange={onSeriesGameNameChange}
              onSeriesGameStartAtChange={onSeriesGameStartAtChange}
            />
          ) : null}

          {workspace.isRotationLaunch ? (
            <FactoryV2RotationPreviewSection
              games={rotationPreviewGames}
              appearanceClassName={appearance.quietSurfaceClassName}
            />
          ) : null}

          <FactoryV2StartAdvanced
            isOpen={isAdvancedOpen}
            launchTargetKind={launchTargetKind}
            showsDuration={showsDuration}
            durationMinutes={durationMinutes}
            durationOptions={durationOptions}
            showsBlitzModes={workspace.showsBlitzModes}
            maxPlayersField={maxPlayersField}
            blitzPlayStyleOptions={workspace.blitzPlayStyleOptions}
            selectedBlitzPlayStyleId={workspace.selectedBlitzPlayStyleId}
            devModeOn={devModeOn}
            moreOptionSections={moreOptionSections}
            moreOptionDraft={moreOptionDraft}
            moreOptionErrors={moreOptionErrors}
            moreOptionsDisabledReason={moreOptionsDisabledReason}
            biomeClimateDraft={biomeClimateDraft}
            biomeClimateErrors={biomeClimateErrors}
            biomeClimateTargets={biomeClimateTargets}
            selectedBiomeClimateTargetId={selectedBiomeClimateTargetId}
            biomeClimateDisabledReason={biomeClimateDisabledReason}
            appearance={appearance}
            onToggle={() => setIsAdvancedOpen((currentValue) => !currentValue)}
            onSelectLaunchTargetKind={onSelectLaunchTargetKind}
            onDurationChange={onDurationChange}
            onSelectBlitzPlayStyle={selectBlitzPlayStyle}
            onToggleDevMode={onToggleDevMode}
            onMapOptionValueChange={onMapOptionValueChange}
            onSelectBiomeClimateTarget={onSelectBiomeClimateTarget}
            onBiomeClimateValueChange={onBiomeClimateValueChange}
            onRandomizeBiomeClimateSeeds={onRandomizeBiomeClimateSeeds}
            onResetBiomeClimate={onResetBiomeClimate}
            onApplyBiomeClimateToAll={onApplyBiomeClimateToAll}
          />

          <FactoryV2DeployerWalletCard chain={chain} environmentLabel={environmentLabel} />

          <FactoryV2LaunchActionBar
            launchSummaryItems={workspace.launchSummaryItems}
            launchLabel={workspace.launchLabel}
            canLaunch={workspace.canLaunch}
            appearanceClassName={appearance.quietSurfaceClassName}
            buttonClassName={workspace.launchButtonClassName}
            onLaunch={onLaunch}
          />
        </div>
      </div>
    </article>
  );
};

const FactoryV2LaunchSetupSection = ({
  mode,
  selectedPreset,
  presets,
  workspace,
  gameName,
  seriesName,
  rotationName,
  startAt,
  seriesGameCount,
  rotationGameIntervalMinutes,
  rotationMaxGames,
  rotationAdvanceWindowGames,
  rotationEvaluationIntervalMinutes,
  autoRetryIntervalMinutes,
  seriesSuggestions,
  isLoadingSeries,
  seriesLookupError,
  existingRunName,
  notice,
  appearanceClassName,
  cardAppearanceClassName,
  onSelectPreset,
  onGameNameChange,
  onSeriesNameChange,
  onRotationNameChange,
  onStartAtChange,
  onSeriesGameCountChange,
  onRotationGameIntervalMinutesChange,
  onRotationMaxGamesChange,
  onRotationAdvanceWindowGamesChange,
  onRotationEvaluationIntervalChange,
  onAutoRetryIntervalChange,
  onSelectSeriesSuggestion,
  onFandomizeGameName,
}: {
  mode: FactoryGameMode;
  selectedPreset: FactoryLaunchPreset;
  presets: FactoryLaunchPreset[];
  workspace: FactoryV2StartWorkspaceState;
  gameName: string;
  seriesName: string;
  rotationName: string;
  startAt: string;
  seriesGameCount: number;
  rotationGameIntervalMinutes: number;
  rotationMaxGames: number;
  rotationAdvanceWindowGames: number;
  rotationEvaluationIntervalMinutes: FactoryRotationEvaluationIntervalMinutes;
  autoRetryIntervalMinutes: FactorySeriesRetryIntervalMinutes;
  seriesSuggestions: FactoryV2StartWorkspaceProps["seriesSuggestions"];
  isLoadingSeries: boolean;
  seriesLookupError: string | null;
  existingRunName: string | null;
  notice: string | null;
  appearanceClassName: string;
  cardAppearanceClassName: string;
  onSelectPreset: (presetId: string) => void;
  onGameNameChange: (value: string) => void;
  onSeriesNameChange: (value: string) => void;
  onRotationNameChange: (value: string) => void;
  onStartAtChange: (value: string) => void;
  onSeriesGameCountChange: (value: number) => void;
  onRotationGameIntervalMinutesChange: (value: number) => void;
  onRotationMaxGamesChange: (value: number) => void;
  onRotationAdvanceWindowGamesChange: (value: number) => void;
  onRotationEvaluationIntervalChange: (value: FactoryRotationEvaluationIntervalMinutes) => void;
  onAutoRetryIntervalChange: (value: FactorySeriesRetryIntervalMinutes) => void;
  onSelectSeriesSuggestion: (seriesName: string) => void;
  onFandomizeGameName: () => void;
}) => (
  <FactoryV2StartSectionCard
    title={workspace.launchBasicsTitle}
    description={workspace.launchBasicsDescription}
    appearanceClassName={cardAppearanceClassName}
  >
    <FactoryV2PresetField
      selectedPreset={selectedPreset}
      presets={presets}
      presetFacts={workspace.presetFacts}
      appearanceClassName={appearanceClassName}
      onSelectPreset={onSelectPreset}
    />

    {workspace.isSeriesLaunch ? (
      <FactoryV2SeriesBasics
        mode={mode}
        appearanceClassName={appearanceClassName}
        seriesName={seriesName}
        seriesGameCount={seriesGameCount}
        autoRetryIntervalMinutes={autoRetryIntervalMinutes}
        seriesSuggestions={seriesSuggestions}
        isLoadingSeries={isLoadingSeries}
        seriesLookupError={seriesLookupError}
        existingRunName={existingRunName}
        notice={notice}
        onSeriesNameChange={onSeriesNameChange}
        onSeriesGameCountChange={onSeriesGameCountChange}
        onAutoRetryIntervalChange={onAutoRetryIntervalChange}
        onSelectSeriesSuggestion={onSelectSeriesSuggestion}
      />
    ) : workspace.isRotationLaunch ? (
      <FactoryV2RotationBasics
        mode={mode}
        appearanceClassName={appearanceClassName}
        rotationName={rotationName}
        rotationGameIntervalMinutes={rotationGameIntervalMinutes}
        rotationMaxGames={rotationMaxGames}
        rotationAdvanceWindowGames={rotationAdvanceWindowGames}
        rotationEvaluationIntervalMinutes={rotationEvaluationIntervalMinutes}
        autoRetryIntervalMinutes={autoRetryIntervalMinutes}
        existingRunName={existingRunName}
        notice={notice}
        onRotationNameChange={onRotationNameChange}
        onRotationGameIntervalMinutesChange={onRotationGameIntervalMinutesChange}
        onRotationMaxGamesChange={onRotationMaxGamesChange}
        onRotationAdvanceWindowGamesChange={onRotationAdvanceWindowGamesChange}
        onRotationEvaluationIntervalChange={onRotationEvaluationIntervalChange}
        onAutoRetryIntervalChange={onAutoRetryIntervalChange}
      />
    ) : (
      <FactoryV2SingleGameBasics
        mode={mode}
        gameName={gameName}
        existingRunName={existingRunName}
        notice={notice}
        buttonClassName={appearanceClassName}
        onGameNameChange={onGameNameChange}
        onFandomizeGameName={onFandomizeGameName}
      />
    )}

    <div data-testid="factory-launch-timing" className="space-y-4">
      <FactoryV2StartTimeField startAt={startAt} helperText={workspace.timingHelperText} onChange={onStartAtChange} />
    </div>
  </FactoryV2StartSectionCard>
);

const FactoryV2PresetField = ({
  selectedPreset,
  presets,
  presetFacts,
  appearanceClassName,
  onSelectPreset,
}: {
  selectedPreset: FactoryLaunchPreset;
  presets: FactoryLaunchPreset[];
  presetFacts: string;
  appearanceClassName: string;
  onSelectPreset: (presetId: string) => void;
}) => (
  <div className="min-w-0">
    <label
      htmlFor="factory-preset"
      className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42"
    >
      Preset
    </label>
    <div className="relative mt-2">
      <select
        id="factory-preset"
        value={selectedPreset.id}
        onChange={(event) => onSelectPreset(event.target.value)}
        className={cn(FACTORY_SELECT_CONTROL_CLASS_NAME, appearanceClassName)}
      >
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/45" />
    </div>
    <p className="mt-3 text-sm leading-6 text-gold/48">{selectedPreset.description}</p>
    {presetFacts ? <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-gold/40">{presetFacts}</p> : null}
  </div>
);

const FactoryV2SingleGameBasics = ({
  mode,
  gameName,
  existingRunName,
  notice,
  buttonClassName,
  onGameNameChange,
  onFandomizeGameName,
}: {
  mode: FactoryGameMode;
  gameName: string;
  existingRunName: string | null;
  notice: string | null;
  buttonClassName: string;
  onGameNameChange: (value: string) => void;
  onFandomizeGameName: () => void;
}) => (
  <div className="min-w-0">
    <div className="flex items-center justify-between gap-3">
      <label htmlFor="factory-game-name" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42">
        Game name
      </label>
      <button
        type="button"
        onClick={onFandomizeGameName}
        aria-label="Fandomize game name"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
          buttonClassName,
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
      className={`${FACTORY_FIELD_CONTROL_CLASS_NAME} placeholder:text-gold/30`}
    />
    {existingRunName ? (
      <p className="mt-2 text-sm leading-6 text-gold/50">That name is already in use. We will open that run instead.</p>
    ) : null}
    {!existingRunName && notice ? <p className="mt-2 text-sm leading-6 text-gold/50">{notice}</p> : null}
  </div>
);

const FactoryV2SeriesGamesSection = ({
  games,
  appearanceClassName,
  onSeriesGameNameChange,
  onSeriesGameStartAtChange,
}: {
  games: FactorySeriesGameDraft[];
  appearanceClassName: string;
  onSeriesGameNameChange: (gameId: string, value: string) => void;
  onSeriesGameStartAtChange: (gameId: string, value: string) => void;
}) => (
  <FactoryV2StartSectionCard
    title="Series games"
    description="Each row gets its own game name and start time, while the rest of the config stays shared."
    appearanceClassName={appearanceClassName}
  >
    <div className="space-y-3">
      {games.map((game) => (
        <FactoryV2SeriesGameRow
          key={game.id}
          game={game}
          onGameNameChange={onSeriesGameNameChange}
          onStartAtChange={onSeriesGameStartAtChange}
        />
      ))}
    </div>
  </FactoryV2StartSectionCard>
);

const FactoryV2RotationPreviewSection = ({
  games,
  appearanceClassName,
}: {
  games: FactoryRotationPreviewGame[];
  appearanceClassName: string;
}) => (
  <FactoryV2StartSectionCard
    title="Rotation preview"
    description="This is the next queue the worker will keep filled. Later games are generated automatically from the same cadence."
    appearanceClassName={appearanceClassName}
  >
    <div className="space-y-3">
      {games.map((game) => (
        <FactoryV2RotationPreviewRow key={game.id} game={game} />
      ))}
    </div>
  </FactoryV2StartSectionCard>
);

function resolveLaunchReadiness({
  isSeriesLaunch,
  isRotationLaunch,
  gameName,
  seriesName,
  seriesGames,
  rotationName,
  startAt,
  rotationGameIntervalMinutes,
  rotationMaxGames,
  rotationAdvanceWindowGames,
}: {
  isSeriesLaunch: boolean;
  isRotationLaunch: boolean;
  gameName: string;
  seriesName: string;
  seriesGames: FactorySeriesGameDraft[];
  rotationName: string;
  startAt: string;
  rotationGameIntervalMinutes: number;
  rotationMaxGames: number;
  rotationAdvanceWindowGames: number;
}) {
  if (isSeriesLaunch) {
    return (
      seriesName.trim().length > 0 &&
      seriesGames.length > 0 &&
      seriesGames.every((game) => game.gameName.trim().length > 0 && game.startAt.trim().length > 0)
    );
  }

  if (isRotationLaunch) {
    return (
      rotationName.trim().length > 0 &&
      startAt.trim().length > 0 &&
      rotationGameIntervalMinutes > 0 &&
      rotationMaxGames > 0 &&
      rotationAdvanceWindowGames > 0
    );
  }

  return gameName.trim().length > 0;
}

function resolveLaunchLabel({
  isSeriesLaunch,
  isRotationLaunch,
  environmentLabel,
  modeLabel,
  seriesGameCount,
}: {
  isSeriesLaunch: boolean;
  isRotationLaunch: boolean;
  environmentLabel: string;
  modeLabel: string;
  seriesGameCount: number;
}) {
  if (isSeriesLaunch) {
    return `Launch ${seriesGameCount}-game series on ${environmentLabel}`;
  }

  if (isRotationLaunch) {
    return `Start rotation on ${environmentLabel}`;
  }

  return `Launch ${modeLabel} on ${environmentLabel}`;
}

function resolveLaunchSummaryItems({
  isSeriesLaunch,
  isRotationLaunch,
  presetName,
  environmentLabel,
  seriesGameCount,
  autoRetryIntervalMinutes,
  rotationMaxGames,
  rotationAdvanceWindowGames,
  rotationEvaluationIntervalMinutes,
  showsDuration,
  durationMinutes,
  showsBlitzModes,
  selectedBlitzPlayStyleLabel,
}: {
  isSeriesLaunch: boolean;
  isRotationLaunch: boolean;
  presetName: string;
  environmentLabel: string;
  seriesGameCount: number;
  autoRetryIntervalMinutes: FactorySeriesRetryIntervalMinutes;
  rotationMaxGames: number;
  rotationAdvanceWindowGames: number;
  rotationEvaluationIntervalMinutes: FactoryRotationEvaluationIntervalMinutes;
  showsDuration: boolean;
  durationMinutes: number | null;
  showsBlitzModes: boolean;
  selectedBlitzPlayStyleLabel: string | null;
}) {
  if (isSeriesLaunch) {
    return [presetName, environmentLabel, `${seriesGameCount} games`, `Retry ${autoRetryIntervalMinutes}m`];
  }

  if (isRotationLaunch) {
    return [
      presetName,
      environmentLabel,
      `Max ${rotationMaxGames}`,
      `Ahead ${rotationAdvanceWindowGames}`,
      `Evaluate ${rotationEvaluationIntervalMinutes}m`,
      `Retry ${autoRetryIntervalMinutes}m`,
    ];
  }

  return [
    presetName,
    environmentLabel,
    showsDuration && durationMinutes !== null ? formatFactoryDurationLabel(durationMinutes) : null,
    showsBlitzModes ? selectedBlitzPlayStyleLabel : null,
  ].filter(Boolean) as string[];
}

function resolveLaunchBasicsTitle({
  isSeriesLaunch,
  isRotationLaunch,
}: {
  isSeriesLaunch: boolean;
  isRotationLaunch: boolean;
}) {
  if (isSeriesLaunch) {
    return "Series basics";
  }

  if (isRotationLaunch) {
    return "Rotation basics";
  }

  return "Launch basics";
}

function resolveLaunchBasicsDescription({
  isSeriesLaunch,
  isRotationLaunch,
}: {
  isSeriesLaunch: boolean;
  isRotationLaunch: boolean;
}) {
  if (isSeriesLaunch) {
    return "Set the shared launch template, then edit the generated games below.";
  }

  if (isRotationLaunch) {
    return "Set the shared launch template, then let rotation rules decide how many future games stay queued.";
  }

  return "Choose the preset, name, and timing for this game.";
}

function resolveLaunchTimingHelperText({
  isSeriesLaunch,
  isRotationLaunch,
}: {
  isSeriesLaunch: boolean;
  isRotationLaunch: boolean;
}) {
  if (isSeriesLaunch) {
    return "Choose the shared starting point. You can fine-tune each generated game below.";
  }

  if (isRotationLaunch) {
    return "Choose when the first rotation game should begin. Later games follow the interval below.";
  }

  return "Choose the day and local time when this game should begin.";
}

const FactoryV2SeriesBasics = ({
  mode,
  appearanceClassName,
  seriesName,
  seriesGameCount,
  autoRetryIntervalMinutes,
  seriesSuggestions,
  isLoadingSeries,
  seriesLookupError,
  existingRunName,
  notice,
  onSeriesNameChange,
  onSeriesGameCountChange,
  onAutoRetryIntervalChange,
  onSelectSeriesSuggestion,
}: {
  mode: FactoryGameMode;
  appearanceClassName: string;
  seriesName: string;
  seriesGameCount: number;
  autoRetryIntervalMinutes: FactorySeriesRetryIntervalMinutes;
  seriesSuggestions: Array<{
    name: string;
    lastGameNumber: number | null;
    nextGameNumber: number;
  }>;
  isLoadingSeries: boolean;
  seriesLookupError: string | null;
  existingRunName: string | null;
  notice: string | null;
  onSeriesNameChange: (value: string) => void;
  onSeriesGameCountChange: (value: number) => void;
  onAutoRetryIntervalChange: (value: FactorySeriesRetryIntervalMinutes) => void;
  onSelectSeriesSuggestion: (seriesName: string) => void;
}) => (
  <div className="space-y-4">
    <div className="min-w-0">
      <label
        htmlFor="factory-series-name"
        className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42"
      >
        Series name
      </label>
      <input
        id="factory-series-name"
        value={seriesName}
        onChange={(event) => onSeriesNameChange(event.target.value)}
        placeholder={mode === "eternum" ? "etrn-season-run" : "bltz-weekend-cup"}
        className={`${FACTORY_FIELD_CONTROL_CLASS_NAME} placeholder:text-gold/30`}
      />
      {seriesSuggestions.length > 0 ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {seriesSuggestions.slice(0, 6).map((series) => (
            <button
              key={series.name}
              type="button"
              onClick={() => onSelectSeriesSuggestion(series.name)}
              className="rounded-full border border-gold/15 bg-black/25 px-3 py-1 text-[11px] font-medium text-gold/58 transition-colors hover:bg-gold/10"
            >
              {series.name} · next {series.nextGameNumber}
            </button>
          ))}
        </div>
      ) : null}
      {isLoadingSeries ? <p className="mt-2 text-sm leading-6 text-gold/50">Loading your series…</p> : null}
      {!isLoadingSeries && seriesLookupError ? (
        <p className="mt-2 text-sm leading-6 text-gold/50">{seriesLookupError}</p>
      ) : null}
      {existingRunName ? (
        <p className="mt-2 text-sm leading-6 text-gold/50">
          This series already has a parent run. Launching again will append any new games and resume that shared run.
        </p>
      ) : null}
      {notice ? <p className="mt-2 text-sm leading-6 text-gold/50">{notice}</p> : null}
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0">
        <label
          htmlFor="factory-series-count"
          className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42"
        >
          Game count
        </label>
        <input
          id="factory-series-count"
          type="number"
          min={1}
          max={12}
          value={seriesGameCount}
          onChange={(event) => onSeriesGameCountChange(Number(event.target.value))}
          className={`${FACTORY_FIELD_CONTROL_CLASS_NAME} text-center font-medium`}
        />
      </div>
      <div className="min-w-0">
        <label
          htmlFor="factory-series-retry-interval"
          className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42"
        >
          Retry interval
        </label>
        <div className="relative mt-2">
          <select
            id="factory-series-retry-interval"
            value={String(autoRetryIntervalMinutes)}
            onChange={(event) =>
              onAutoRetryIntervalChange(Number(event.target.value) as FactorySeriesRetryIntervalMinutes)
            }
            className={cn(FACTORY_SELECT_CONTROL_CLASS_NAME, appearanceClassName)}
          >
            {FACTORY_SERIES_RETRY_OPTIONS.map((intervalMinutes) => (
              <option key={intervalMinutes} value={intervalMinutes}>
                Every {intervalMinutes} minutes
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/45" />
        </div>
      </div>
    </div>

    <FactoryV2ScheduleMeaningList
      items={[
        {
          label: "Retry interval",
          description:
            "Only used after a failed step. This is how long the launcher waits before trying that game again.",
        },
      ]}
    />
  </div>
);

const FactoryV2RotationBasics = ({
  mode,
  appearanceClassName,
  rotationName,
  rotationGameIntervalMinutes,
  rotationMaxGames,
  rotationAdvanceWindowGames,
  rotationEvaluationIntervalMinutes,
  autoRetryIntervalMinutes,
  existingRunName,
  notice,
  onRotationNameChange,
  onRotationGameIntervalMinutesChange,
  onRotationMaxGamesChange,
  onRotationAdvanceWindowGamesChange,
  onRotationEvaluationIntervalChange,
  onAutoRetryIntervalChange,
}: {
  mode: FactoryGameMode;
  appearanceClassName: string;
  rotationName: string;
  rotationGameIntervalMinutes: number;
  rotationMaxGames: number;
  rotationAdvanceWindowGames: number;
  rotationEvaluationIntervalMinutes: FactoryRotationEvaluationIntervalMinutes;
  autoRetryIntervalMinutes: FactorySeriesRetryIntervalMinutes;
  existingRunName: string | null;
  notice: string | null;
  onRotationNameChange: (value: string) => void;
  onRotationGameIntervalMinutesChange: (value: number) => void;
  onRotationMaxGamesChange: (value: number) => void;
  onRotationAdvanceWindowGamesChange: (value: number) => void;
  onRotationEvaluationIntervalChange: (value: FactoryRotationEvaluationIntervalMinutes) => void;
  onAutoRetryIntervalChange: (value: FactorySeriesRetryIntervalMinutes) => void;
}) => (
  <div className="space-y-4">
    <div className="min-w-0">
      <label
        htmlFor="factory-rotation-name"
        className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42"
      >
        Rotation name
      </label>
      <input
        id="factory-rotation-name"
        value={rotationName}
        onChange={(event) => onRotationNameChange(event.target.value)}
        placeholder={mode === "eternum" ? "etrn-hourly-rotation" : "bltz-ladder-loop"}
        className={`${FACTORY_FIELD_CONTROL_CLASS_NAME} placeholder:text-gold/30`}
      />
      {existingRunName ? (
        <p className="mt-2 text-sm leading-6 text-gold/50">
          This rotation already exists. Open it from Watch to continue it or run it now.
        </p>
      ) : null}
      {!existingRunName && notice ? <p className="mt-2 text-sm leading-6 text-gold/50">{notice}</p> : null}
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <FactoryV2NumberField
        inputId="factory-rotation-max-games"
        label="Max games"
        min={1}
        value={rotationMaxGames}
        onChange={onRotationMaxGamesChange}
      />
      <FactoryV2NumberField
        inputId="factory-rotation-advance-window"
        label="Keep ahead"
        min={1}
        max={5}
        value={rotationAdvanceWindowGames}
        onChange={onRotationAdvanceWindowGamesChange}
      />
      <FactoryV2NumberField
        inputId="factory-rotation-game-interval"
        label="Game interval"
        min={1}
        value={rotationGameIntervalMinutes}
        suffix="minutes"
        onChange={onRotationGameIntervalMinutesChange}
      />
      <FactoryV2SelectField
        inputId="factory-rotation-evaluation-interval"
        label="Evaluate every"
        value={String(rotationEvaluationIntervalMinutes)}
        appearanceClassName={appearanceClassName}
        onChange={(value) =>
          onRotationEvaluationIntervalChange(Number(value) as FactoryRotationEvaluationIntervalMinutes)
        }
      >
        {FACTORY_ROTATION_EVALUATION_OPTIONS.map((intervalMinutes) => (
          <option key={intervalMinutes} value={intervalMinutes}>
            Every {intervalMinutes} minutes
          </option>
        ))}
      </FactoryV2SelectField>
      <FactoryV2SelectField
        inputId="factory-rotation-retry-interval"
        label="Retry interval"
        value={String(autoRetryIntervalMinutes)}
        appearanceClassName={appearanceClassName}
        onChange={(value) => onAutoRetryIntervalChange(Number(value) as FactorySeriesRetryIntervalMinutes)}
      >
        {FACTORY_SERIES_RETRY_OPTIONS.map((intervalMinutes) => (
          <option key={intervalMinutes} value={intervalMinutes}>
            Every {intervalMinutes} minutes
          </option>
        ))}
      </FactoryV2SelectField>
    </div>

    <FactoryV2ScheduleMeaningList
      items={[
        {
          label: "Evaluate every",
          description: "How often the rotation checks whether it needs to queue more games ahead.",
        },
        {
          label: "Retry interval",
          description:
            "Only used after a failed step. This is how long the launcher waits before trying that game again.",
        },
      ]}
    />
  </div>
);

const FactoryV2SeriesGameRow = ({
  game,
  onGameNameChange,
  onStartAtChange,
}: {
  game: FactorySeriesGameDraft;
  onGameNameChange: (gameId: string, value: string) => void;
  onStartAtChange: (gameId: string, value: string) => void;
}) => {
  const startDate = resolveFactoryStartDatePart(game.startAt);
  const startTime = resolveFactoryStartTimePart(game.startAt);

  return (
    <div className="rounded-[20px] border border-gold/10 bg-black/20 p-3 shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42">
          Game {game.seriesGameNumber}
        </div>
        <div className="rounded-full border border-gold/10 bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/46">
          Series
        </div>
      </div>
      <div className="space-y-3">
        <div className="min-w-0">
          <label
            htmlFor={`factory-series-game-name-${game.id}`}
            className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/38"
          >
            Game name
          </label>
          <input
            id={`factory-series-game-name-${game.id}`}
            value={game.gameName}
            onChange={(event) => onGameNameChange(game.id, event.target.value)}
            className={`${FACTORY_FIELD_CONTROL_CLASS_NAME} mt-2 placeholder:text-gold/30`}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <FactoryV2NativePickerField
            inputId={`factory-series-start-date-${game.id}`}
            label="Date"
            type="date"
            value={startDate}
            displayValue={formatFactoryStartDateLabel(startDate)}
            icon={<CalendarDays className="h-4 w-4 text-gold/36" />}
            displayTestId={`factory-series-start-date-display-${game.id}`}
            onChange={(value) => onStartAtChange(game.id, buildFactoryStartAtValue(value, startTime, game.startAt))}
          />
          <FactoryV2NativePickerField
            inputId={`factory-series-start-time-${game.id}`}
            label="Time"
            type="time"
            value={startTime}
            displayValue={formatFactoryStartTimeLabel(startTime)}
            icon={<Clock3 className="h-4 w-4 text-gold/36" />}
            displayTestId={`factory-series-start-time-display-${game.id}`}
            onChange={(value) => onStartAtChange(game.id, buildFactoryStartAtValue(startDate, value, game.startAt))}
          />
        </div>
      </div>
    </div>
  );
};

const FactoryV2RotationPreviewRow = ({ game }: { game: FactoryRotationPreviewGame }) => {
  const startDate = resolveFactoryStartDatePart(game.startAt);
  const startTime = resolveFactoryStartTimePart(game.startAt);

  return (
    <div className="rounded-[20px] border border-gold/10 bg-black/20 p-3 shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42">
          Game {game.seriesGameNumber}
        </div>
        <div className="rounded-full border border-gold/10 bg-black/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/46">
          Rotation
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-[13px] font-semibold text-gold">{game.gameName}</div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-gold/50">
          <span>{formatFactoryStartDateLabel(startDate)}</span>
          <span className="text-gold/28">·</span>
          <span>{formatFactoryStartTimeLabel(startTime)}</span>
        </div>
      </div>
    </div>
  );
};

const FactoryV2StartTimeField = ({
  startAt,
  helperText,
  onChange,
}: {
  startAt: string;
  helperText: string;
  onChange: (value: string) => void;
}) => {
  const startDate = resolveFactoryStartDatePart(startAt);
  const startTime = resolveFactoryStartTimePart(startAt);

  return (
    <div className="min-w-0 space-y-2">
      <div className="space-y-1 sm:flex sm:items-end sm:justify-between sm:gap-3 sm:space-y-0">
        <label
          htmlFor="factory-start-date"
          className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42"
        >
          Start time
        </label>
        <span className="text-[11px] leading-5 text-gold/38">Your local time</span>
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <FactoryV2NativePickerField
          inputId="factory-start-date"
          label="Date"
          type="date"
          value={startDate}
          displayValue={formatFactoryStartDateLabel(startDate)}
          icon={<CalendarDays className="h-4 w-4 text-gold/36" />}
          displayTestId="factory-start-date-display"
          onChange={(value) => onChange(buildFactoryStartAtValue(value, startTime, startAt))}
        />
        <FactoryV2NativePickerField
          inputId="factory-start-time"
          label="Time"
          type="time"
          value={startTime}
          displayValue={formatFactoryStartTimeLabel(startTime)}
          icon={<Clock3 className="h-4 w-4 text-gold/36" />}
          displayTestId="factory-start-time-display"
          onChange={(value) => onChange(buildFactoryStartAtValue(startDate, value, startAt))}
        />
      </div>
      <p className="mt-2 text-sm leading-6 text-gold/48">{helperText}</p>
    </div>
  );
};

const FactoryV2NumberField = ({
  inputId,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  inputId: string;
  label: string;
  value: number;
  min: number;
  max?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) => (
  <div className="min-w-0">
    <label htmlFor={inputId} className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42">
      {label}
    </label>
    <div className="relative mt-2">
      <input
        id={inputId}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`${FACTORY_FIELD_CONTROL_CLASS_NAME} text-center font-medium`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-[0.12em] text-gold/36">
          {suffix}
        </span>
      ) : null}
    </div>
  </div>
);

const FactoryV2SelectField = ({
  inputId,
  label,
  value,
  appearanceClassName,
  children,
  onChange,
}: {
  inputId: string;
  label: string;
  value: string;
  appearanceClassName: string;
  children: ReactNode;
  onChange: (value: string) => void;
}) => (
  <div className="min-w-0">
    <label htmlFor={inputId} className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42">
      {label}
    </label>
    <div className="relative mt-2">
      <select
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FACTORY_SELECT_CONTROL_CLASS_NAME, appearanceClassName)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/45" />
    </div>
  </div>
);

const FactoryV2ScheduleMeaningList = ({
  items,
}: {
  items: Array<{
    label: string;
    description: string;
  }>;
}) => (
  <div className="space-y-2 rounded-[20px] border border-gold/10 bg-black/20 px-4 py-3">
    {items.map((item) => (
      <FactoryV2ScheduleMeaningItem key={item.label} label={item.label} description={item.description} />
    ))}
  </div>
);

const FactoryV2ScheduleMeaningItem = ({ label, description }: { label: string; description: string }) => (
  <div className="flex items-start gap-3 text-left">
    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/15 bg-black/25 text-gold/42">
      <Info className="h-3.5 w-3.5" />
    </span>
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold/42">{label}</div>
      <p className="mt-1 text-[13px] leading-5 text-gold/54">{description}</p>
    </div>
  </div>
);

const FactoryV2NativePickerField = ({
  inputId,
  label,
  type,
  value,
  displayValue,
  icon,
  displayTestId,
  onChange,
}: {
  inputId: string;
  label: string;
  type: "date" | "time";
  value: string;
  displayValue: string;
  icon: ReactNode;
  displayTestId: string;
  onChange: (value: string) => void;
}) => (
  <label className={FACTORY_SCHEDULE_PANEL_CLASS_NAME}>
    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/38">{label}</span>
    <div className="relative min-w-0">
      <div data-testid={displayTestId} className={FACTORY_SCHEDULE_VALUE_SURFACE_CLASS_NAME}>
        {icon}
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-gold/72">{displayValue}</span>
      </div>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FACTORY_NATIVE_PICKER_INPUT_CLASS_NAME}
      />
    </div>
  </label>
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
      "sticky bottom-3 z-10 space-y-3 rounded-[24px] border border-gold/15 px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-4 text-left shadow-[0_18px_42px_rgba(0,0,0,0.22)] backdrop-blur-xl md:static md:rounded-[22px] md:border-gold/10 md:px-4 md:py-4 md:shadow-none md:backdrop-blur-0",
      appearanceClassName,
    )}
  >
    <div className="flex flex-wrap justify-center gap-2">
      {launchSummaryItems.map((item) => (
        <span
          key={item}
          className="rounded-full border border-gold/15 bg-black/25 px-3 py-1 text-[11px] font-medium text-gold/56"
        >
          {item}
        </span>
      ))}
    </div>

    <button
      type="button"
      data-testid="factory-launch-button"
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
