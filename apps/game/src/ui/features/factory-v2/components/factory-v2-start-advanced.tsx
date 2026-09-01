import { cn } from "@/ui/design-system/atoms/lib/utils";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import {
  listFactoryBiomeClimateFields,
  type FactoryBiomeClimateDraft,
  type FactoryBiomeClimateErrors,
  type FactoryBiomeClimateFieldId,
} from "../biome-climate-options";
import type { getBlitzPlayStyleOptions, BlitzPlayStyleId } from "../launch-modes";
import type {
  FactoryMoreOptionField,
  FactoryMoreOptionSection,
  FactoryMoreOptionsDraft,
  FactoryMoreOptionsErrors,
} from "../map-options";
import type { resolveFactoryModeAppearance } from "../mode-appearance";
import { buildFactoryBiomePreviewModel } from "../../factory/shared/biome-preview";
import type { FactoryDurationOption, FactoryLaunchTargetKind } from "../types";
import { FactoryV2MoreOptions } from "./factory-v2-more-options";
import {
  FactoryV2DurationField,
  FactoryV2InlineOptionField,
  FactoryV2LaunchTargetButton,
  FactoryV2PlayStyleOption,
  FactoryV2StartSectionCard,
} from "./factory-v2-start-primitives";

/**
 * Everything the preset already decides, plus map tuning. Collapsed by
 * default so the primary path stays preset -> name -> start time -> launch.
 */
