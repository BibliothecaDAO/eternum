import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { REQUIREMENT_CHIP, RequirementChips } from "@/ui/design-system/molecules/requirement-chips";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { describeCastleLevel } from "./castle-level";
import { ResourceManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { type ID, ResourcesIds } from "@bibliothecadao/types";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";

// One chip style for every requirement / produces row — matches the
// building-tile inspector so the castle reads with the same vocabulary.
const CHIP_BASE = REQUIREMENT_CHIP;

const SectionRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <span className={HUD_LABEL}>{label}</span>
    <div className="flex flex-wrap items-center gap-1.5">{children}</div>
  </div>
);

const PRODUCTION_MODELS = ["ResourceProduction", "ResourceWeight"] as const;

/** The realm's labor income as the chain produces it, the castle's and every workshop's together, per hour. */
const LaborRateRow = ({ structureId }: { structureId: ID }) => {
  const { setup } = useGame();
  useNativeRevision(PRODUCTION_MODELS);
  const labor = new ResourceManager(setup.store, structureId).current(ResourcesIds.Labor);
  const timestamp = useCurrentDefaultTick();
  const perHour =
    labor && timestamp > 0
      ? ResourceManager.calculateResourceProductionData(ResourcesIds.Labor, labor, timestamp).productionPerSecond * 3600
      : undefined;
  return (
    <SectionRow label="Labor / h">
      <span className={CHIP_BASE} title="Labor production">
        <span className="text-emerald-300">
          {perHour === undefined ? "—" : `+${Math.round(perHour).toLocaleString()}`}
        </span>
        <ResourceIcon withTooltip={false} resource={ResourcesIds.Labor} size="xs" />
      </span>
    </SectionRow>
  );
};

/** What a castle level gives, from the game's rules. */
const LevelGains = ({ level }: { level: number }) => (
  <p className="text-[11px] leading-relaxed text-gold/80">{describeCastleLevel(level)}</p>
);

export const RealmUpgradeCompact = () => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const upgradeInfo = useStructureUpgrade(structureEntityId);
  const levelUp = useRealmLevelUp(structureEntityId);
  if (!upgradeInfo || !levelUp) return null;

  if (!upgradeInfo.isOwner || !ordersAllowed) {
    return (
      <div className="space-y-2">
        <SectionRow label="Settlement level">
          <span className={CHIP_BASE}>{upgradeInfo.currentLevelName}</span>
        </SectionRow>
        <p className="text-[11px] leading-relaxed text-gold/70">
          Select a building to inspect this settlement’s economy.
        </p>
      </div>
    );
  }

  if (levelUp.mode === "max") {
    return (
      <div className="flex flex-col gap-2.5">
        <LaborRateRow structureId={structureEntityId} />
        <SectionRow label="Upgrade">
          <span className={CHIP_BASE} title="Max level reached">
            <SemanticIcon name="crown" className="h-3.5 w-3.5 text-gold" />
            <span className="text-gold">Max</span>
          </span>
        </SectionRow>
        <LevelGains level={upgradeInfo.currentLevel} />
      </div>
    );
  }

  const Icon = levelUp.mode === "provision" ? ("pickaxe" as const) : ("chevron-up" as const);
  return (
    <div className="flex flex-col gap-2.5">
      <LaborRateRow structureId={structureEntityId} />

      <SectionRow label={levelUp.word}>
        <RequirementChips requirements={levelUp.requirements} />
      </SectionRow>
      {levelUp.nextLevel > 0 && <LevelGains level={levelUp.nextLevel} />}

      <div className="flex items-center justify-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={levelUp.run}
          disabled={!levelUp.ready}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border px-3 text-[10px] font-semibold uppercase tracking-[0.16em] shadow transition",
            levelUp.ready
              ? "border-amber-500/80 bg-amber-400/90 text-black hover:bg-amber-300"
              : "border-gold/20 bg-black/40 text-gold/40 cursor-not-allowed",
          )}
        >
          <SemanticIcon name={Icon} className="h-3.5 w-3.5" />
          <span>{levelUp.refusal ?? levelUp.word}</span>
        </button>
      </div>
    </div>
  );
};
