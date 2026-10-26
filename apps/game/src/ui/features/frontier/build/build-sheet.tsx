import { usePlayerNames } from "@/hooks/use-player-profile";
import { AudioManager } from "@/audio/core/AudioManager";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useAllInFlight, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";

import { HudTier } from "@/ui/design-system/kit/hud-elements";
import type { PriceKind } from "@/ui/design-system/kit/price-faces";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import {
  type Tier,
  BARRACKS,
  BUILD,
  HUT,
  makes,
  needsTier,
  tierNumeral,
  ONE_A_REALM,
  POPULATION,
  priceRaised,
  RESEARCH,
  startsNewArmies,
  takesPopulation,
} from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { knownAmount } from "@/ui/utils/utils";
import { plotKey, sendBuilding, useStillShowing } from "@/ui/features/settlement/construction/send-building";
import { canIssueOrders } from "@/utils/can-issue-orders";
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
import {
  BUILDINGS_CENTER,
  BuildingType,
  formatAmount,
  formatCharge,
  formatGain,
  formatRate,
  getHexDistance,
  ResourcesIds,
  type HexPosition,
} from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

import { useGoToFrontierPlace } from "../frontier-home";
import { readRealmPopulation } from "../realm/realm-population";
import { exploreFix } from "../frontier-reveal-yield";
import { outputWhy } from "../production/store-makers";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { ATTRIBUTE_MARKS } from "../research/research-tree";
import { type BuildOption, PRODUCTS, readBuildOptions } from "./build-options";
import { type BuildTile, BuildView } from "./build-view";
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
  const facts = useNativeFacts(BUILD_MODELS);
  const tick = useCurrentDefaultTick();
  const options = useMemo(
    () => readBuildOptions(facts.store, realm, useSimpleCost, tick),
    [realm, facts, tick, useSimpleCost],
  );
  const [chosen, setChosen] = useState(0);
  const option = options?.[chosen];
  const sending = useInFlight("plot", plotKey(realmId, plot)) !== undefined;
  const goToPlace = useGoToFrontierPlace(realm);
  const mode = useGameModeConfig();
  const names = usePlayerNames();
  const realmInfo = useMemo(
    () => getRealmInfo(safeInteger(realm.entity_id), facts.store, names.text),
    [realm.entity_id, facts, names],
  );
  useBuildingGhost(option?.category, plot);
  const stillShowing = useStillShowing(plot);

  // Until the realm's research is known, no building's tier or price is.
  if (!options || !option) return null;

  /**
   * The sheet closes as the building leaves, if it still shows this plot; its ghost stays on the plot until the
   * build's own outcome.
   */
  const build = async () => {
    AudioManager.getInstance().play("ui.build_place");
    try {
      await sendBuilding({
        realmId,
        type: option.category,
        plot,
        useSimpleCost,
        from: { isOpen: stillShowing, close: onClose },
      });
    } catch (error) {
      toast.failed(error, "The building could not be placed.");
    }
  };

  const held = (resource: number) =>
    knownAmount(getBalance(safeInteger(realm.entity_id), resource, tick, setup.store).balance);
  const population = readRealmPopulation(setup.store, realmId);
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
        held: population && population.total - population.used,
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
    const reason = { kind: "failed", line: needsTier(BARRACKS, tierNumeral(gateTier(gate))) } as const;
    if (getBuildingQuantity(realmId, BuildingType.ResourceKnightT1, setup.store) === 0)
      return {
        reason,
        fix: {
          word: `${BUILD} ${BARRACKS}`,
          prices: priceOf(BuildingType.ResourceKnightT1),
          onFix: () => choose(BuildingType.ResourceKnightT1),
        },
      };
    return { reason, fix: onResearch && { icon: "research", word: RESEARCH, onFix: onResearch } };
  };
  return (
    <BuildView
      population={population}
      tiles={options.map((candidate) =>
        buildTile(candidate, {
          labor: held(ResourcesIds.Labor),
          laborPerHour: realmPerHour(setup.store, realmId, ResourcesIds.Labor, tick),
          free: population && population.total - population.used,
        }),
      )}
      chosen={chosen}
      onChoose={setChosen}
      prices={option.cost.map(({ resource, amount }) => ({ of: priceKind(resource), amount }))}
      refusal={refusal()}
      sending={sending}
      onBuild={() => void build()}
      onClose={onClose}
    />
  );
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

/** What the realm holds that a card weighs its building against: labor and how fast it comes, and free population. */
type Holdings = { labor: number | undefined; laborPerHour: number | undefined; free: number | undefined };

const buildTile = (option: BuildOption, holdings: Holdings): BuildTile => ({
  key: String(option.category),
  icon: buildingIcon(option.category),
  name: buildingName(option.category),
  tip: buildingLine(option),
  gives: givesOf(option),
  takes: option.populationCost,
  standing: standingOf(option, holdings),
});

/** The Barracks tier a training building waits for: a research tier above common, which the kit counts from common. */
const gateTier = (gate: number) => (gate + 1) as Exclude<Tier, 1>;

/**
 * Where a building stands for the realm, the first that holds: built (a realm holds one), locked behind the Barracks'
 * tier, or its price, with the labor the realm lacks and the wait until it holds it, or else the population it lacks.
 */
const standingOf = (option: BuildOption, { labor, laborPerHour, free }: Holdings): BuildTile["standing"] => {
  if (option.standing === "built") return { kind: "built" };
  if (option.standing !== "open") return { kind: "locked", gate: gateTier(option.standing.gate) };
  const price = option.cost.find(({ resource }) => resource === ResourcesIds.Labor)?.amount ?? 0;
  const short: Extract<BuildTile["standing"], { kind: "price" }>["short"] =
    labor === undefined || labor < price
      ? { of: "labor", wait: secondsUntilHeld(labor, price, laborPerHour) }
      : free !== undefined && free < option.populationCost
        ? { of: "population" }
        : undefined;
  return { kind: "price", labor: price, raised: riseLine(option), short };
};

/**
 * What a building does, in one line from its real effect: "Farm: +302 wheat an hour, takes 1 population". A training
 * building starts every new army at its type's tier in its attribute.
 */
const buildingLine = (option: BuildOption): string => {
  const { effect } = option;
  const does =
    effect.kind === "produces"
      ? makes(PRODUCTS[effect.resource].word, formatRate(effect.output.total))
      : effect.kind === "trains"
        ? startsNewArmies(effect.attribute, tierNumeral(option.tier))
        : `${formatGain(effect.amount)} ${POPULATION}`;
  const takes = option.populationCost > 0 ? `, ${takesPopulation(formatCharge(option.populationCost))}` : "";
  return `${buildingName(option.category)}: ${does}${takes}`;
};

/** Why a price is above its first: the copies standing raise it. None when no copy stands yet. */
const riseLine = (option: BuildOption): string | undefined =>
  option.rise.times > 1 ? priceRaised(formatAmount(option.rise.standing)) : undefined;

/** What one more gives: what it makes a minute, the population room it adds, or the tier new armies start at. */
const givesOf = ({ effect, tier }: BuildOption): BuildTile["gives"] =>
  effect.kind === "produces"
    ? {
        icon: PRODUCTS[effect.resource].icon,
        value: formatRate(effect.output.total),
        basis: outputWhy(effect.research),
      }
    : effect.kind === "trains"
      ? { icon: ATTRIBUTE_MARKS[effect.attribute], value: <HudTier tier={tier} /> }
      : { icon: "person", value: formatGain(effect.amount) };

/** A realm's plot, as the actions in flight name it. */

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
