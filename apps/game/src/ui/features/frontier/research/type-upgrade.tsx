import { type IconMeaning } from "@/ui/design-system/icon";
import { useGame } from "@/hooks/context/game-context";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Chip } from "@/ui/design-system/kit/chip";

import type { Reason } from "@/ui/design-system/kit/reason-plate";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import type { Fix } from "@/ui/design-system/kit/refused-verb";
import {
  BUILDING_FIGURES,
  CASTLE,
  forNewArmies,
  LABOR,
  POPULATION,
  TIER_WORDS,
  TROOPS,
  WHEAT,
} from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import {
  configManager,
  type ExpeditionRules,
  getBuildingQuantity,
  rationedWheatPerTroop,
  researchChoice,
  researchTier,
  ResourceManager,
  scoutingIncrementBps,
} from "@bibliothecadao/eternum";
import {
  safeInteger,
  nativeResearchConstants as research,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

import { KindChoice } from "../army/army-sheet";
import { ATTRIBUTE_LOOK, type Attribute, nextTierPrice } from "../attributes/attributes";
import { outputPerHour, PRODUCTS, readBuildingEffect } from "../build/build-options";
import { buildingIcon, buildingName } from "../build/building-names";
import { useGoToFrontierPlace } from "../frontier-home";
import { exploreFix } from "../frontier-reveal-yield";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { armyArt } from "../hud/dock-armies";
import { useRealmStores } from "../realm-stores";
import { TrainingGives } from "../upgrade/training-gives";
import { type Figure, TypeUpgradeSheet } from "../upgrade/type-upgrade-sheet";
import type { TypeRowView } from "./research-plan";
import { researchKey, sendResearch } from "./send-research";

/** Each choosing row's sides: their marks, names and what each adds to every building of the type. */
const SIDE_NAMES: Partial<Record<number, readonly [[IconMeaning, string], [IconMeaning, string]]>> = {
  [research.ROW_FARM]: [
    ["fields", "Fields"],
    ["granary", "Granary"],
  ],
  [research.ROW_WORKSHOP]: [
    ["tools", "Tools"],
    ["storehouse", "Storeroom"],
  ],
  [research.ROW_BARRACKS]: [
    ["drill", "Drill"],
    ["rations", "Rations"],
  ],
};

/** Each training row's attribute and its Aspect mark. */
const TRAINING: Partial<Record<number, { attribute: Attribute; mark: IconMeaning }>> = {
  [research.ROW_WAR_HALL]: { attribute: "Battle", mark: "order-rage" },
  [research.ROW_SUPPLY_YARD]: { attribute: "Logistics", mark: "order-skill" },
  [research.ROW_SCOUTS_LODGE]: { attribute: "Scouting", mark: "order-detection" },
  [research.ROW_HEARTH]: { attribute: "Homecoming", mark: "order-enlightenment" },
};

type ScoutKey = "camp" | "rift" | "stragglers";
const SCOUT_KEYS: ScoutKey[] = ["camp", "rift", "stragglers"];

/**
 * A building type's Upgrade sheet over the game's facts: its tier now and next, its two sides with what each adds to
 * every building of the type (or what a hut or a training building's next tier gives), and Upgrade with the next
 * tier's Essence and labor, which sends research with the lifted side or the Scouts' lodge's kind. When the realm
 * cannot pay, the price held against what it has and the step: the map for Essence or labor, the castle when the
 * labor price is above the labor store's limit.
 */
export const TypeUpgrade = ({
  realm,
  rules,
  view,
  essence,
  onResearch,
  onClose,
}: {
  realm: NativeRows["Structure"];
  rules: ExpeditionRules;
  view: TypeRowView;
  essence: number | undefined;
  /** Opens Research, when the sheet opened from a building on the board. */
  onResearch?: () => void;
  onClose: () => void;
}) => {
  const { setup, account } = useGame();
  const tick = useCurrentDefaultTick();
  const stores = useRealmStores(realm, rules);
  const labor = stores?.labor;
  const goToPlace = useGoToFrontierPlace(realm);
  const [lifted, setLifted] = useState<0 | 1 | undefined>(undefined);
  const [kind, setKind] = useState<ScoutKey>("camp");
  const sending = useInFlight("research", researchKey(realm, view.row)) !== undefined;
  const sides = sideCards(setup.store, realm, view);
  const choice = view.row === research.ROW_SCOUTS_LODGE ? SCOUT_KEYS.indexOf(kind) : (lifted ?? 0);

  const upgrade = async () => {
    try {
      await sendResearch(setup.systemCalls, account.account, realm, { row: view.row, choice }, onClose);
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The Upgrade could not be sent."));
    }
  };

  const go = (expedition: boolean) => {
    onClose();
    goToPlace(expedition);
  };
  const short =
    view.next &&
    shortfall(view.next, essence, labor, {
      essenceWait: secondsUntilHeld(
        essence,
        view.next.essence,
        realmPerHour(setup.store, safeInteger(realm.entity_id), ResourcesIds.Essence, tick),
      ),
      laborWait: secondsUntilHeld(labor?.amount, view.next.labor, labor?.perHour),
    });

  return (
    <TypeUpgradeSheet
      icon={buildingIcon(view.category)}
      name={buildingName(view.category)}
      now={standingFigures(setup.store, realm, view, stores)}
      tier={(view.tier + 1) as Tier}
      sides={sides}
      lifted={lifted}
      onLift={setLifted}
      gives={typeGives(setup.store, realm, view, kind, setKind)}
      prices={
        view.next
          ? [
              { of: "essence", amount: view.next.essence },
              { of: "labor", amount: view.next.labor },
            ]
          : []
      }
      refusal={short && { reason: short, fix: shortfallFix(short, go) }}
      sending={sending}
      onUpgrade={() => void upgrade()}
      onResearch={onResearch}
      onClose={onClose}
    />
  );
};

/** The two sides of a Farm, Workshop or Barracks tier, each with what it adds to one building of the type. */
const sideCards = (store: NativeFactStore, realm: NativeRows["Structure"], view: TypeRowView) => {
  const names = SIDE_NAMES[view.row];
  if (!names || !view.next) return undefined;
  const taken = Array.from({ length: view.tier }, (_, index) => researchChoice(view.learned, view.row, index + 1));
  const makes = taken.filter((side) => side === 0).length;
  const others = taken.length - makes;
  const [make, other] = names;
  return [
    { icon: make[0], name: make[1], gain: makeGain(store, realm, view.category, makes) },
    { icon: other[0], name: other[1], gain: otherGain(store, realm, view.category, others) },
  ] as const;
};

/** Fields, Tools or Drill: what one building makes an hour now and with one more pick. */
const makeGain = (store: NativeFactStore, realm: NativeRows["Structure"], category: BuildingType, makes: number) => {
  const resource =
    category === BuildingType.ResourceKnightT1 ? "troops" : category === BuildingType.ResourceWheat ? "wheat" : "labor";
  const label = resource === "troops" ? TROOPS : resource === "wheat" ? WHEAT : LABOR;
  const now = outputPerHour(store, realm, category, makes);
  const next = outputPerHour(store, realm, category, makes + 1);
  return { icon: resource as IconMeaning, label, value: `${formatAmount(now)} → ${formatAmount(next)}/h` };
};

/** Granary or Storeroom: the store's limit now and with one more pick; Rations: the wheat a troop deploys for. */
const otherGain = (store: NativeFactStore, realm: NativeRows["Structure"], category: BuildingType, picks: number) => {
  if (category === BuildingType.ResourceKnightT1) {
    const wheat = (count: number) => rationedWheatPerTroop(store, realm.game_id, ResourcesIds.Knight, count);
    return { icon: "wheat" as IconMeaning, label: WHEAT, value: `${wheat(picks)} → ${wheat(picks + 1)}` };
  }
  const base = ResourceManager.castleStoreLimit(store, realm.game_id, realm.base.level);
  const step = store.require("BoardRules", { game_id: realm.game_id }).storage_step_bps;
  const limit = (count: number) =>
    base === undefined ? undefined : (Number(base / BigInt(RESOURCE_PRECISION)) * (10_000 + count * step)) / 10_000;
  return {
    icon: "resources" as IconMeaning,
    label: "limit",
    value: `${formatAmount(limit(picks))} → ${formatAmount(limit(picks + 1))}`,
  };
};

/** What a hut's or a training building's next tier gives; none for a choosing row, whose sides say it. */
const typeGives = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  view: TypeRowView,
  kind: ScoutKey,
  onKind: (kind: ScoutKey) => void,
): ReactNode => {
  if (!view.next) return undefined;
  if (view.row === research.ROW_HUT) return <HutGives store={store} realm={realm} tier={view.tier} />;
  const training = TRAINING[view.row];
  if (!training) return undefined;
  const tier = view.tier + 1;
  const xpRules = store.get("ArmyProgressionRules", { game_id: realm.game_id });
  return (
    <TrainingGives
      mark={training.mark}
      attribute={training.attribute}
      effect={attributeStep(training.attribute, tier)}
      xpSaved={xpRules ? (nextTierPrice(xpRules, tier) ?? undefined) : undefined}
      tier={tier as Tier}
      armyArt={armyArt({ category: "Knight", tier: "T1" })}
      kinds={
        view.row === research.ROW_SCOUTS_LODGE ? (
          <KindChoice rates={lodgeRates(view)} lifted={kind} onKind={onKind} />
        ) : undefined
      }
    />
  );
};

