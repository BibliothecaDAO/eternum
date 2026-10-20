import { useNextUpHoldsPrimary } from "@/ui/features/world/hud/next-up-shows";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip } from "@/ui/design-system/kit/hud-elements";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { RequirementChips } from "@/ui/design-system/molecules/requirement-chips";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { describeCastleLevel } from "./castle-level";
import { ResourceManager } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { type ID, ResourcesIds, formatRate, resourceName } from "@bibliothecadao/types";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";

const SectionRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-hud-label text-hud-muted">{label}</span>
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
  const perSecond =
    labor && timestamp > 0
      ? ResourceManager.calculateResourceProductionData(ResourcesIds.Labor, labor, timestamp).productionPerSecond
      : undefined;
  return (
    <SectionRow label={resourceName(ResourcesIds.Labor)}>
      <span data-tip="Labor production">
        <HudChip tone="good">
          {formatRate(perSecond)}
          <ResourceIcon withTooltip={false} resource={ResourcesIds.Labor} size="xs" />
        </HudChip>
      </span>
    </SectionRow>
  );
};

/** What a castle level gives, from the game's rules. */
const LevelGains = ({ level }: { level: number }) => (
  <p className="text-hud-label text-hud-muted">{describeCastleLevel(level)}</p>
);

export const RealmUpgradeCompact = () => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const upgradeInfo = useStructureUpgrade(structureEntityId);
  const levelUp = useRealmLevelUp(structureEntityId);
  const nextUpHoldsPrimary = useNextUpHoldsPrimary();
  if (!upgradeInfo || !levelUp) return null;

  if (!upgradeInfo.isOwner || !ordersAllowed) {
    return (
      <div className="flex flex-col gap-2">
        <SectionRow label="Settlement level">
          <HudChip>{upgradeInfo.currentLevelName}</HudChip>
        </SectionRow>
        <p className="text-hud-label text-hud-muted">Select a building to inspect this settlement’s economy.</p>
      </div>
    );
  }

  if (levelUp.mode === "max") {
    return (
      <div className="flex flex-col gap-2.5">
        <LaborRateRow structureId={structureEntityId} />
        <SectionRow label="Upgrade">
          <span data-tip="Max level reached">
            <HudChip>
              <Icon name="crown" size={14} />
              Max
            </HudChip>
          </span>
        </SectionRow>
        <LevelGains level={upgradeInfo.currentLevel} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <LaborRateRow structureId={structureEntityId} />

      <SectionRow label={levelUp.word}>
        <RequirementChips requirements={levelUp.requirements} />
      </SectionRow>
      {levelUp.nextLevel > 0 && <LevelGains level={levelUp.nextLevel} />}

      <div className="flex justify-center pt-1">
        {/* While Next up shows a step, its button is the screen's one primary; this one is secondary. */}
        <HudButton
          kind={nextUpHoldsPrimary ? "secondary" : "primary"}
          size="sm"
          icon={levelUp.mode === "provision" ? "pickaxe" : "chevron-up"}
          disabled={!levelUp.ready}
          onClick={levelUp.run}
        >
          {levelUp.refusal ?? levelUp.word}
        </HudButton>
      </div>
    </div>
  );
};
