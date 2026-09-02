import { useTileAt } from "@/hooks/helpers/use-tile-at";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useBlitzHyperstructureCreation } from "@/hooks/use-blitz-hyperstructure-creation";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import Button from "@/ui/design-system/atoms/button";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import {
  BiomeSummaryCard,
  UnoccupiedTileQuadrants,
} from "@/ui/features/world/components/actions/unoccupied-tile-quadrants";
import { FaithDevotionActionPanel } from "@/ui/features/world/components/actions/faith-devotion-action-panel";
import { ArmyBannerEntityDetail } from "@/ui/features/world/components/entities/banner/army-banner-entity-detail";
import { StructureBannerEntityDetail } from "@/ui/features/world/components/entities/banner/structure-banner-entity-detail";
import { useArmyEntityDetail } from "@/ui/features/world/components/entities/hooks/use-army-entity-detail";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { QuestEntityDetail } from "@/ui/features/world/components/entities/quest-entity-detail";
import { EntityDetailSection } from "@/ui/features/world/components/entities/layout";
import { BattleLab } from "@/ui/features/military/battle/battle-lab";
import { BiomeType, HexPosition, ID, StructureType, TileOccupier, TroopType } from "@bibliothecadao/types";
import {
  configManager,
  Position,
  hasTileOccupier,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierReservedHyperstructure,
  isTileOccupierStructure,
} from "@bibliothecadao/eternum";
import { useQuery } from "@bibliothecadao/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { toast } from "@/ui/features/event-feed/notify";

// Layout: vertical column of bubbles. The outer parent (TileDetails atom in
// bottom-right-panel) already provides positioning + scroll, so this layout
// just stacks each section with a small gap and lets each child render its
// own rounded bubble.
const occupiedEntityLayoutClass = "flex h-full min-h-0 min-w-0 flex-col gap-2 pointer-events-auto";
const entityInfoScrollPaneClass = "min-w-0";
const scrollableEntityDetailClass = "h-auto min-w-0 overflow-visible";
const scrollableEntitySectionClass = "flex min-w-0";

const EntityInfoScrollPane = ({ children }: { children: ReactNode }) => (
  <div className={entityInfoScrollPaneClass}>{children}</div>
);

export const SelectedWorldmapEntity = ({
  coordsLabel,
  headerAction,
}: {
  coordsLabel?: string;
  headerAction?: ReactNode;
} = {}) => {
  const selectedHex = useUIStore((state) => state.selectedHex);

  if (!selectedHex) {
    return null;
  }

  return (
    <SelectedWorldmapEntityContent selectedHex={selectedHex} coordsLabel={coordsLabel} headerAction={headerAction} />
  );
};

