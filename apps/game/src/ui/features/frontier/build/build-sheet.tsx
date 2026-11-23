import { rankName } from "@bibliothecadao/types";
import { usePlayerNames } from "@/hooks/use-player-profile";
import { AudioManager } from "@/audio/core/AudioManager";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useAllInFlight, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";

import { PRICE_FACES, type PriceKind } from "@/ui/design-system/kit/price-faces";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import {
  makes,
  ONE_A_REALM,
  priceRaised,
  startsNewArmies,
  storesMore,
  type RankedWords,
} from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { knownAmount } from "@/ui/utils/utils";
import { plotKey, sendBuilding, useStillShowing } from "@/ui/features/settlement/construction/send-building";
import { canIssueOrders } from "@/utils/can-issue-orders";
import {
  buildableRadius,
  configManager,
  getBalance,
  getRealmInfo,
  resolveUseSimpleCost,
} from "@bibliothecadao/eternum";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  BUILDINGS_CENTER,
  BuildingType,
  formatAmount,
  formatPercent,
  formatRate,
  getHexDistance,
  type HexPosition,
} from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

import { realmPerHour, secondsUntilHeld } from "../hud/army-order";

import { FRONTIER_STORES, madeStore, STORE_KINDS } from "../stores";
import { usePartShown } from "../opening/opening-context";
import { type BuildOption, readBuildOptions } from "./build-options";
import { disclosedBuildOptions } from "./first-build";
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

export const BuildSheet = ({
  realm,
  plot,
  onClose,
}: {
  realm: NativeRows["Structure"];
  plot: HexPosition;
  /** Opens Research, where two Barracks purchases unlock training buildings. */
  onClose: () => void;
}) => {
  const { setup } = useGame();
  const realmId = safeInteger(realm.entity_id);
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);
  const facts = useNativeFacts(BUILD_MODELS);
  const tick = useCurrentDefaultTick();
  // Until the first Barracks stands the sheet offers it alone: the list of buildings opens with it.
  const listOpen = usePartShown("building-list");
  const options = useMemo(
    () => disclosedBuildOptions(readBuildOptions(facts.store, realm, useSimpleCost, tick), listOpen),
    [realm, facts, tick, useSimpleCost, listOpen],
  );
  const [picked, setPicked] = useState<BuildingType | null>(null);
  const indexOf = (category: BuildingType | null) =>
    options?.findIndex((candidate) => candidate.category === category) ?? -1;
  const firstBuild = useUIStore((state) => state.firstBuild);
  const chosen = Math.max(indexOf(picked ?? firstBuild), 0);
  const option = options?.[chosen];
  const sending = useInFlight("plot", plotKey(realmId, plot)) !== undefined;
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
  const standing = (): Refusal | undefined => {
    if (option.standing === "built") return { reason: { kind: "failed", line: ONE_A_REALM } };
    if (option.standing !== "open")
      return { reason: { kind: "failed", line: `Requires ${rankName(option.standing.level)}` } };
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
    return { reason: { kind: "failed", line: verdict.reason ?? "" } };
  };
  const holdings: Holdings = {
    held,
    perHour: (resource) => realmPerHour(setup.store, realmId, resource, tick),
  };
  return (
    <BuildView
      tiles={options.map((candidate) => buildTile(candidate, holdings))}
      chosen={chosen}
      onChoose={(index) => setPicked(options[index]!.category)}
      prices={option.cost.map(({ resource, amount }) => ({ of: priceKind(resource), amount }))}
      refusal={standing()}
      sending={sending}
      onBuild={() => void build()}
      onClose={onClose}
    />
  );
};

/** A price's resource as the kit draws it, the realm store that holds it; a building priced in anything else is loud. */
const priceKind = (resource: number): PriceKind => {
  const kind = STORE_KINDS.find((store) => FRONTIER_STORES[store].resource === resource);
  if (!kind || !isPriceKind(kind)) throw new Error(`A Frontier building is priced in resource ${resource}`);
  return kind;
};

const isPriceKind = (kind: string): kind is PriceKind => kind in PRICE_FACES;

type Holdings = {
  held: (resource: number) => number | undefined;
  perHour: (resource: number) => number | undefined;
};

const buildTile = (option: BuildOption, holdings: Holdings): BuildTile => ({
  key: String(option.category),
  icon: buildingIcon(option.category),
  name: buildingName(option.category),
  tip: buildingLine(option),
  gives: givesOf(option),
  gems: gemsOf(option),
  standing: standingOf(option, holdings),
});

const standingOf = (option: BuildOption, { held, perHour }: Holdings): BuildTile["standing"] => {
  if (option.standing === "built") return { kind: "built" };
  if (option.standing !== "open") return { kind: "level", level: option.standing.level };
  const missing = option.cost.find(({ resource, amount }) => (held(resource) ?? 0) < amount);
  const short: Extract<BuildTile["standing"], { kind: "price" }>["short"] = missing
    ? {
        of: priceKind(missing.resource),
        wait: secondsUntilHeld(held(missing.resource), missing.amount, perHour(missing.resource)),
      }
    : undefined;
  return {
    kind: "price",
    prices: option.cost.map(({ resource, amount }) => ({
      of: priceKind(resource),
      amount,
      short: (held(resource) ?? 0) < amount,
    })),
    raised: riseLine(option),
    short,
  };
};

const buildingLine = (option: BuildOption): RankedWords => {
  const { effect } = option;
  const does: RankedWords =
    effect.kind === "produces"
      ? [makes(FRONTIER_STORES[madeStore(effect.resource)].word, formatRate(effect.output.total))]
      : effect.kind === "trains"
        ? startsNewArmies(effect.attribute, option.tier)
        : effect.kind === "research"
          ? [effect.line]
          : [storesMore(storageShare(effect.shareBps))];
  return [`${buildingName(option.category)}: `, ...does];
};

/** Why a price is above its first: the copies standing raise it. None when no copy stands yet. */
const riseLine = (option: BuildOption): string | undefined =>
  option.rise.times > 1 ? priceRaised(formatAmount(option.rise.standing)) : undefined;

const gemsOf = ({ effect, tier }: BuildOption): BuildTile["gems"] => (effect.kind === "stores" ? [] : [{ tier }]);

const storageShare = (bps: number) => formatPercent(bps / 10_000, { signed: true });

const givesOf = ({ effect }: BuildOption): BuildTile["gives"] =>
  effect.kind === "produces"
    ? { icon: FRONTIER_STORES[madeStore(effect.resource)].icon, value: formatRate(effect.output.total) }
    : effect.kind === "trains"
      ? { icon: "stamina" }
      : effect.kind === "research"
        ? { icon: effect.icon }
        : { icon: "storehouse", value: storageShare(effect.shareBps) };

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
