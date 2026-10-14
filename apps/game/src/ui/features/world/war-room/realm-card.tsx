import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useAutomationStore, type RealmEntityType } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import { Pencil, Star } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Button } from "@/ui/design-system/kit/button";
import { RequirementChips } from "@/ui/design-system/molecules/requirement-chips";
import { CompactEntityInventory } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import {
  type StructureAction,
  useStructureActions,
} from "@/ui/features/world/containers/left-facets/use-structure-actions";
import {
  formatPopulationStatusLabel,
  formatUsedBuildingTilesLabel,
} from "@/ui/features/world/containers/structure-status";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { inferRealmPreset, REALM_PRESETS, type RealmPresetId } from "@bibliothecadao/eternum/automation";
import { EntityType, getLevelName, RelicRecipientType, type RealmLevels } from "@bibliothecadao/types";
import { useState } from "react";
import { StockList, useStocks } from "./realm-stocks";

/**
 * The selected structure: its level and room, its level-up step, the orders it gives, how it produces, and what it
 * holds. Every number is labelled; the full stock list is one toggle away.
 */
export const RealmCard = ({ realm }: { realm: StructureWithMetadata }) => {
  const { resources, relicEffects } = useStructureEntityDetail({ structureEntityId: realm.entityId });
  const showAutomation = useGameModeConfig().ui.showAutomation;
  const entityType: RealmEntityType = isVillageLikeStructureCategory(realm.category) ? "village" : "realm";

  return (
    <div className="flex flex-col gap-3">
      <RealmTitle realm={realm} />
      <LevelUpOrder realm={realm} />
      <Orders />
      {showAutomation && <AutomationSelect entityId={realm.entityId} entityType={entityType} />}
      <Holdings realm={realm} resources={resources} activeRelicIds={relicEffects.map((effect) => Number(effect.id))} />
    </div>
  );
};

const RealmTitle = ({ realm }: { realm: StructureWithMetadata }) => {
  const { toggleFavorite } = useFavoriteStructures();
  const requestRename = useUIStore((state) => state.setPendingRenameStructureEntityId);
  const facts = realmFacts(realm);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate text-xl font-semibold text-kit-cream">{realm.displayName}</h2>
        <IconToggle
          label={realm.isFavorite ? "Unpin from the top" : "Pin to the top"}
          pressed={realm.isFavorite}
          onClick={() => toggleFavorite(realm.entityId)}
        >
          <Star className={cn("h-4 w-4", realm.isFavorite && "fill-current text-gold")} />
        </IconToggle>
        <IconToggle label="Rename" onClick={() => requestRename(realm.entityId)}>
          <Pencil className="h-4 w-4" />
        </IconToggle>
      </div>
      {facts.length > 0 && <p className="text-sm text-kit-muted">{facts.join(" · ")}</p>}
    </div>
  );
};

/** Level, people and plots, for structures that have them. */
const realmFacts = (realm: StructureWithMetadata): string[] => {
  if (!resolveStructureUiCapabilities(realm.structure).hasPopulationDetails) return [];
  const facts = [
    getLevelName(realm.realmLevel as RealmLevels),
    `${formatPopulationStatusLabel(realm.population, realm.populationCapacity)} people`,
  ];
  if (realm.buildingTilesOccupied !== null && realm.buildingTilesTotal !== null) {
    facts.push(`${formatUsedBuildingTilesLabel(realm.buildingTilesOccupied, realm.buildingTilesTotal)} plots`);
  }
  return facts;
};

const IconToggle = ({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={pressed}
    title={label}
    onClick={onClick}
    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-kit-muted hover:text-gold"
  >
    {children}
  </button>
);

/** The realm's next level as an order beside the others, with what it costs, or why not, while it cannot be taken. */
const LevelUpOrder = ({ realm }: { realm: StructureWithMetadata }) => {
  const levelUp = useRealmLevelUp(realm.entityId);
  const ordersAllowed = useUIStore(canIssueOrders);
  if (!levelUp || levelUp.mode === "max" || !ordersAllowed) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        role="secondary"
        word={levelUp.word}
        icon="Up"
        loading={levelUp.loading ? "Sending…" : undefined}
        disabled={!levelUp.ready}
        onClick={levelUp.run}
        className="w-full"
      />
      {levelUp.refusal &&
        (levelUp.requirements.length > 0 ? (
          <RequirementChips requirements={levelUp.requirements} />
        ) : (
          <p className="text-sm text-kit-muted">{levelUp.refusal}.</p>
        ))}
    </div>
  );
};

