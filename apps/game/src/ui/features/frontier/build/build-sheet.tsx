import { AudioManager } from "@/audio/core/AudioManager";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getPlayerName } from "@/services/identity/player-profiles";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { Package } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { toast } from "@/ui/features/event-feed/notify";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { buildableRadius, configManager, getRealmInfo, resolveUseSimpleCost } from "@bibliothecadao/eternum";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BUILDINGS_CENTER, BuildingType, getHexDistance, type HexPosition, ResourcesIds } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";
import { Chip } from "../frontier-chips";
import { formatAmount } from "../frontier-format";
import { PersonGlyph } from "../glyphs";
import { type BuildOption, readBuildOptions } from "./build-options";

const BUILD_MODELS = [
  "Building",
  "ResourceBalance",
  "ResourceProduction",
  "ResourceWeight",
  "Structure",
  "StructureBuildings",
  // What the realm has researched sets each building's tier, its price and what it gives.
  "RealmKnowledge",
  "ResearchNode",
  "BuildingTierRule",
] as const;

/** Frontier's names for its five buildings: proper names, the only words on a card. */
const BUILDING_NAMES: Partial<Record<BuildingType, string>> = {
  [BuildingType.ResourceWheat]: "Farm",
  [BuildingType.ResourceKnightT1]: "Barracks",
  [BuildingType.ResourceLabor]: "Workshop",
  [BuildingType.Storehouse]: "Storehouse",
  [BuildingType.WorkersHut]: "Hut",
};

/**
 * The plot of the player's realm they tapped, when a building could rise there: in the realm view, empty, and inside
 * the ring the realm's level opens. Anything else is not the build sheet's.
 */
export const useOpenPlot = (realm: NativeRows["Structure"] | null): HexPosition | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  const ordersAllowed = useUIStore(canIssueOrders);
  useNativeRevision(["Building"]);
  if (isMapView || !ordersAllowed || !realm || !selected || selected.structureId !== realm.entity_id) return null;
  const plot = { col: selected.innerCol, row: selected.innerRow };
  const distance = getHexDistance({ col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] }, plot);
  if (distance === 0 || distance > buildableRadius(realm.base.level)) return null;
  const building = setup.store.get("Building", {
    game_id: realm.game_id,
    structure_id: realm.entity_id,
    inner_col: plot.col,
    inner_row: plot.row,
  });
  return building && Number(building.category) !== BuildingType.None ? null : plot;
};

/**
 * Frontier's build sheet (design §3.12, mockup 2): each building the plot can hold as a card of art and numbers,
 * what it gives, the population it takes, the wheat after it and its price, doubled on the ring's marked plot.
 * The chosen card's building stands on the plot as a ghost; one Build button raises it.
 */
