import { AudioManager } from "@/audio/core/AudioManager";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { sendOnce, useAllInFlight, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { getPlayerName } from "@/services/identity/player-profiles";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import type { PriceKind } from "@/ui/design-system/kit/price-chip";
import type { Refusal } from "@/ui/design-system/kit/refused-verb";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import {
  BARRACKS,
  BUILD,
  HUT,
  LABOR,
  makesAnHour,
  needsAt,
  ONE_A_REALM,
  POPULATION,
  priceRaised,
  RESEARCH,
  startsNewArmies,
  takesPopulation,
  TIER_WORDS,
} from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { knownBalance } from "@/ui/utils/utils";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { extractReadableErrorMessage } from "@/utils/error-message";
import {
  buildableRadius,
  configManager,
  getBalance,
  getBuildingQuantity,
  getRealmInfo,
  resolveUseSimpleCost,
} from "@bibliothecadao/eternum";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { BUILDINGS_CENTER, BuildingType, getHexDistance, type HexPosition, ResourcesIds } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

import { useGoToFrontierPlace } from "../frontier-home";
import { exploreFix } from "../frontier-reveal-yield";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { type BuildOption, PRODUCTS, readBuildOptions } from "./build-options";
import { type BuildGain, type BuildTile, BuildView } from "./build-view";
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
  onResearch,
  onClose,
}: {
  realm: NativeRows["Structure"];
  plot: HexPosition;
  /** Opens Research, where the Barracks' tier that gates the training buildings is raised. */
  onResearch?: () => void;
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
  const sending = useInFlight("plot", plotKey(realmId, plot)) !== undefined;
  const goToPlace = useGoToFrontierPlace(realm);
  const mode = useGameModeConfig();
  const realmInfo = useMemo(
    () => getRealmInfo(safeInteger(realm.entity_id), setup.store, getPlayerName),
    [realm.entity_id, revision, setup.store],
  );
  useBuildingGhost(option?.category, plot);

  // Until the realm's research is known, no building's tier or price is.
  if (!options || !option) return null;

  /** The sheet closes as the building leaves; its ghost stays on the plot until the build's own outcome. */
  const build = async () => {
    const building = { type: option.category, plot: { col: plot.col, row: plot.row } };
    try {
      await sendOnce("plot", plotKey(realmId, plot), building, async () => {
        const sent = await requireActiveGameClient().actions.placeBuilding({
          structureId: realmId,
          buildingType: option.category,
          hex: plot,
          useSimpleCost,
        });
        AudioManager.getInstance().play("ui.build_place");
        onClose();
        return sent;
      });
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The building could not be placed."));
    }
  };

  const held = (resource: number) => {
    const balance = knownBalance(getBalance(safeInteger(realm.entity_id), resource, tick, setup.store).balance);
    return balance === undefined ? undefined : Math.floor(balance);
  };
  const population = realmPopulation(realmInfo);
  const choose = (category: BuildingType) =>
    setChosen(options.findIndex((candidate) => candidate.category === category));
  const priceOf = (category: BuildingType) =>
    options
      .find((candidate) => candidate.category === category)!
      .cost.map(({ resource, amount }) => ({ of: priceKind(resource), amount }));
  const refusal = (): Refusal | undefined => {
    if (option.standing === "built") return { reason: { kind: "failed", line: ONE_A_REALM } };
    if (option.standing !== "open") return gateRefusal(option.standing.gate);
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
        fix: exploreFix(shortCost.resource, () => {
          onClose();
          goToPlace(true);
        }),
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
        prices: priceOf(BuildingType.WorkersHut),
        onFix: () => choose(BuildingType.WorkersHut),
      },
    };
  };
  /**
   * A training building waits for the Barracks row's tier (the contract's assert_board_category): Research raises it
   * once a Barracks stands, and until one does the fix is to build it.
   */
  const gateRefusal = (gate: number): Refusal => {
    const reason = { kind: "failed", line: needsAt(BARRACKS, TIER_WORDS[gate]) } as const;
    if (getBuildingQuantity(realmId, BuildingType.ResourceKnightT1, setup.store) === 0)
      return {
        reason,
        fix: {
          word: `${BUILD} ${BARRACKS}`,
          prices: priceOf(BuildingType.ResourceKnightT1),
          onFix: () => choose(BuildingType.ResourceKnightT1),
        },
      };
    return { reason, fix: onResearch && { icon: "Rs", word: RESEARCH, onFix: onResearch } };
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

/** Each attribute's mark, as a training building's gain shows it. */
const ATTRIBUTE_MARKS: Record<Extract<BuildOption["effect"], { kind: "trains" }>["attribute"], IconCode> = {
  Battle: "Ba",
  Logistics: "Lg",
  Scouting: "Sc",
  Homecoming: "Su",
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

const buildTile = (option: BuildOption, labor: number | undefined): BuildTile => {
  const icon = buildingIcon(option.category);
  const price = option.cost.find(({ resource }) => resource === ResourcesIds.Labor)?.amount ?? 0;
  return {
    key: String(option.category),
    icon,
    name: buildingName(option.category),
    tip: buildingLine(option),
    foot:
      option.standing === "built"
        ? { kind: "built" }
        : option.standing === "open"
          ? {
              kind: "price",
              labor: price,
              short: labor === undefined || labor < price,
              raised: riseLine(option, price),
            }
          : // The gate is a research tier above common; the kit counts tiers from common.
            { kind: "locked", gate: (option.standing.gate + 1) as Tier },
  };
};

const times = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * What a building does, in one line from its real effect: "Farm: +302 wheat an hour, takes 1 population". A training
 * building starts every new army at its type's tier in its attribute.
 */
const buildingLine = (option: BuildOption): string => {
  const { effect } = option;
  const does =
    effect.kind === "produces"
      ? makesAnHour(formatAmount(effect.perHour), PRODUCTS[effect.resource].word)
      : effect.kind === "trains"
        ? startsNewArmies(effect.attribute, TIER_WORDS[option.tier - 1])
        : `+${formatAmount(effect.amount)} ${POPULATION}`;
  const takes = option.populationCost > 0 ? `, ${takesPopulation(formatAmount(option.populationCost))}` : "";
  return `${buildingName(option.category)}: ${does}${takes}`;
};

/**
 * Why a price is above its base, as the contract charges it: the copies standing multiply it. None when no copy
 * stands yet.
 */
const riseLine = (option: BuildOption, price: number): string | undefined =>
  option.rise.times > 1
    ? priceRaised(
        formatExact(price / option.rise.times),
        LABOR,
        times.format(option.rise.times),
        formatAmount(option.rise.standing),
      )
    : undefined;

/**
 * The chosen building's gains: what it makes an hour, the population room it adds or the tier a training building
 * starts each new army at, and its population.
 */
const buildGains = (option: BuildOption): BuildGain[] => {
  const { effect } = option;
  const gain: BuildGain =
    effect.kind === "produces"
      ? { icon: PRODUCTS[effect.resource].icon, value: `+${formatAmount(effect.perHour)}/h`, label: "produces" }
      : effect.kind === "trains"
        ? { icon: ATTRIBUTE_MARKS[effect.attribute], value: TIER_WORDS[option.tier - 1], label: "trains" }
        : { icon: "Pp", value: `+${formatAmount(effect.amount)}`, label: "houses" };
  return [gain, { icon: "Pp", value: formatAmount(option.populationCost), label: "population" }];
};

/** A realm's plot, as the actions in flight name it. */
const plotKey = (realmId: number, plot: HexPosition): string => `${realmId}:${plot.col},${plot.row}`;

/**
 * A building sent and not yet known keeps standing on its plot as the scene's ghost, which is where the player looks
 * once the sheet has closed. An open build sheet's own choice takes the ghost while it is open.
 */
export const BuildingsInFlight = () => {
  const [building] = [...useAllInFlight("plot").values()];
  const preview = useUIStore((state) => state.previewBuilding);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  useEffect(() => {
    if (building && preview === null) setPreviewBuilding(building);
  }, [building, preview, setPreviewBuilding]);
  useEffect(() => {
    if (!building) return;
    return () => {
      if (useUIStore.getState().previewBuilding === building) setPreviewBuilding(null);
    };
  }, [building, setPreviewBuilding]);
  return null;
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
