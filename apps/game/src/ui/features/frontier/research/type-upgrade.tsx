import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import type { Reason } from "@/ui/design-system/kit/reason-plate";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { CASTLE, LABOR, MAP, TROOPS, WHEAT } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import {
  type ExpeditionRules,
  rationedWheatPerTroop,
  researchChoice,
  researchTier,
  ResourceManager,
  scoutingIncrementBps,
} from "@bibliothecadao/eternum";
import {
  nativeResearchConstants as research,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";
import type { Account } from "starknet";

import { KindChoice } from "../army/army-sheet";
import { ATTRIBUTE_LOOK, type Attribute, nextTierPrice } from "../attributes/attributes";
import { outputPerHour } from "../build/build-options";
import { buildingIcon, buildingName } from "../build/building-names";
import { useGoToFrontierPlace } from "../frontier-home";
import { realmPerHour, secondsUntilHeld } from "../hud/army-order";
import { armyArt } from "../hud/dock-armies";
import { useRealmStores } from "../realm-stores";
import { TrainingGives } from "../upgrade/training-gives";
import { TypeUpgradeSheet } from "../upgrade/type-upgrade-sheet";
import type { TypeRowView } from "./research-plan";

/** Each choosing row's sides: their marks, names and what each adds to every building of the type. */
const SIDE_NAMES: Partial<Record<number, readonly [[IconCode, string], [IconCode, string]]>> = {
  [research.ROW_FARM]: [
    ["Fi", "Fields"],
    ["Gr", "Granary"],
  ],
  [research.ROW_WORKSHOP]: [
    ["To", "Tools"],
    ["So", "Storeroom"],
  ],
  [research.ROW_BARRACKS]: [
    ["Dr", "Drill"],
    ["Ra", "Rations"],
  ],
};

/** Each training row's attribute and its Aspect mark. */
const TRAINING: Partial<Record<number, { attribute: Attribute; mark: IconCode }>> = {
  [research.ROW_WAR_HALL]: { attribute: "Battle", mark: "Ba" },
  [research.ROW_SUPPLY_YARD]: { attribute: "Logistics", mark: "Lg" },
  [research.ROW_SCOUTS_LODGE]: { attribute: "Scouting", mark: "Sc" },
  [research.ROW_HEARTH]: { attribute: "Homecoming", mark: "Su" },
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
  onClose,
}: {
  realm: NativeRows["Structure"];
  rules: ExpeditionRules;
  view: TypeRowView;
  essence: number | undefined;
  onClose: () => void;
}) => {
  const { setup, account } = useGame();
  const tick = useCurrentDefaultTick();
  const labor = useRealmStores(realm, rules)?.labor;
  const goToPlace = useGoToFrontierPlace(realm);
  const [lifted, setLifted] = useState<0 | 1 | undefined>(undefined);
  const [kind, setKind] = useState<ScoutKey>("camp");
  const [sending, setSending] = useState(false);
  const sides = sideCards(setup.store, realm, view);
  const choice = view.row === research.ROW_SCOUTS_LODGE ? SCOUT_KEYS.indexOf(kind) : (lifted ?? 0);

  const upgrade = async () => {
    setSending(true);
    try {
      await setup.systemCalls.research({
        signer: account.account as unknown as Account,
        structureId: realm.entity_id,
        row: view.row,
        choice,
      });
      onClose();
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The Upgrade could not be sent."));
    } finally {
      setSending(false);
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
        realmPerHour(setup.store, realm.entity_id, ResourcesIds.Essence, tick),
      ),
      laborWait: secondsUntilHeld(labor?.amount, view.next.labor, labor?.perHour),
    });

  return (
    <TypeUpgradeSheet
      icon={buildingIcon(view.category)}
      name={buildingName(view.category)}
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
      short={
        short && {
          reason: short,
          step:
            short.icon === "Sg" ? (
              <Button role="primary" icon="Cs" word={CASTLE} className="w-[120px]" onClick={() => go(false)} />
            ) : (
              <Button role="primary" icon="Mp" word={MAP} className="w-[104px]" onClick={() => go(true)} />
            ),
        }
      }
      sending={sending}
      onUpgrade={() => void upgrade()}
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
    category === BuildingType.ResourceKnightT1 ? "Tr" : category === BuildingType.ResourceWheat ? "Wh" : "La";
  const label = resource === "Tr" ? TROOPS : resource === "Wh" ? WHEAT : LABOR;
  const now = outputPerHour(store, realm, category, makes);
  const next = outputPerHour(store, realm, category, makes + 1);
  return { icon: resource as IconCode, label, value: `${formatAmount(now)} → ${formatAmount(next)}/h` };
};

/** Granary or Storeroom: the store's limit now and with one more pick; Rations: the wheat a troop deploys for. */
const otherGain = (store: NativeFactStore, realm: NativeRows["Structure"], category: BuildingType, picks: number) => {
  if (category === BuildingType.ResourceKnightT1) {
    const wheat = (count: number) => rationedWheatPerTroop(store, realm.game_id, ResourcesIds.Knight, count);
    return { icon: "Wh" as IconCode, label: WHEAT, value: `${wheat(picks)} → ${wheat(picks + 1)}` };
  }
  const base = ResourceManager.castleStoreLimit(store, realm.game_id, realm.base.level);
  const step = store.require("BoardRules", { game_id: realm.game_id }).storage_step_bps;
  const limit = (count: number) =>
    base === undefined ? undefined : (Number(base / BigInt(RESOURCE_PRECISION)) * (10_000 + count * step)) / 10_000;
  return {
    icon: "Sg" as IconCode,
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
  const { atTier, unit } = ATTRIBUTE_LOOK[training.attribute];
  const tier = view.tier + 1;
  const xpRules = store.get("ArmyProgressionRules", { game_id: realm.game_id });
  return (
    <TrainingGives
      mark={training.mark}
      attribute={training.attribute}
      effect={`+${atTier(tier)}${unit} → +${atTier(tier + 1)}${unit}`}
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

/** A hut's population now and at the next tier, as the contract's hut_bonus adds a share of it each tier. */
const HutGives = ({ store, realm, tier }: { store: NativeFactStore; realm: NativeRows["Structure"]; tier: number }) => {
  const grant = store.require("BuildingRule", {
    game_id: realm.game_id,
    category: BuildingType.WorkersHut,
  }).capacity_grant;
  const step = store.require("BoardRules", { game_id: realm.game_id }).population_step_bps;
  const population = (at: number) => grant + (grant * at * step) / 10_000;
  return (
    <span className="flex justify-center">
      <Chip
        icons={["Pp"]}
        label="population"
        value={`${formatAmount(population(tier))} → ${formatAmount(population(tier + 1))}`}
      />
    </span>
  );
};

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
    return { kind: "short", icon: "Es", held: essence, need: price.essence, wait: waits.essenceWait };
  if (labor?.limit !== undefined && labor.limit < price.labor)
    return { kind: "short", icon: "Sg", held: labor.limit, need: price.labor };
  if (labor?.amount === undefined || labor.amount < price.labor)
    return { kind: "short", icon: "La", held: labor?.amount, need: price.labor, wait: waits.laborWait };
  return undefined;
};
