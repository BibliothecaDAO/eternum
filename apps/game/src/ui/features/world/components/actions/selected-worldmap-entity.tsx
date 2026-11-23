import { useTileAt } from "@/hooks/helpers/use-tile-at";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import {
  BiomeSummaryCard,
  UnoccupiedTileQuadrants,
} from "@/ui/features/world/components/actions/unoccupied-tile-quadrants";
import { ArmyBannerEntityDetail } from "@/ui/features/world/components/entities/banner/army-banner-entity-detail";
import { StructureBannerEntityDetail } from "@/ui/features/world/components/entities/banner/structure-banner-entity-detail";
import { useArmyEntityDetail } from "@/ui/features/world/components/entities/hooks/use-army-entity-detail";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { BattleLab } from "@/ui/features/military/battle/battle-lab";
import { BiomeType, HexPosition, ID, TileOccupier, TroopType, eternumMapName } from "@bibliothecadao/types";
import { biomeTypeOf, hasTileOccupier, isTileOccupierArmy, isTileOccupierStructure } from "@bibliothecadao/eternum";
import { type ReactNode, useCallback } from "react";
import { formatTilePanelTitle } from "@/ui/features/world/components/bottom-right-panel/tile-panel-title";

// Layout: vertical column of bubbles. The outer parent (TileDetails atom in
// bottom-right-panel) already provides positioning + scroll, so this layout
// just stacks each section with a small gap and lets each child render its
// own rounded bubble.
const occupiedEntityLayoutClass = "flex min-w-0 shrink-0 flex-col gap-2 pointer-events-auto";
const scrollableEntityDetailClass = "h-auto min-w-0 overflow-visible";

/** What a picked map tile shows, stacked: what stands on it (none on a bare tile), then its biome. */
const stackParts = ({ occupant, biome }: { occupant: ReactNode | null; biome: ReactNode }) => (
  <div className={occupiedEntityLayoutClass}>
    {occupant}
    {biome}
  </div>
);

/** The selected map tile's panel: what stands on it, then its biome. */
export const SelectedWorldmapEntity = ({ headerAction }: { headerAction?: ReactNode } = {}) => {
  const selectedHex = useUIStore((state) => state.selectedHex);

  if (!selectedHex) {
    return null;
  }

  return <SelectedWorldmapEntityContent selectedHex={selectedHex} headerAction={headerAction} />;
};

const SelectedWorldmapEntityContent = ({
  selectedHex,
  headerAction,
}: {
  selectedHex: HexPosition;
  headerAction?: ReactNode;
}) => {
  const openSurface = usePopoverStore((state) => state.openSurface);

  const tile = useTileAt(selectedHex.col, selectedHex.row);

  const biome = tile && tile.biome !== 0 ? biomeTypeOf(tile.biome) : BiomeType.None;
  const handleSimulateBattle = useCallback(() => {
    openSurface({ id: "battle-lab", content: <BattleLab mode="sim" initialBiome={biome} /> });
  }, [biome, openSurface]);

  const hasOccupier = !!tile && hasTileOccupier(tile.occupier_type);
  const occupierType = tile?.occupier_type ?? 0;
  const isSpire = occupierType === TileOccupier.Spire;
  const isStructure = isTileOccupierStructure(occupierType);
  const isArmy = isTileOccupierArmy(occupierType);
  const isExplored = !!tile && Number(tile.biome) !== 0;
  const mapLayer = useUIStore((state) => state.mapLayer);
  const setMapLayer = useUIStore((state) => state.setMapLayer);
  const lookAtOtherLayer = useCallback(() => setMapLayer(!mapLayer), [mapLayer, setMapLayer]);

  if (!tile || !isExplored) {
    return null;
  }

  const title = (label: string) => formatTilePanelTitle(label, selectedHex);
  const biomeCard = <BiomeSummaryCard biome={biome} showSimulateAction onSimulateBattle={handleSimulateBattle} />;

  // A shrine or well is used from Frontier's own card and a dormant spire offers nothing; here its tile reads like any
  // other.
  if (!hasOccupier || !(isSpire || isStructure || isArmy)) {
    return stackParts({
      occupant: null,
      biome: (
        <UnoccupiedTileQuadrants
          biome={biome}
          coordsLabel={title(hasOccupier ? `${TileOccupier[occupierType]} Tile` : "Biome")}
          headerAction={headerAction}
        />
      ),
    });
  }

  const occupierEntityId = tile.occupier_id;

  if (isSpire)
    return stackParts({
      occupant: (
        <TileChrome title={title("Spire Tile")} headerAction={headerAction}>
          <SpireTravelPanel mapLayer={mapLayer} onLookAtOtherLayer={lookAtOtherLayer} />
        </TileChrome>
      ),
      biome: biomeCard,
    });

  if (isStructure)
    return stackParts({
      occupant: (
        <StructureBannerEntityDetail
          structureEntityId={occupierEntityId}
          className={scrollableEntityDetailClass}
          coordsLabel={title("Structure Tile")}
          headerAction={headerAction}
        />
      ),
      biome: <StructureBiomeCard structureEntityId={occupierEntityId} biomeCard={biomeCard} />,
    });

  return stackParts({
    occupant: (
      <ArmyBannerEntityDetail
        armyEntityId={occupierEntityId}
        showButtons={false}
        className={scrollableEntityDetailClass}
        coordsLabel={title("Army Tile")}
        headerAction={headerAction}
        compact
        layoutVariant="banner"
      />
    ),
    biome: <ArmyBiomeCard armyEntityId={occupierEntityId} biome={biome} onSimulateBattle={handleSimulateBattle} />,
  });
};

/** An army's biome card, its own troop type's row lit. */
const ArmyBiomeCard = ({
  armyEntityId,
  biome,
  onSimulateBattle,
}: {
  armyEntityId: ID;
  biome: BiomeType;
  onSimulateBattle: () => void;
}) => {
  const { explorer } = useArmyEntityDetail({ armyEntityId });
  const highlightTroopType =
    explorer?.troops?.category !== undefined ? (Number(explorer.troops.category) as unknown as TroopType) : undefined;
  return (
    <BiomeSummaryCard
      biome={biome}
      showSimulateAction
      onSimulateBattle={onSimulateBattle}
      highlightTroopType={highlightTroopType}
    />
  );
};

/** A structure's biome card, once the structure has loaded. */
const StructureBiomeCard = ({ structureEntityId, biomeCard }: { structureEntityId: ID; biomeCard: ReactNode }) => {
  const { isLoadingStructure } = useStructureEntityDetail({ structureEntityId });
  if (isLoadingStructure) {
    return (
      <div className="flex h-full items-center justify-center text-hud-label text-hud-muted">Loading structure...</div>
    );
  }
  return biomeCard;
};

/** The chrome every occupied tile shares: the HUD panel, a header band with the coordinates, its body below. */
const TileChrome = ({
  title,
  headerAction,
  children,
}: {
  title: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) => (
  <HudPanel title={title} cue={headerAction} className="min-w-0">
    {children}
  </HudPanel>
);

const SpireTravelPanel = ({ mapLayer, onLookAtOtherLayer }: { mapLayer: boolean; onLookAtOtherLayer: () => void }) => (
  <div className="flex flex-col gap-2">
    <p className="text-hud-title text-hud-ink">Spire</p>
    <div>
      <HudButton kind="secondary" size="sm" onClick={onLookAtOtherLayer}>
        Look at the {eternumMapName(!mapLayer)}
      </HudButton>
    </div>
  </div>
);
