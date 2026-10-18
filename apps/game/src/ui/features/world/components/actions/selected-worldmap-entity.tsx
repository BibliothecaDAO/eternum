import { ChestTileDetails } from "./chest-tile-details";
import { useTileAt } from "@/hooks/helpers/use-tile-at";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useRelicCrateOpening } from "@/hooks/store/use-relic-crate-store";
import { requestChestOpening } from "@/three/scenes/worldmap-chest-open-request";
import { useAdjacentOwnExplorer } from "@/ui/features/military/chest/use-adjacent-own-explorer";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useBlitzHyperstructureCreation } from "@/hooks/use-blitz-hyperstructure-creation";
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
import { BiomeType, HexPosition, ID, TileOccupier, TroopType } from "@bibliothecadao/types";
import {
  biomeTypeOf,
  hasTileOccupier,
  isTileOccupierArmy,
  isTileOccupierChest,
  isTileOccupierReservedHyperstructure,
  isTileOccupierStructure,
} from "@bibliothecadao/eternum";
import { type ReactNode, useCallback } from "react";
import { formatTilePanelTitle } from "@/ui/features/world/components/bottom-right-panel/tile-panel-title";
import { toast } from "@/ui/features/event-feed/notify";

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
  const crateOpening = useRelicCrateOpening(selectedHex);

  const biome = tile && tile.biome !== 0 ? biomeTypeOf(tile.biome) : BiomeType.None;
  const handleSimulateBattle = useCallback(() => {
    openSurface({ id: "battle-lab", content: <BattleLab mode="sim" initialBiome={biome} /> });
  }, [biome, openSurface]);

  const hasOccupier = !!tile && hasTileOccupier(tile.occupier_type);
  const occupierType = tile?.occupier_type ?? 0;
  const isSpire = occupierType === TileOccupier.Spire;
  const isReservedHyperstructure = isTileOccupierReservedHyperstructure(occupierType);
  const isStructure = isTileOccupierStructure(occupierType);
  const isChest = isTileOccupierChest(occupierType);
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

  // A crate opened this session keeps its panel after the tile empties, now listing what it yielded. An army standing
  // on the tile comes first, the crate under it: the unit the player can order beats the tile's memory.
  const cratePanel = (isChest || crateOpening) && (
    <RelicCrateTilePanel
      crateEntityId={isChest ? tile.occupier_id : null}
      opening={crateOpening}
      selectedHex={selectedHex}
      coordsLabel={title("Relic Tile")}
      headerAction={isArmy ? undefined : headerAction}
    />
  );
  if (cratePanel && !isArmy) return stackParts({ occupant: cratePanel, biome: biomeCard });

  // A shrine or well is used from Frontier's own card and a dormant spire offers nothing; here its tile reads like any
  // other.
  if (!hasOccupier || !(isSpire || isReservedHyperstructure || isStructure || isArmy)) {
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

  if (isReservedHyperstructure)
    return stackParts({
      occupant: (
        <TileChrome title={title("Unconstructed Hyperstructure")} headerAction={headerAction}>
          <ReservedHyperstructurePanel selectedHex={selectedHex} />
        </TileChrome>
      ),
      biome: biomeCard,
    });

  if (isStructure)
    return stackParts({
      occupant: (
        <StructureBannerEntityDetail
          structureEntityId={occupierEntityId}
          maxInventory={14}
          showButtons={false}
          className={scrollableEntityDetailClass}
          coordsLabel={title("Structure Tile")}
          headerAction={headerAction}
          compact
          layoutVariant="banner"
        />
      ),
      biome: <StructureBiomeCard structureEntityId={occupierEntityId} biomeCard={biomeCard} />,
    });

  return stackParts({
    occupant: (
      <>
        <ArmyBannerEntityDetail
          armyEntityId={occupierEntityId}
          showButtons={false}
          className={scrollableEntityDetailClass}
          coordsLabel={title("Army Tile")}
          headerAction={headerAction}
          compact
          layoutVariant="banner"
        />
        {cratePanel}
      </>
    ),
    biome: <ArmyBiomeCard armyEntityId={occupierEntityId} biome={biome} onSimulateBattle={handleSimulateBattle} />,
  });
};

// The crate panel opens with the player's adjacent explorer; the contract accepts no other opener.
const RelicCrateTilePanel = ({
  crateEntityId,
  opening,
  selectedHex,
  coordsLabel,
  headerAction,
}: {
  crateEntityId: ID | null;
  opening: ReturnType<typeof useRelicCrateOpening>;
  selectedHex: HexPosition;
  coordsLabel?: string;
  headerAction?: ReactNode;
}) => {
  const account = useAccountStore((state) => state.account);
  const explorerId = useAdjacentOwnExplorer(selectedHex);
  const canOpen = Boolean(account) && explorerId !== null;
  // The world map is the one opener: it plays a chest's moment where the game has one.
  const handleOpen = useCallback(() => {
    if (explorerId !== null) requestChestOpening({ explorerId, hex: selectedHex });
  }, [explorerId, selectedHex]);
  return (
    <ChestTileDetails
      crateEntityId={crateEntityId}
      coordsLabel={coordsLabel}
      headerAction={headerAction}
      opening={opening}
      onOpen={canOpen ? handleOpen : undefined}
      openBlockedReason={canOpen ? undefined : "Move one of your armies next to the crate."}
    />
  );
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
  <HudPanel title={title} cue={headerAction} className="min-w-0" bodyClassName="pt-0">
    {children}
  </HudPanel>
);

const ReservedHyperstructurePanel = ({ selectedHex }: { selectedHex: HexPosition }) => {
  const { canCreate, createHyperstructure, isCreating } = useBlitzHyperstructureCreation({ contractHex: selectedHex });

  const handleCreateHyperstructure = useCallback(async () => {
    try {
      await createHyperstructure();
    } catch (error) {
      console.error("[ReservedHyperstructurePanel] Failed to create reserved hyperstructure", error);
      toast.failed(error, "Failed to create the hyperstructure.", {
        location: { x: selectedHex.col, y: selectedHex.row },
      });
    }
  }, [createHyperstructure, selectedHex.col, selectedHex.row]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-hud-title text-hud-ink">Reserved Hyperstructure</p>
      <p className="text-hud-body text-hud-ink">
        Reserved for a future Hyperstructure. Create it here or double-click the tile.
      </p>
      <div>
        <HudButton
          kind="secondary"
          size="sm"
          disabled={!canCreate}
          busy={isCreating ? "Creating…" : undefined}
          onClick={() => void handleCreateHyperstructure()}
        >
          Create here
        </HudButton>
      </div>
    </div>
  );
};

const SpireTravelPanel = ({ mapLayer, onLookAtOtherLayer }: { mapLayer: boolean; onLookAtOtherLayer: () => void }) => (
  <div className="flex flex-col gap-2">
    <p className="text-hud-title text-hud-ink">Spire</p>
    <p className="text-hud-body text-hud-ink">
      This spire stands on both layers. An army next to it crosses to the same hex on the other side.
    </p>
    <div>
      <HudButton kind="secondary" size="sm" onClick={onLookAtOtherLayer}>
        {mapLayer ? "Look at the surface" : "Look at the ethereal layer"}
      </HudButton>
    </div>
  </div>
);