/** An attribute's effect at a tier and at the next, as the preset's table says it: "+0% → +10%". */
const attributeStep = (attribute: Attribute, tier: number): string => {
  const { atTier, unit } = ATTRIBUTE_LOOK[attribute];
  return `+${atTier(tier)}${unit} → +${atTier(tier + 1)}${unit}`;
};

/** A hut's population now and at the next tier, as the contract's hut_bonus adds a share of it each tier. */
const hutPopulationStep = (store: NativeFactStore, realm: NativeRows["Structure"], tier: number): string => {
  const grant = store.require("BuildingRule", {
    game_id: realm.game_id,
    category: BuildingType.WorkersHut,
  }).capacity_grant;
  const step = store.require("BoardRules", { game_id: realm.game_id }).population_step_bps;
  const population = (at: number) => grant + (grant * at * step) / 10_000;
  return `${formatAmount(population(tier))} → ${formatAmount(population(tier + 1))}`;
};

const HutGives = ({ store, realm, tier }: { store: NativeFactStore; realm: NativeRows["Structure"]; tier: number }) => (
  <span className="flex justify-center">
    <Chip icons={["person"]} label={POPULATION} value={hutPopulationStep(store, realm, tier)} />
  </span>
);

/** Each kind's find-rate bonus a new army starts with from the lodge, now and with the next tier on that kind. */
const lodgeRates = (view: TypeRowView): Record<ScoutKey, readonly [string, string]> => {
  const bonus: Record<ScoutKey, number> = { camp: 0, rift: 0, stragglers: 0 };
  for (let at = 1; at <= view.tier; at++)
    bonus[SCOUT_KEYS[researchChoice(view.learned, research.ROW_SCOUTS_LODGE, at)]!] += scoutingIncrementBps(at + 1);
  const next = scoutingIncrementBps(researchTier(view.learned, research.ROW_SCOUTS_LODGE) + 2);
  const rate = (bps: number) => `+${bps / 100}%`;
  return {
    camp: [rate(bonus.camp), rate(bonus.camp + next)],
    rift: [rate(bonus.rift), rate(bonus.rift + next)],
    stragglers: [rate(bonus.stragglers), rate(bonus.stragglers + next)],
  };
};

