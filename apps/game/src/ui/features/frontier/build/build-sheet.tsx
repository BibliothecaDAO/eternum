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
import { PRICE_FACES, type PriceKind } from "@/ui/design-system/kit/price-chip";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { BUILD, exploreFor, HUT, TIER_WORDS } from "@/ui/design-system/kit/words";
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
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BUILDINGS_CENTER, BuildingType, getHexDistance, type HexPosition, ResourcesIds } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

import { useGoToFrontierPlace } from "../frontier-home";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { type BuildOption, readBuildOptions } from "./build-options";
import { type BuildGain, type BuildRefusal, type BuildTile, BuildView } from "./build-view";
import { buildingIcon, buildingName } from "./building-names";

const BUILD_MODELS = [
  "Building",
  "ResourceBalance",
  "ResourceProduction",
  "ResourceWeight",
  "Structure",
  "StructureBuildings",
  // What the realm has researched sets what each building type gives.
  "RealmKnowledge",
  "BoardRules",
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
  if (isMapView || !ordersAllowed || !realm || !selected || selected.structureId !== safeInteger(realm.entity_id))
    return null;
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
  const realmId = safeInteger(realm.entity_id);
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);
  const revision = useNativeRevision(BUILD_MODELS);
  const tick = useCurrentDefaultTick();
  const options = useMemo(
    () => readBuildOptions(setup.store, realm, useSimpleCost, tick),
    [realm, revision, setup.store, tick, useSimpleCost],
  );
  const [chosen, setChosen] = useState(0);
  const option = options?.[chosen];
  const [sending, setSending] = useState(false);
  const goToPlace = useGoToFrontierPlace(realm);
  const mode = useGameModeConfig();
  const realmInfo = useMemo(
    () => getRealmInfo(safeInteger(realm.entity_id), setup.store, getPlayerName),
    [realm.entity_id, revision, setup.store],
  );
  useBuildingGhost(option?.category, plot);

  // Until the realm's research is known, no building's tier or price is.
  if (!options || !option) return null;

  const build = async () => {
    setSending(true);
    try {
      await requireActiveGameClient().actions.placeBuilding({
        structureId: realmId,
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
    const balance = knownBalance(getBalance(safeInteger(realm.entity_id), resource, tick, setup.store).balance);
    return balance === undefined ? undefined : Math.floor(balance);
  };
  const population = realmPopulation(realmInfo);
  const refusal = (): BuildRefusal | undefined => {
    const shortCost = option.cost.find(({ resource, amount }) => (held(resource) ?? 0) < amount);
    if (shortCost) {
      const have = held(shortCost.resource);
      const perHour = realmPerHour(setup.store, realmId, shortCost.resource, tick);
      return {
        reason: {
          kind: "short",
          of: priceKind(shortCost.resource),
          held: have,
          need: shortCost.amount,
          wait: secondsUntilHeld(have, shortCost.amount, perHour),
        },
        fix: revealsPay(shortCost.resource)
          ? {
              icon: "Mp",
              word: exploreFor(PRICE_FACES[priceKind(shortCost.resource)].word),
              onFix: () => {
                onClose();
                goToPlace(true);
              },
            }
          : undefined,
      };
    }
    const verdict = resolveConstructionBuildability({
      entityId: realmId,
      buildingType: option.category,
      useSimpleCost,
      store: setup.store,
      realm: realmInfo,
      mode,
      targetSpot: plot,
    });
    if (verdict.canSubmit) return undefined;
    if (verdict.code !== "insufficient_population" && verdict.code !== "insufficient_capacity")
      return { reason: { kind: "failed", line: verdict.reason ?? "" } };
    const hut = options.findIndex(({ category }) => category === BuildingType.WorkersHut);
    return {
      reason: {
        kind: "short",
        of: "population",
        counted: "free",
        held: population.free,
        need: option.populationCost,
      },
      fix: {
        word: `${BUILD} ${HUT}`,
        prices: options[hut].cost.map(({ resource, amount }) => ({ of: priceKind(resource), amount })),
        onFix: () => setChosen(hut),
      },
    };
  };
  return (
    <BuildView
      population={population}
      tiles={options.map((candidate) => buildTile(candidate, held(ResourcesIds.Labor)))}
      chosen={chosen}
      onChoose={setChosen}
      gains={buildGains(option)}
      prices={option.cost.map(({ resource, amount }) => ({ of: priceKind(resource), amount }))}
      refusal={refusal()}
      sending={sending}
      onBuild={() => void build()}
      onClose={onClose}
    />
  );
};

/**
 * The realm's population as the contract counts it: what its buildings take against what the castle and the Huts
 * give, and what is free of it.
 */
const realmPopulation = (
  realm: ReturnType<typeof getRealmInfo>,
): { free: number | undefined; total: number | undefined } => {
  if (realm?.population === undefined || realm.capacity === undefined) return { free: undefined, total: undefined };
  const total = realm.capacity + configManager.getBasePopulationCapacity();
  return { free: total - realm.population, total };
};

/** Whether exploring the map can pay a shortfall: in a game whose reveals pay supplies, each pays Essence or labor. */
const revealsPay = (resource: number) =>
  configManager.paysRevealSupplies() && (resource === ResourcesIds.Labor || resource === ResourcesIds.Essence);

/** Each attribute's mark, as a training building's gain shows it. */
const ATTRIBUTE_MARKS: Record<Extract<BuildOption["effect"], { kind: "trains" }>["attribute"], IconCode> = {
  Battle: "Ba",
  Logistics: "Lg",
  Scouting: "Sc",
  Homecoming: "Su",
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
  const icon = buildingIcon(option.category);
  const price = option.cost.find(({ resource }) => resource === ResourcesIds.Labor)?.amount ?? 0;
  return {
    key: String(option.category),
    icon,
    name: buildingName(option.category),
    foot:
      option.standing === "built"
        ? { kind: "built" }
        : option.standing === "open"
          ? { kind: "price", labor: price, short: labor === undefined || labor < price }
          : // The gate is a research tier above common; the kit counts tiers from common.
            { kind: "locked", gate: (option.standing.gate + 1) as Tier },
  };
};

/**
 * The chosen building's gains: what it makes an hour, the population room it adds or the tier a training building
 * starts each new army at, and its population.
 */
const buildGains = (option: BuildOption): BuildGain[] => {
  const { effect } = option;
  const gain: BuildGain =
    effect.kind === "produces"
      ? { icon: iconOf(effect.resource), value: `+${formatAmount(effect.perHour)}/h`, label: "produces" }
      : effect.kind === "trains"
        ? { icon: ATTRIBUTE_MARKS[effect.attribute], value: TIER_WORDS[option.tier - 1], label: "trains" }
        : { icon: "Pp", value: `+${formatAmount(effect.amount)}`, label: "houses" };
  return [gain, { icon: "Pp", value: formatAmount(option.populationCost), label: "population" }];
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