/** The orders this structure gives (Build, Production, Military, Transfer, and Trade where the game has it), each
 *  opening its workspace. */
const Orders = () => {
  const actions = useStructureActions();
  if (!actions) return null;
  return (
    <nav aria-label="Orders" className="grid grid-cols-2 gap-2">
      {actions.map((action) => (
        <OrderButton key={action.id} action={action} />
      ))}
    </nav>
  );
};

/** The surface each order opens hangs from its button. */
const POPOVER_ANCHOR: Record<StructureAction["id"], string> = {
  build: "build",
  production: "production",
  military: "military",
  transfer: "logistics",
  trade: "market",
};

const OrderButton = ({ action }: { action: StructureAction }) => {
  const waiting = action.badges?.reduce((sum, badge) => sum + badge.count, 0) ?? 0;
  return (
    <button
      type="button"
      data-popover-anchor={POPOVER_ANCHOR[action.id]}
      aria-pressed={action.active}
      onClick={action.onClick}
      className={cn(
        "flex h-11 items-center gap-2 rounded-lg border px-2.5 text-base font-semibold text-kit-cream transition",
        action.active ? "border-gold bg-gold/15" : "border-kit-line2 hover:border-gold",
      )}
    >
      <img src={action.image} alt="" className="h-6 w-6 object-contain" />
      <span className="min-w-0 flex-1 truncate text-left">{action.label}</span>
      {waiting > 0 && (
        <span aria-label={`${waiting} arriving`} className="rounded-full bg-gold px-1.5 text-sm text-kit-ink">
          {waiting}
        </span>
      )}
    </button>
  );
};

/** How the structure produces on its own, as one labelled choice. */
const AutomationSelect = ({ entityId, entityType }: { entityId: number; entityType: RealmEntityType }) => {
  const realmId = String(entityId);
  const automation = useAutomationStore((state) => state.realms[realmId]);
  const hydrated = useAutomationStore((state) => state.hydrated);
  const ordersAllowed = useUIStore(canIssueOrders);
  const choose = (presetId: RealmPresetId) => {
    if (!canIssueOrders() || !hydrated) return;
    const store = useAutomationStore.getState();
    store.upsertRealm(realmId, { entityType, presetId });
    store.setRealmPreset(realmId, presetId);
  };
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-kit-muted">
      Automatic production
      <select
        value={inferRealmPreset(automation)}
        disabled={!ordersAllowed || !hydrated}
        onChange={(event) => choose(event.target.value as RealmPresetId)}
        onKeyDown={(event) => event.stopPropagation()}
        className="h-9 rounded-md border border-kit-line2 bg-kit-plate px-2 text-base text-kit-cream disabled:opacity-60"
      >
        {REALM_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
    </label>
  );
};

/** What the structure holds: relics to use, then the named stocks, summary or all. */
const Holdings = ({
  realm,
  resources,
  activeRelicIds,
}: {
  realm: StructureWithMetadata;
  resources: ReturnType<typeof useStructureEntityDetail>["resources"];
  activeRelicIds: number[];
}) => {
  const [showAll, setShowAll] = useState(false);
  const stocks = useStocks(resources);
  const ordersAllowed = useUIStore(canIssueOrders);
  return (
    <section aria-label="Holdings" className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-kit-muted">{showAll ? "All resources" : "Stocks"}</h3>
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="h-9 rounded-md px-2 text-sm font-semibold text-kit-cream hover:text-gold"
        >
          {showAll ? "Fewer" : "All resources"}
        </button>
      </div>
      <StockList stocks={showAll ? stocks.held : stocks.summary} />
      <CompactEntityInventory
        resources={resources}
        activeRelicIds={activeRelicIds}
        recipientType={RelicRecipientType.Structure}
        entityId={realm.entityId}
        entityType={EntityType.STRUCTURE}
        allowRelicActivation={ordersAllowed}
        variant="tight"
        filter="relics"
        emptyMessage=""
        showHiddenCount={false}
      />
    </section>
  );
};