export const FactoryV2StartAdvanced = ({
  isOpen,
  launchTargetKind,
  showsDuration,
  durationMinutes,
  durationOptions,
  showsBlitzModes,
  maxPlayersField,
  blitzPlayStyleOptions,
  selectedBlitzPlayStyleId,
  moreOptionSections,
  moreOptionDraft,
  moreOptionErrors,
  moreOptionsDisabledReason,
  biomeClimateDraft,
  biomeClimateErrors,
  biomeClimateTargets,
  selectedBiomeClimateTargetId,
  biomeClimateDisabledReason,
  appearance,
  onToggle,
  onSelectLaunchTargetKind,
  onDurationChange,
  onSelectBlitzPlayStyle,
  onMapOptionValueChange,
  onSelectBiomeClimateTarget,
  onBiomeClimateValueChange,
  onRandomizeBiomeClimateSeeds,
  onResetBiomeClimate,
  onApplyBiomeClimateToAll,
}: {
  isOpen: boolean;
  launchTargetKind: FactoryLaunchTargetKind;
  showsDuration: boolean;
  durationMinutes: number | null;
  durationOptions: FactoryDurationOption[];
  showsBlitzModes: boolean;
  maxPlayersField: FactoryMoreOptionField | null;
  blitzPlayStyleOptions: ReturnType<typeof getBlitzPlayStyleOptions>;
  selectedBlitzPlayStyleId: BlitzPlayStyleId;
  moreOptionSections: FactoryMoreOptionSection[];
  moreOptionDraft: FactoryMoreOptionsDraft;
  moreOptionErrors: FactoryMoreOptionsErrors;
  moreOptionsDisabledReason: string | null;
  biomeClimateDraft: FactoryBiomeClimateDraft;
  biomeClimateErrors: FactoryBiomeClimateErrors;
  biomeClimateTargets: Array<{ id: string; label: string }>;
  selectedBiomeClimateTargetId: string;
  biomeClimateDisabledReason: string | null;
  appearance: ReturnType<typeof resolveFactoryModeAppearance>;
  onToggle: () => void;
  onSelectLaunchTargetKind: (kind: FactoryLaunchTargetKind) => void;
  onDurationChange: (value: number) => void;
  onSelectBlitzPlayStyle: (playStyleId: BlitzPlayStyleId) => void;
  onMapOptionValueChange: (fieldId: keyof FactoryMoreOptionsDraft, value: string) => void;
  onSelectBiomeClimateTarget: (targetId: string) => void;
  onBiomeClimateValueChange: (fieldId: FactoryBiomeClimateFieldId, value: string) => void;
  onRandomizeBiomeClimateSeeds: () => void;
  onResetBiomeClimate: () => void;
  onApplyBiomeClimateToAll: () => void;
}) => {
  const needsReview = Boolean(moreOptionsDisabledReason || biomeClimateDisabledReason);

  return (
    <section
      className={cn("space-y-3 rounded-[24px] border border-gold/10 text-left", appearance.quietSurfaceClassName)}
    >
      <button
        type="button"
        data-testid="factory-advanced-toggle"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42">Advanced</span>
            {needsReview ? (
              <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                Needs review
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-5 text-gold/50">
            The preset already sets these. Open only to override them for this launch.
          </p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-gold/55 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen ? (
        <div className="space-y-3 px-3 pb-3 sm:px-4 sm:pb-4">
          <FactoryV2LaunchTargetSection
            launchTargetKind={launchTargetKind}
            appearanceClassName={appearance.listItemClassName}
            buttonClassName={appearance.secondaryButtonClassName}
            onSelectLaunchTargetKind={onSelectLaunchTargetKind}
          />

          {showsDuration && durationMinutes !== null ? (
            <FactoryV2StartSectionCard
              title="Duration"
              description="Override how long this launch runs."
              appearanceClassName={appearance.listItemClassName}
            >
              <FactoryV2DurationField
                durationMinutes={durationMinutes}
                durationOptions={durationOptions}
                appearanceClassName={appearance.listItemClassName}
                onChange={onDurationChange}
              />
            </FactoryV2StartSectionCard>
          ) : null}

          {showsBlitzModes ? (
            <FactoryV2BlitzSetupSection
              maxPlayersField={maxPlayersField}
              moreOptionDraft={moreOptionDraft}
              moreOptionErrors={moreOptionErrors}
              blitzPlayStyleOptions={blitzPlayStyleOptions}
              selectedBlitzPlayStyleId={selectedBlitzPlayStyleId}
              appearanceClassName={appearance.listItemClassName}
              buttonClassName={appearance.secondaryButtonClassName}
              onMapOptionValueChange={onMapOptionValueChange}
              onSelectBlitzPlayStyle={onSelectBlitzPlayStyle}
            />
          ) : null}

          <FactoryV2StartSectionCard
            title="Map"
            description="Optional map tuning for this launch only."
            appearanceClassName={appearance.listItemClassName}
          >
            <div className="space-y-3">
              <FactoryV2BiomeClimateOptions
                draft={biomeClimateDraft}
                errors={biomeClimateErrors}
                targets={biomeClimateTargets}
                selectedTargetId={selectedBiomeClimateTargetId}
                invalidReason={biomeClimateDisabledReason}
                onSelectTarget={onSelectBiomeClimateTarget}
                onValueChange={onBiomeClimateValueChange}
                onRandomizeSeeds={onRandomizeBiomeClimateSeeds}
                onReset={onResetBiomeClimate}
                onApplyToAll={onApplyBiomeClimateToAll}
              />
              <FactoryV2MoreOptions
                sections={moreOptionSections}
                draft={moreOptionDraft}
                errors={moreOptionErrors}
                invalidReason={moreOptionsDisabledReason}
                onValueChange={onMapOptionValueChange}
              />
            </div>
          </FactoryV2StartSectionCard>
        </div>
      ) : null}
    </section>
  );
};

const FactoryV2LaunchTargetSection = ({
  launchTargetKind,
  appearanceClassName,
  buttonClassName,
  onSelectLaunchTargetKind,
}: {
  launchTargetKind: FactoryLaunchTargetKind;
  appearanceClassName: string;
  buttonClassName: string;
  onSelectLaunchTargetKind: (kind: FactoryLaunchTargetKind) => void;
}) => (
  <FactoryV2StartSectionCard
    title="Launch type"
    description="Start one game, queue a full series, or keep a rotation automatically filled."
    appearanceClassName={appearanceClassName}
  >
    <div className="grid gap-2 sm:grid-cols-3">
      <FactoryV2LaunchTargetButton
        label="Single game"
        description="One world, one launch."
        isSelected={launchTargetKind === "game"}
        appearanceClassName={buttonClassName}
        onClick={() => onSelectLaunchTargetKind("game")}
      />
      <FactoryV2LaunchTargetButton
        label="Series"
        description="One parent run for many games."
        isSelected={launchTargetKind === "series"}
        appearanceClassName={buttonClassName}
        onClick={() => onSelectLaunchTargetKind("series")}
      />
      <FactoryV2LaunchTargetButton
        label="Rotation"
        description="Keep future games queued ahead."
        isSelected={launchTargetKind === "rotation"}
        appearanceClassName={buttonClassName}
        onClick={() => onSelectLaunchTargetKind("rotation")}
      />
    </div>
  </FactoryV2StartSectionCard>
);

const FactoryV2BlitzSetupSection = ({
  maxPlayersField,
  moreOptionDraft,
  moreOptionErrors,
  blitzPlayStyleOptions,
  selectedBlitzPlayStyleId,
  appearanceClassName,
  buttonClassName,
  onMapOptionValueChange,
  onSelectBlitzPlayStyle,
}: {
  maxPlayersField: FactoryMoreOptionField | null;
  moreOptionDraft: FactoryMoreOptionsDraft;
  moreOptionErrors: FactoryMoreOptionsErrors;
  blitzPlayStyleOptions: ReturnType<typeof getBlitzPlayStyleOptions>;
  selectedBlitzPlayStyleId: BlitzPlayStyleId;
  appearanceClassName: string;
  buttonClassName: string;
  onMapOptionValueChange: (fieldId: keyof FactoryMoreOptionsDraft, value: string) => void;
  onSelectBlitzPlayStyle: (playStyleId: BlitzPlayStyleId) => void;
}) => (
  <FactoryV2StartSectionCard
    title="Blitz setup"
    description="Pick the realm spread, then adjust the multiplayer cap when needed."
    appearanceClassName={appearanceClassName}
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold/42">Play style</div>
      <p className="text-sm leading-5 text-gold/50">Choose how players and realms are arranged for this game.</p>
    </div>
    <div className="space-y-1.5">
      {blitzPlayStyleOptions.map((playStyle) => (
        <FactoryV2PlayStyleOption
          key={playStyle.id}
          label={playStyle.label}
          isEnabled={selectedBlitzPlayStyleId === playStyle.id}
          appearanceClassName={buttonClassName}
          onClick={() => onSelectBlitzPlayStyle(playStyle.id)}
        />
      ))}
    </div>
  </FactoryV2StartSectionCard>
);

const FactoryV2BiomeClimateOptions = ({
  draft,
  errors,
  targets,
  selectedTargetId,
  invalidReason,
  onSelectTarget,
  onValueChange,
  onRandomizeSeeds,
  onReset,
  onApplyToAll,
}: {
  draft: FactoryBiomeClimateDraft;
  errors: FactoryBiomeClimateErrors;
  targets: Array<{ id: string; label: string }>;
  selectedTargetId: string;
  invalidReason: string | null;
  onSelectTarget: (targetId: string) => void;
  onValueChange: (fieldId: FactoryBiomeClimateFieldId, value: string) => void;
  onRandomizeSeeds: () => void;
  onReset: () => void;
  onApplyToAll: () => void;
}) => {
  const preview = buildFactoryBiomePreviewModel({ overrides: draft });
  const hasMultipleTargets = targets.length > 1;

  return (
    <div className="space-y-3 rounded-[20px] border border-gold/15 bg-black/20 p-3 text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gold">Biome tuning</div>
          <p className="mt-1 text-[11px] leading-4 text-gold/42">Preview climate changes before launch.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRandomizeSeeds}
            className="rounded-full border border-gold/15 bg-black/25 px-3 py-1.5 text-[11px] font-semibold text-gold/70 hover:bg-gold/10"
          >
            Randomize seeds
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-gold/15 bg-black/25 px-3 py-1.5 text-[11px] font-semibold text-gold/70 hover:bg-gold/10"
          >
            Reset
          </button>
          {hasMultipleTargets ? (
            <button
              type="button"
              onClick={onApplyToAll}
              className="rounded-full border border-gold/15 bg-black/25 px-3 py-1.5 text-[11px] font-semibold text-gold/70 hover:bg-gold/10"
            >
              Apply to all
            </button>
          ) : null}
        </div>
      </div>

      {hasMultipleTargets ? (
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold/42">Game</span>
          <select
            value={selectedTargetId}
            onChange={(event) => onSelectTarget(event.target.value)}
            className="mt-1 block h-9 w-full rounded-[14px] border border-gold/15 bg-black/25 px-3 text-[12px] text-gold outline-none"
          >
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div
          className="grid aspect-square overflow-hidden rounded-[16px] border border-gold/15 bg-black/35"
          style={{ gridTemplateColumns: "repeat(21, minmax(0, 1fr))" }}
        >
          {preview.tiles.map((tile) => (
            <div
              key={tile.key}
              title={`${tile.biome} (${tile.col}, ${tile.row})`}
              style={{ backgroundColor: tile.color }}
            />
          ))}
        </div>
        <div className="space-y-1.5">
          {preview.distribution.slice(0, 8).map((entry) => (
            <div key={entry.biome} className="flex items-center justify-between gap-2 text-[11px] text-gold/62">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="truncate">{entry.biome}</span>
              </div>
              <span className="font-mono text-gold/72">{entry.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {listFactoryBiomeClimateFields().map((field) => (
          <label key={field.id} className="block rounded-[16px] border border-gold/10 bg-black/25 px-3 py-2">
            <span className="block text-[12px] font-medium text-gold/70">{field.label}</span>
            <input
              type="number"
              min={0}
              max={field.max}
              step={1}
              value={draft[field.id]}
              onChange={(event) => onValueChange(field.id, event.target.value)}
              className="mt-1 h-8 w-full rounded-[12px] border border-gold/15 bg-black/25 px-2 text-right text-[13px] font-semibold text-gold outline-none"
            />
            {errors[field.id] ? <span className="mt-1 block text-[11px] text-rose-400">{errors[field.id]}</span> : null}
          </label>
        ))}
      </div>

      {invalidReason ? <p className="text-[11px] leading-5 text-rose-400">{invalidReason}</p> : null}
    </div>
  );
};