/**
 * What a standing building does now, as its panel's figures: what each makes an hour at the type's tier with how many
 * stand and what their store holds, a Hut's population with what is free, a training building's starting tier, and
 * the population each takes. Read from the same facts the build sheet reads.
 */
const standingFigures = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  view: TypeRowView,
  stores: ReturnType<typeof useRealmStores>,
): Figure[] => {
  const effect = readBuildingEffect(store, realm, view.category, view.learned);
  // The castle's own labor producer is not a Workshop.
  const standing =
    getBuildingQuantity(safeInteger(realm.entity_id), view.category, store) -
    (view.category === BuildingType.ResourceLabor ? 1 : 0);
  const count: Figure = {
    icons: [buildingIcon(view.category)],
    label: BUILDING_FIGURES.standing,
    value: `×${standing}`,
  };
  const takes = store.require("BuildingRule", { game_id: realm.game_id, category: view.category }).population_cost;
  const population: Figure[] =
    takes > 0 ? [{ icons: ["person"], label: BUILDING_FIGURES.eachTakes, value: formatAmount(takes) }] : [];
  if (effect.kind === "trains")
    return [
      {
        icons: [TRAINING[view.row]!.mark],
        label: BUILDING_FIGURES.startsAt(effect.attribute),
        value: TIER_WORDS[view.tier],
      },
      ...population,
    ];
  if (effect.kind === "population") {
    const people = store.get("StructureBuildings", { game_id: realm.game_id, entity_id: realm.entity_id })?.population;
    const total = people && people.max + configManager.getBasePopulationCapacity();
    return [
      { icons: ["person"], label: BUILDING_FIGURES.eachAdds, value: `+${formatAmount(effect.amount)}` },
      count,
      {
        icons: ["person", "resources"],
        label: BUILDING_FIGURES.free,
        value: `${formatAmount(total === undefined ? undefined : total - people!.current)} / ${formatAmount(total)}`,
      },
    ];
  }
  const made = PRODUCTS[effect.resource];
  const held = stores?.[made.store];
  return [
    { icons: [made.icon], label: BUILDING_FIGURES.eachMakes(made.word), value: `+${formatAmount(effect.perHour)}/h` },
    count,
    {
      icons: [made.icon, "resources"],
      label: BUILDING_FIGURES.held(made.word),
      value: `${formatAmount(held?.amount)} / ${formatAmount(held?.limit)}`,
    },
    ...population,
  ];
};