export const BuildSheet = ({
  realm,
  plot,
  onClose,
}: {
  realm: NativeRows["Structure"];
  plot: HexPosition;
  onClose: () => void;
}) => {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);
  const revision = useNativeRevision(BUILD_MODELS);
  const options = useMemo(
    () => readBuildOptions(setup.store, realm, plot, useSimpleCost),
    [plot.col, plot.row, realm, revision, setup.store, useSimpleCost],
  );
  const realmInfo = useMemo(
    () => getRealmInfo(realm.entity_id, setup.store, getPlayerName),
    [realm.entity_id, revision, setup.store],
  );
  const [chosen, setChosen] = useState(0);
  const option = options?.[chosen];
  const [pending, setPending] = useState(false);
  useBuildingGhost(option?.category, plot);

  const canBuild = (candidate: BuildOption) =>
    resolveConstructionBuildability({
      entityId: realm.entity_id,
      buildingType: candidate.category,
      useSimpleCost,
      store: setup.store,
      realm: realmInfo,
      mode,
      targetSpot: plot,
    }).canSubmit;

  // Until the realm's research is known, no building's tier or price is.
  if (!options || !option) return null;

  const build = async () => {
    setPending(true);
    try {
      await requireActiveGameClient().actions.placeBuilding({
        structureId: realm.entity_id,
        buildingType: option.category,
        hex: plot,
        useSimpleCost,
      });
      AudioManager.getInstance().play("ui.build_place");
      onClose();
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The building could not be placed."));
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-label="Build"
      data-frontier-sheet
      className={cn(
        "frontier-sheet pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans",
        "landscape:inset-x-auto landscape:bottom-4 landscape:left-1/2 landscape:w-[min(760px,80vw)] landscape:-translate-x-1/2",
      )}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="-mt-2 flex h-6 justify-center">
        <span className="frontier-handle mt-1" />
      </button>
      {/* The chosen card lifts; the row's top padding keeps it inside the scroller. */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 pt-3">
        {options.map((candidate, index) => (
          <BuildCard
            key={candidate.category}
            option={candidate}
            selected={index === chosen}
            buildable={canBuild(candidate)}
            onChoose={() => setChosen(index)}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={pending || !canBuild(option)}
        onClick={() => void build()}
        className="frontier-primary flex items-center justify-center gap-3"
      >
        Build
        {option.cost.map((cost) => (
          <PriceChip key={cost.resource} cost={cost} />
        ))}
      </button>
    </section>
  );
};

/** The chosen building stands on the plot as the scene's ghost while the sheet is open. */
const useBuildingGhost = (category: BuildingType | undefined, plot: HexPosition) => {
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  useEffect(() => {
    if (category === undefined) return;
    setPreviewBuilding({ type: category, plot: { col: plot.col, row: plot.row } });
    return () => setPreviewBuilding(null);
  }, [category, plot.col, plot.row, setPreviewBuilding]);
};

const BuildCard = ({
  option,
  selected,
  buildable,
  onChoose,
}: {
  option: BuildOption;
  selected: boolean;
  buildable: boolean;
  onChoose: () => void;
}) => (
  <button
    type="button"
    aria-pressed={selected}
    aria-label={BUILDING_NAMES[option.category]}
    onClick={onChoose}
    className={cn(
      "frontier-card relative flex w-[136px] shrink-0 snap-start flex-col items-center gap-1.5 px-2 pb-3 pt-2 transition-transform",
      !buildable && "opacity-60",
    )}
  >
    {option.doubled && (
      <span
        aria-label="Doubled on this plot"
        className="absolute right-1.5 top-1.5 rounded-full bg-[#9fd06a] px-1.5 text-[13px] font-extrabold text-[#1b1207]"
      >
        ×2
      </span>
    )}
    <img
      src={BUILDING_IMAGES_PATH[option.category as keyof typeof BUILDING_IMAGES_PATH]}
      alt=""
      className="h-16 w-full object-contain"
    />
    <span className="flex items-center gap-1.5">
      <span className="font-[Lexend] text-[15px] font-extrabold text-[#eadfc8]">{BUILDING_NAMES[option.category]}</span>
    </span>
    <EffectChip option={option} />
    <Chip label="Population" icon={<PersonGlyph />} value={formatAmount(option.populationCost)} />
    {option.wheat.change !== 0 && <WheatAfterChip after={option.wheat.after} />}
    {option.cost.map((cost) => (
      <PriceChip key={cost.resource} cost={cost} />
    ))}
  </button>
);

const ResourceImage = ({ resource }: { resource: ResourcesIds }) => (
  <img src={`/images/resources/${resource}.png`} alt="" />
);

/** What the building gives: what it makes an hour, the storage it adds, or the population room. */
const EffectChip = ({ option: { effect } }: { option: BuildOption }) => {
  if (effect.kind === "produces")
    return (
      <Chip
        label={`${ResourcesIds[effect.resource]} an hour`}
        icon={<ResourceImage resource={effect.resource} />}
        value={`+${formatAmount(effect.perHour)}/h`}
      />
    );
  if (effect.kind === "capacity")
    return <Chip label="Storage" icon={<Package />} value={`+${formatAmount(effect.amount)}`} />;
  return <Chip label="Population room" icon={<PersonGlyph />} value={`+${formatAmount(effect.amount)}`} />;
};

/** The realm's wheat an hour once the building stands: red when it would starve, green while it grows. */
const WheatAfterChip = ({ after }: { after: number | undefined }) => (
  <Chip
    label="Wheat an hour after"
    icon={<ResourceImage resource={ResourcesIds.Wheat} />}
    tone={after === undefined ? undefined : after < 0 ? "loss" : "gain"}
    value={after === undefined ? "—" : `${after > 0 ? "+" : ""}${formatAmount(after)}/h`}
  />
);

const PriceChip = ({ cost }: { cost: { resource: number; amount: number } }) => (
  <Chip
    tone="price"
    label={`Costs ${ResourcesIds[cost.resource]}`}
    icon={<ResourceImage resource={cost.resource} />}
    value={formatAmount(cost.amount)}
  />
);
