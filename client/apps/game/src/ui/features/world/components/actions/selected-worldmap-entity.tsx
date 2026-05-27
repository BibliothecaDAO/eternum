import { useUIStore } from "@/hooks/store/use-ui-store";
import { useBlitzHyperstructureCreation } from "@/hooks/use-blitz-hyperstructure-creation";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import Button from "@/ui/design-system/atoms/button";
import {
  BiomeSummaryCard,
  UnoccupiedTileQuadrants,
} from "@/ui/features/world/components/actions/unoccupied-tile-quadrants";
import { FaithDevotionActionPanel } from "@/ui/features/world/components/actions/faith-devotion-action-panel";
import { ArmyBannerEntityDetail } from "@/ui/features/world/components/entities/banner/army-banner-entity-detail";
import { StructureBannerEntityDetail } from "@/ui/features/world/components/entities/banner/structure-banner-entity-detail";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { QuestEntityDetail } from "@/ui/features/world/components/entities/quest-entity-detail";
import { EntityDetailSection } from "@/ui/features/world/components/entities/layout";
import { battleSimulation } from "@/ui/features/world/components/config";
import { BiomeType, HexPosition, ID, StructureType, TileOccupier } from "@bibliothecadao/types";
import {
  configManager,
  Position,
  hasTileOccupier,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierReservedHyperstructure,
  isTileOccupierStructure,
  getTileAt,
  DEFAULT_COORD_ALT,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { toast } from "sonner";

const occupiedEntityLayoutClass =
  "grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:grid-rows-1";
const entityInfoScrollPaneClass =
  "h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent";
const scrollableEntityDetailClass = "h-auto min-h-full min-w-0 overflow-visible";
const scrollableEntitySectionClass = "flex h-auto min-h-full min-w-0";
const supportingEntitySectionClass = "flex min-h-0 min-w-0";

const EntityInfoScrollPane = ({ children }: { children: ReactNode }) => (
  <div className={entityInfoScrollPaneClass}>{children}</div>
);

export const SelectedWorldmapEntity = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);

  if (!selectedHex) {
    return null;
  }

  return <SelectedWorldmapEntityContent selectedHex={selectedHex} />;
};

const SelectedWorldmapEntityContent = ({ selectedHex }: { selectedHex: HexPosition }) => {
  const { setup } = useDojo();
  const { handleUrlChange } = useQuery();
  const openPopup = useUIStore((state) => state.openPopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const setCombatSimulationBiome = useUIStore((state) => state.setCombatSimulationBiome);

  const gridTemplateColumns = "var(--selected-worldmap-entity-grid-cols, 1fr)";
  const gridTemplateRows = "var(--selected-worldmap-entity-grid-rows, auto)";

  const tile = useMemo(() => {
    if (!selectedHex) return undefined;
    return getTileAt(setup.components, DEFAULT_COORD_ALT, selectedHex.col, selectedHex.row);
  }, [selectedHex, setup.components]);

  const biome = useMemo(() => {
    return configManager.getBiome(selectedHex.col || 0, selectedHex.row || 0);
  }, [selectedHex.col, selectedHex.row]);
  const handleSimulateBattle = useCallback(() => {
    setCombatSimulationBiome(biome);
    if (!isPopupOpen(battleSimulation)) {
      openPopup(battleSimulation);
    }
  }, [biome, isPopupOpen, openPopup, setCombatSimulationBiome]);

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

  const renderUnexploredMessage = () => (
    <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-center">
      <p className="text-xs font-medium text-gold/60 italic text-center">
        Unexplored Territory.
        <br />
        Send an explorer to discover what lies here.
      </p>
    </div>
  );

  if (!tile) {
    return renderUnexploredMessage();
  }

  if (!isExplored) {
    return renderUnexploredMessage();
  }

  if (!hasOccupier) {
    return <UnoccupiedTileQuadrants biome={biome} />;
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
      {isSpire ? (
        <div className={occupiedEntityLayoutClass}>
          <EntityInfoScrollPane>
            <EntityDetailSection compact tone="highlight" className={scrollableEntitySectionClass}>
              <SpireTravelPanel onTravelToEtherealLayer={handleTravelToEtherealLayer} />
            </EntityDetailSection>
          </EntityInfoScrollPane>
          <EntityDetailSection compact tone="highlight" className={supportingEntitySectionClass}>
            <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
          </EntityDetailSection>
        </div>
      ) : isReservedHyperstructure ? (
        <div className={occupiedEntityLayoutClass}>
          <EntityInfoScrollPane>
            <EntityDetailSection compact tone="highlight" className={scrollableEntitySectionClass}>
              <ReservedHyperstructurePanel selectedHex={selectedHex} />
            </EntityDetailSection>
          </EntityInfoScrollPane>
          <EntityDetailSection compact tone="highlight" className={supportingEntitySectionClass}>
            <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
          </EntityDetailSection>
        </div>
      ) : isStructure ? (
        <div className={occupiedEntityLayoutClass}>
          <EntityInfoScrollPane>
            <StructureBannerEntityDetail
              structureEntityId={occupierEntityId}
              maxInventory={14}
              showButtons={false}
              className={scrollableEntityDetailClass}
              {...sharedDetailProps}
            />
          </EntityInfoScrollPane>
          <EntityDetailSection compact tone="highlight" className={supportingEntitySectionClass}>
            <SelectedStructureActionPanel
              structureEntityId={occupierEntityId}
              biome={biome}
              onSimulateBattle={handleSimulateBattle}
            />
          </EntityDetailSection>
        </div>
      ) : isChest ? (
        <div className={occupiedEntityLayoutClass}>
          <EntityInfoScrollPane>
            <EntityDetailSection compact tone="highlight" className={scrollableEntitySectionClass}>
              <RelicCrateSummaryPanel crateEntityId={occupierEntityId} />
            </EntityDetailSection>
          </EntityInfoScrollPane>
          <EntityDetailSection compact tone="highlight" className={supportingEntitySectionClass}>
            <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
          </EntityDetailSection>
        </div>
      ) : isQuest ? (
        <EntityInfoScrollPane>
          <QuestEntityDetail questEntityId={occupierEntityId} className="min-h-full" {...sharedDetailProps} />
        </EntityInfoScrollPane>
      ) : (
        <div className={occupiedEntityLayoutClass}>
          <EntityInfoScrollPane>
            <ArmyBannerEntityDetail
              armyEntityId={occupierEntityId}
              showButtons={false}
              className={scrollableEntityDetailClass}
              {...sharedDetailProps}
            />
          </EntityInfoScrollPane>
          <EntityDetailSection compact tone="highlight" className={supportingEntitySectionClass}>
            <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
          </EntityDetailSection>
        </div>
      )}
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
      toast.error(error instanceof Error ? error.message : "Failed to create the hyperstructure.");
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