const SelectedWorldmapEntityContent = ({
  selectedHex,
  coordsLabel,
  headerAction,
}: {
  selectedHex: HexPosition;
  coordsLabel?: string;
  headerAction?: ReactNode;
}) => {
  const { handleUrlChange } = useQuery();
  const openSurface = usePopoverStore((state) => state.openSurface);

  const gridTemplateColumns = "var(--selected-worldmap-entity-grid-cols, 1fr)";
  const gridTemplateRows = "var(--selected-worldmap-entity-grid-rows, auto)";

  const tile = useTileAt(selectedHex.col, selectedHex.row);

  const biome = useMemo(() => {
    return configManager.getBiome(selectedHex.col || 0, selectedHex.row || 0);
  }, [selectedHex.col, selectedHex.row]);
  const handleSimulateBattle = useCallback(() => {
    openSurface({ id: "battle-lab", content: <BattleLab mode="sim" initialBiome={biome} /> });
  }, [biome, openSurface]);

  const hasOccupier = !!tile && hasTileOccupier(tile.occupier_type);
  const occupierType = tile?.occupier_type ?? 0;
  const isSpire = occupierType === TileOccupier.Spire;
  const isReservedHyperstructure = isTileOccupierReservedHyperstructure(occupierType);
  const isStructure = Boolean(tile?.occupier_is_structure) || isTileOccupierStructure(occupierType);
  const isChest = isTileOccupierChest(occupierType);
  const isQuest = isTileOccupierQuest(occupierType);
  const isExplored = !!tile && Number(tile.biome) !== 0;
  const normalizedSelectedHex = useMemo(() => {
    return new Position({ x: selectedHex.col, y: selectedHex.row }).getNormalized();
  }, [selectedHex.col, selectedHex.row]);
  const handleTravelToEtherealLayer = useCallback(() => {
    handleUrlChange(`/play/travel?col=${normalizedSelectedHex.x}&row=${normalizedSelectedHex.y}`);
  }, [handleUrlChange, normalizedSelectedHex.x, normalizedSelectedHex.y]);

  if (!tile || !isExplored) {
    return null;
  }

  // Small fallback "STRUCTURE TILE · (x, y)" + re-sync chip for non-structure
  // tiles. Structure tiles merge the same info into the owner bubble itself.
  const coordChip = coordsLabel ? (
    <div
      className={cn(
        "pointer-events-auto mb-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2",
        OVERLAY_SURFACE_BASE,
      )}
    >
      <span className={cn("min-w-0 flex-1 truncate", HUD_LABEL)}>{coordsLabel}</span>
      {headerAction}
    </div>
  ) : null;

  if (!hasOccupier) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {coordChip}
        <UnoccupiedTileQuadrants biome={biome} />
      </div>
    );
  }

  const gridAutoRows = "var(--selected-worldmap-entity-grid-auto-rows, minmax(0, auto))";

  const occupierEntityId = tile.occupier_id;
  const sharedDetailProps = {
    compact: true,
    layoutVariant: "banner",
  } as const;

  return (
    <div
      className="grid h-full min-h-0 grid-cols-1 gap-2"
      style={{ gridTemplateColumns, gridTemplateRows, gridAutoRows }}
    >
      {isStructure || (!isSpire && !isReservedHyperstructure && !isChest && !isQuest && hasOccupier) ? null : coordChip}
      {isSpire ? (
        <div className={occupiedEntityLayoutClass}>
          <EntityInfoScrollPane>
            <EntityDetailSection compact tone="highlight" className={scrollableEntitySectionClass}>
              <SpireTravelPanel onTravelToEtherealLayer={handleTravelToEtherealLayer} />
            </EntityDetailSection>
          </EntityInfoScrollPane>
          <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
        </div>
      ) : isReservedHyperstructure ? (
        <div className={occupiedEntityLayoutClass}>
          <EntityInfoScrollPane>
            <EntityDetailSection compact tone="highlight" className={scrollableEntitySectionClass}>
              <ReservedHyperstructurePanel selectedHex={selectedHex} />
            </EntityDetailSection>
          </EntityInfoScrollPane>
          <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
        </div>
      ) : isStructure ? (
        <div className={occupiedEntityLayoutClass}>
          <EntityInfoScrollPane>
            <StructureBannerEntityDetail
              structureEntityId={occupierEntityId}
              maxInventory={14}
              showButtons={false}
              className={scrollableEntityDetailClass}
              coordsLabel={coordsLabel}
              headerAction={headerAction}
              {...sharedDetailProps}
            />
          </EntityInfoScrollPane>
          <SelectedStructureActionPanel
            structureEntityId={occupierEntityId}
            biome={biome}
            onSimulateBattle={handleSimulateBattle}
          />
        </div>
      ) : isChest ? (
        <div className={occupiedEntityLayoutClass}>
          <EntityInfoScrollPane>
            <EntityDetailSection compact tone="highlight" className={scrollableEntitySectionClass}>
              <RelicCrateSummaryPanel crateEntityId={occupierEntityId} />
            </EntityDetailSection>
          </EntityInfoScrollPane>
          <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
        </div>
      ) : isQuest ? (
        <EntityInfoScrollPane>
          <QuestEntityDetail questEntityId={occupierEntityId} className="min-h-full" {...sharedDetailProps} />
        </EntityInfoScrollPane>
      ) : (
        <SelectedArmyTilePanel
          armyEntityId={occupierEntityId}
          biome={biome}
          coordsLabel={coordsLabel}
          headerAction={headerAction}
          onSimulateBattle={handleSimulateBattle}
        />
      )}
    </div>
  );
};

// Army tile panel — reads the army to figure out which troop type belongs to
// the selected explorer so the biome card can highlight the matching bonus row.
const SelectedArmyTilePanel = ({
  armyEntityId,
  biome,
  coordsLabel,
  headerAction,
  onSimulateBattle,
}: {
  armyEntityId: ID;
  biome: BiomeType;
  coordsLabel?: string;
  headerAction?: ReactNode;
  onSimulateBattle: () => void;
}) => {
  const { explorer } = useArmyEntityDetail({ armyEntityId });
  const highlightTroopType =
    explorer?.troops?.category !== undefined ? (Number(explorer.troops.category) as unknown as TroopType) : undefined;

  return (
    <div className={occupiedEntityLayoutClass}>
      <EntityInfoScrollPane>
        <ArmyBannerEntityDetail
          armyEntityId={armyEntityId}
          showButtons={false}
          className={scrollableEntityDetailClass}
          coordsLabel={coordsLabel}
          headerAction={headerAction}
          compact
          layoutVariant="banner"
        />
      </EntityInfoScrollPane>
      <BiomeSummaryCard
        biome={biome}
        showSimulateAction
        onSimulateBattle={onSimulateBattle}
        highlightTroopType={highlightTroopType}
      />
    </div>
  );
};

