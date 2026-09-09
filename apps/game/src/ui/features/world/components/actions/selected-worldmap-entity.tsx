import { ChestTileDetails } from "./chest-tile-details";
import { useTileAt } from "@/hooks/helpers/use-tile-at";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useBlitzHyperstructureCreation } from "@/hooks/use-blitz-hyperstructure-creation";
import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_HEADLINE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
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
const occupiedEntityLayoutClass = "flex min-w-0 shrink-0 flex-col gap-2 pointer-events-auto";
const scrollableEntityDetailClass = "h-auto min-w-0 overflow-visible";

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
  const isStructure = isTileOccupierStructure(occupierType);
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
    return <UnoccupiedTileQuadrants biome={biome} coordsLabel={coordsLabel} headerAction={headerAction} />;
  }

  const occupierEntityId = tile.occupier_id;
  const sharedDetailProps = {
    compact: true,
    layoutVariant: "banner",
  } as const;

  return (
    <div className={occupiedEntityLayoutClass}>
      {isQuest ? coordChip : null}
      {isSpire ? (
        <div className={occupiedEntityLayoutClass}>
          <TileChrome title={coordsLabel ?? "Spire tile"} headerAction={headerAction}>
            <SpireTravelPanel onTravelToEtherealLayer={handleTravelToEtherealLayer} />
          </TileChrome>
          <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
        </div>
      ) : isReservedHyperstructure ? (
        <div className={occupiedEntityLayoutClass}>
          <TileChrome title={coordsLabel ?? "Hyperstructure tile"} headerAction={headerAction}>
            <ReservedHyperstructurePanel selectedHex={selectedHex} />
          </TileChrome>
          <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />
        </div>
      ) : isStructure ? (
        <div className={occupiedEntityLayoutClass}>
          <StructureBannerEntityDetail
            structureEntityId={occupierEntityId}
            maxInventory={14}
            showButtons={false}
            className={scrollableEntityDetailClass}
            coordsLabel={coordsLabel}
            headerAction={headerAction}
            {...sharedDetailProps}
          />

          <SelectedStructureActionPanel
            structureEntityId={occupierEntityId}
            biome={biome}
            onSimulateBattle={handleSimulateBattle}
          />
        </div>
      ) : isChest ? (
        <ChestTileDetails
          crateEntityId={occupierEntityId}
          biome={biome}
          coordsLabel={coordsLabel}
          headerAction={headerAction}
          onSimulateBattle={handleSimulateBattle}
        />
      ) : isQuest ? (
        <QuestEntityDetail questEntityId={occupierEntityId} className="min-h-full" {...sharedDetailProps} />
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
      <ArmyBannerEntityDetail
        armyEntityId={armyEntityId}
        showButtons={false}
        className={scrollableEntityDetailClass}
        coordsLabel={coordsLabel}
        headerAction={headerAction}
        compact
        layoutVariant="banner"
      />

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

/** The chrome every occupied tile shares: one surface, a header band with the coordinates, sections below. */
const TileChrome = ({ title, headerAction, children }: { title: string; headerAction?: ReactNode; children: ReactNode }) => (
  <div className={cn("flex min-w-0 flex-col divide-y divide-gold/15 rounded-xl", OVERLAY_SURFACE_BASE)}>
    <InfoBubble variant="section" title={title} cue={headerAction} bodyClassName="pt-0">
      {children}
    </InfoBubble>
  </div>
);

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
      toast.error(message, { location: { x: selectedHex.col, y: selectedHex.row } });
    }
  }, [createHyperstructure, selectedHex.col, selectedHex.row]);

  return (
    <div className="flex flex-col gap-2">
      <p className={HUD_HEADLINE}>Reserved Hyperstructure</p>
      <p className={HUD_BODY}>Reserved for a future Hyperstructure. Create it here or double-click the tile.</p>
      <div>
        <button
          type="button"
          className={HUD_PILL_BUTTON}
          disabled={!canCreate || isCreating}
          onClick={() => void handleCreateHyperstructure()}
        >
          {isCreating ? "Creating…" : "Create here"}
        </button>
      </div>
    </div>
  );
};

const SpireTravelPanel = ({ onTravelToEtherealLayer }: { onTravelToEtherealLayer: () => void }) => (
  <div className="flex flex-col gap-2">
    <p className={HUD_HEADLINE}>Ethereal Layer Gateway</p>
    <p className={HUD_BODY}>Enter the Ethereal Layer here to fast-travel.</p>
    <div>
      <button type="button" className={HUD_PILL_BUTTON} onClick={onTravelToEtherealLayer}>
        Travel to Ethereal Layer
      </button>
    </div>
  </div>
);
