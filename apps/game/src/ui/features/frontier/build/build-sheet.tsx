import { AudioManager } from "@/audio/core/AudioManager";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getPlayerName } from "@/services/identity/player-profiles";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { formatAmount } from "@/ui/design-system/kit/amount";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import type { PriceKind } from "@/ui/design-system/kit/price-chip";
import { toast } from "@/ui/features/event-feed/notify";
import { knownBalance } from "@/ui/utils/utils";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { extractReadableErrorMessage } from "@/utils/error-message";
import {
  buildableRadius,
  configManager,
  getBalance,
  getRealmInfo,
  resolveUseSimpleCost,
} from "@bibliothecadao/eternum";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BUILDINGS_CENTER, BuildingType, getHexDistance, type HexPosition, ResourcesIds } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

import { useGoToFrontierPlace } from "../frontier-home";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { type BuildOption, readBuildOptions } from "./build-options";
import { type BuildGain, type BuildTile, BuildView } from "./build-view";
import { buildingName } from "./building-names";

const BUILD_MODELS = [
  "Building",
  "ResourceBalance",
  "ResourceProduction",
  "ResourceWeight",
  // A day's Support boosts the wheat the realm grows and its barracks eat.
  "RealmSupport",
  "Structure",
  "StructureBuildings",
  // What the realm has researched sets each building's tier, its price and what it gives.
  "RealmKnowledge",
  "ResearchNode",
  "BuildingTierRule",
] as const;

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
 * The build sheet over the game's facts: the buildings the plot can hold at the realm's researched tier, the chosen
 * one standing on the plot as a ghost, its gains, and Build, or the price the realm cannot pay yet with its wait.
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
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);
  const revision = useNativeRevision(BUILD_MODELS);
  const tick = useCurrentDefaultTick();
  const options = useMemo(
    () => readBuildOptions(setup.store, realm, plot, useSimpleCost, tick),
    [plot.col, plot.row, realm, revision, setup.store, tick, useSimpleCost],
  );
  const [chosen, setChosen] = useState(0);
  const option = options?.[chosen];
  const [sending, setSending] = useState(false);
  const goToPlace = useGoToFrontierPlace(realm);
  const mode = useGameModeConfig();
  const realmInfo = useMemo(
    () => getRealmInfo(realm.entity_id, setup.store, getPlayerName),
    [realm.entity_id, revision, setup.store],
  );
  useBuildingGhost(option?.category, plot);

  // Until the realm's research is known, no building's tier or price is.
  if (!options || !option) return null;

  const build = async () => {
    setSending(true);
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
      setSending(false);
    }
  };

  const held = (resource: number) => {
    const balance = knownBalance(getBalance(realm.entity_id, resource, tick, setup.store).balance);
    return balance === undefined ? undefined : Math.floor(balance);
  };
  const shortCost = option.cost.find(({ resource, amount }) => (held(resource) ?? 0) < amount);
  const buildable = resolveConstructionBuildability({
    entityId: realm.entity_id,
    buildingType: option.category,
    useSimpleCost,
    store: setup.store,
    realm: realmInfo,
    mode,
    targetSpot: plot,
  }).canSubmit;
  const freePopulation =
    realmInfo?.population === undefined || realmInfo.capacity === undefined
      ? undefined
      : realmInfo.capacity + configManager.getBasePopulationCapacity() - realmInfo.population;
  return (
    <BuildView
      tiles={options.map((candidate) => buildTile(candidate, held(ResourcesIds.Labor)))}
      chosen={chosen}
      onChoose={setChosen}
      gains={buildGains(option)}
      prices={option.cost.map(({ resource, amount }) => ({ of: priceKind(resource), amount }))}
      short={
        shortCost
          ? {
              kind: "short",
              icon: iconOf(shortCost.resource),
              held: held(shortCost.resource),
              need: shortCost.amount,
              wait: secondsUntilHeld(
                held(shortCost.resource),
                shortCost.amount,
                realmPerHour(setup.store, realm.entity_id, shortCost.resource, tick),
              ),
            }
          : buildable
            ? undefined
            : { kind: "short", icon: "Pp", held: freePopulation, need: option.populationCost }
      }
      sending={sending}
      onBuild={() => void build()}
      onMap={() => {
        onClose();
        goToPlace(true);
      }}
      onClose={onClose}
    />
  );
};

const BUILDING_ICONS: Partial<Record<BuildingType, IconCode>> = {
  [BuildingType.ResourceWheat]: "Fm",
  [BuildingType.ResourceLabor]: "Wk",
  [BuildingType.ResourceKnightT1]: "Bs",
  [BuildingType.WorkersHut]: "Ht",
};

const RESOURCE_ICONS: Partial<Record<number, IconCode>> = {
  // A barracks trains the troops of its tier: one troop type, drawn as troops.
  [ResourcesIds.Knight]: "Tr",
  [ResourcesIds.KnightT2]: "Tr",
  [ResourcesIds.KnightT3]: "Tr",
  [ResourcesIds.Labor]: "La",
  [ResourcesIds.Wheat]: "Wh",
  [ResourcesIds.Essence]: "Es",
};

const PRICE_KINDS: Partial<Record<number, PriceKind>> = {
  [ResourcesIds.Labor]: "labor",
  [ResourcesIds.Wheat]: "wheat",
  [ResourcesIds.Essence]: "essence",
};

/** A price's resource as the kit draws it; a building priced in anything else is loud. */
const priceKind = (resource: number): PriceKind => {
  const kind = PRICE_KINDS[resource];
  if (!kind) throw new Error(`A Frontier building is priced in resource ${resource}`);
  return kind;
};

const iconOf = (resource: number): IconCode => {
  const icon = RESOURCE_ICONS[resource];
  if (!icon) throw new Error(`No icon for resource ${resource}`);
  return icon;
};

const buildTile = (option: BuildOption, labor: number | undefined): BuildTile => {
  const icon = BUILDING_ICONS[option.category];
  if (!icon) throw new Error(`No icon for building ${option.category}`);
  const price = option.cost.find(({ resource }) => resource === ResourcesIds.Labor)?.amount ?? 0;
  return {
    key: String(option.category),
    icon,
    name: buildingName(option.category),
    foot: { kind: "price", labor: price, short: labor === undefined || labor < price },
  };
};

/** The chosen building's gains: what it makes an hour or the population room it adds, its population, the ×2. */
const buildGains = (option: BuildOption): BuildGain[] => {
  const { effect } = option;
  const gain: BuildGain =
    effect.kind === "produces"
      ? { icon: iconOf(effect.resource), value: `+${formatAmount(effect.perHour)}/h`, label: "produces" }
      : { icon: "Pp", value: `+${formatAmount(effect.amount)}`, label: "houses" };
  return [
    gain,
    { icon: "Pp", value: formatAmount(option.populationCost), label: "population" },
    ...(option.doubled ? [{ icon: "Hx" as const, value: "×2", label: "marked plot" }] : []),
  ];
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