const SelectedStructureActionPanel = ({
  structureEntityId,
  biome,
  onSimulateBattle,
}: {
  structureEntityId: ID;
  biome: BiomeType;
  onSimulateBattle: () => void;
}) => {
  const { structure, isLoadingStructure } = useStructureEntityDetail({ structureEntityId });
  const resolvedWorldMode = useResolvedWorldGameMode();
  const isEternumMode = resolvedWorldMode === "eternum";

  const structureCategory = structure?.base?.category;
  const isFaithEligible =
    isEternumMode &&
    structureCategory !== undefined &&
    [StructureType.Realm, StructureType.Village].includes(Number(structureCategory) as StructureType);

  if (isLoadingStructure) {
    return <div className="flex h-full items-center justify-center text-xxs text-gold/70">Loading structure...</div>;
  }

  if (isFaithEligible) {
    return <FaithDevotionActionPanel structureEntityId={structureEntityId} variant="compact" />;
  }

  return <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={onSimulateBattle} />;
};

const RelicCrateSummaryPanel = ({ crateEntityId }: { crateEntityId: ID }) => {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-1 text-left">
        <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Relic Crate</span>
        <span className="text-sm font-semibold text-gold">Crate #{crateEntityId}</span>
        <p className="text-xxs text-gold/70">Claim it to discover 3 relics that can empower armies or structures.</p>
        <p className="text-xxs text-gold/70">Cracking it open also grants you 1000 Victory Points !</p>
      </div>
    </div>
  );
};

const ReservedHyperstructurePanel = ({ selectedHex }: { selectedHex: HexPosition }) => {
  const { canCreate, createHyperstructure, isCreating } = useBlitzHyperstructureCreation({
    hexCoords: selectedHex,
  });

  const handleCreateHyperstructure = useCallback(async () => {
    try {
      await createHyperstructure();
    } catch (error) {
      console.error("[ReservedHyperstructurePanel] Failed to create reserved hyperstructure", error);
      const raw = error instanceof Error ? error.message : String(error);
      // A stale tile can still show "reserved" after someone created it —
      // translate the contract revert instead of dumping the paymaster error.
      const message = raw.includes("already been created")
        ? "This hyperstructure was already created — the map is catching up."
        : raw || "Failed to create the hyperstructure.";
      toast.error(message);
    }
  }, [createHyperstructure]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-1 text-left">
        <span className="text-xxs uppercase tracking-[0.3em] text-amber-200/80">Unconstructed Hyperstructure</span>
        <span className="text-sm font-semibold text-amber-100">Reserved Hyperstructure</span>
        <p className="text-xxs text-gold/70">
          This tile is already reserved for a future Hyperstructure. Double-click it on the map or press Create Here to
          awaken the real structure.
        </p>
      </div>
      <div className="flex justify-start">
        <Button
          variant="outline"
          size="xs"
          className="rounded-full border-amber-300/70 px-3 py-1 text-[11px] text-amber-100 hover:border-amber-200"
          forceUppercase={false}
          withoutSound
          disabled={!canCreate || isCreating}
          onClick={() => void handleCreateHyperstructure()}
        >
          {isCreating ? "Creating..." : "Create Here"}
        </Button>
      </div>
    </div>
  );
};

const SpireTravelPanel = ({ onTravelToEtherealLayer }: { onTravelToEtherealLayer: () => void }) => {
  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="flex flex-col gap-1 text-left">
        <span className="text-xxs uppercase tracking-[0.3em] text-cyan-200/80">Spire</span>
        <span className="text-sm font-semibold text-cyan-100">Ethereal Layer Gateway</span>
        <p className="text-xxs text-gold/70">Use this Spire to enter the Ethereal Layer and fast-travel routes.</p>
      </div>
      <Button
        size="xs"
        variant="outline"
        forceUppercase={false}
        className="w-full border-cyan-300/60 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"
        onClick={onTravelToEtherealLayer}
      >
        Travel to Ethereal Layer
      </Button>
    </div>
  );
};