/**
 * The step that fixes a shortfall: the castle when the labor price is above the labor store's limit (its next level
 * raises it), else the map where a reveal pays what is short.
 */
const shortfallFix = (short: Extract<Reason, { kind: "short" }>, go: (expedition: boolean) => void): Fix | undefined =>
  short.counted === "limit"
    ? { icon: "realm", word: CASTLE, onFix: () => go(false) }
    : exploreFix(short.of === "essence" ? ResourcesIds.Essence : ResourcesIds.Labor, () => go(true));

/**
 * What a type's next tier gives, in one line for its row's tooltip, from the same readings its sheet draws: a choosing
 * row's two sides, a Hut's population, a training building's attribute for every new army. Nothing past legendary.
 */
export const typeRowLine = (store: NativeFactStore, realm: NativeRows["Structure"], view: TypeRowView): string => {
  const name = buildingName(view.category);
  if (!view.next) return name;
  const sides = sideCards(store, realm, view);
  if (sides)
    return `${name}: ${sides.map(({ name: side, gain }) => `${side} ${gain.label} ${gain.value}`).join(" · ")}`;
  if (view.row === research.ROW_HUT) return `${name}: ${POPULATION} ${hutPopulationStep(store, realm, view.tier)}`;
  const training = TRAINING[view.row];
  return training
    ? `${name}: ${forNewArmies(training.attribute, attributeStep(training.attribute, view.tier + 1))}`
    : name;
};

/**
 * The first price the realm cannot pay, held against what it has with its exact wait; a labor price above the labor
 * store's limit can never be held, so it shows the limit instead.
 */
export const shortfall = (
  price: { essence: number; labor: number },
  essence: number | undefined,
  labor: { amount: number | undefined; limit: number | undefined } | undefined,
  waits: { essenceWait: number | undefined; laborWait: number | undefined },
): Extract<Reason, { kind: "short" }> | undefined => {
  if (essence === undefined || essence < price.essence)
    return { kind: "short", of: "essence", held: essence, need: price.essence, wait: waits.essenceWait };
  if (labor?.limit !== undefined && labor.limit < price.labor)
    return { kind: "short", of: "labor", counted: "limit", held: labor.limit, need: price.labor };
  if (labor?.amount === undefined || labor.amount < price.labor)
    return { kind: "short", of: "labor", held: labor?.amount, need: price.labor, wait: waits.laborWait };
  return undefined;
};
