import { useUIStore } from "@/hooks/store/use-ui-store";
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
import { HexPosition, ID, StructureType, TileOccupier } from "@bibliothecadao/types";
import {
  Biome,
  Position,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierStructure,
  getTileAt,
  DEFAULT_COORD_ALT,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { useCallback, useMemo } from "react";

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
    return Biome.getBiome(selectedHex.col || 0, selectedHex.row || 0);
  }, [selectedHex.col, selectedHex.row]);
  const handleSimulateBattle = useCallback(() => {
    setCombatSimulationBiome(biome);
    if (!isPopupOpen(battleSimulation)) {
      openPopup(battleSimulation);
    }
  }, [biome, isPopupOpen, openPopup, setCombatSimulationBiome]);

  const hasOccupier = !!tile && Number(tile.occupier_id) !== 0;
  const occupierType = tile?.occupier_type ?? 0;
  const isSpire = occupierType === TileOccupier.Spire;
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
      className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-hidden"
      style={{ gridTemplateColumns, gridTemplateRows, gridAutoRows }}
    >
      {isSpire ? (
        <div className="grid h-full min-h-0 grid-cols-1 gap-2 md:grid-cols-[1.15fr_0.85fr]">
          <EntityDetailSection compact tone="highlight" className="flex h-full min-h-0">
            <SpireTravelPanel onTravelToEtherealLayer={handleTravelToEtherealLayer} />
          </EntityDetailSection>
          <EntityDetailSection compact tone="highlight" className="flex h-full min-h-0">
            <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
          </EntityDetailSection>
        </div>
      ) : isStructure ? (
        <div className="grid h-full min-h-0 grid-cols-1 gap-2 md:grid-cols-[1.15fr_0.85fr]">
          <StructureBannerEntityDetail
            structureEntityId={occupierEntityId}
            maxInventory={14}
            showButtons={false}
            className="h-full min-h-0"
            {...sharedDetailProps}
          />
          <EntityDetailSection compact tone="highlight" className="flex h-full min-h-0">
            <SelectedStructureActionPanel
              structureEntityId={occupierEntityId}
              biome={biome}
              onSimulateBattle={handleSimulateBattle}
            />
          </EntityDetailSection>
        </div>
      ) : isChest ? (
        <div className="grid h-full min-h-0 grid-cols-1 gap-2 md:grid-cols-[1.15fr_0.85fr]">
          <EntityDetailSection compact tone="highlight" className="flex h-full min-h-0">
            <RelicCrateSummaryPanel crateEntityId={occupierEntityId} />
          </EntityDetailSection>
          <EntityDetailSection compact tone="highlight" className="flex h-full min-h-0">
            <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
          </EntityDetailSection>
        </div>
      ) : isQuest ? (
        <QuestEntityDetail questEntityId={occupierEntityId} className="h-full min-h-0" {...sharedDetailProps} />
      ) : (
        <div className="grid h-full min-h-0 grid-cols-1 gap-2 md:grid-cols-[1.15fr_0.85fr]">
          <ArmyBannerEntityDetail
            armyEntityId={occupierEntityId}
            showButtons={false}
            className="h-full min-h-0"
            {...sharedDetailProps}
          />
          <EntityDetailSection compact tone="highlight" className="flex h-full min-h-0">
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
  biome: ReturnType<typeof Biome.getBiome>;
  onSimulateBattle: () => void;
}) => {
  const { structure, isLoadingStructure } = useStructureEntityDetail({ structureEntityId });

  const structureCategory = structure?.base?.category;
  const isFaithEligible =
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
