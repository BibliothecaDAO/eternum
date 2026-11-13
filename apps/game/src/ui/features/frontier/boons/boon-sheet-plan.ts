import { orders } from "@bibliothecadao/types";
import { BOON_WORDS } from "@/ui/design-system/kit/words";

import {
  BOON_KINDS,
  BOON_STEPS,
  BOONS,
  type BoonKind,
  type BoonTroop,
  giverOf,
  GIVERS,
  type GiverRole,
  REST_STAMINA_PER_RANK,
} from "./boon-catalog";

/**
 * A skill point's offer as the design stores it with the army when the point is earned (C14): its rank, 1 (Common) to
 * 5 (Legendary), and a card from each of the army's givers: the Order that gives it and the boon it gives.
 */
export type BoonOffer = { rank: 1 | 2 | 3 | 4 | 5; cards: { order: number; boon: BoonKind }[] };

/** What the sheet reads of an army: its troop, each boon's steps today, and its points not picked yet, oldest first. */
export type BoonFacts = { troop: BoonTroop; steps: Record<BoonKind, number>; offers: BoonOffer[] };

/** One card: its giver's Order and crest, the boon, its steps before and after, what it then does, the stamina past 5. */
export type BoonCard = {
  order: number;
  orderName: string;
  boon: BoonKind;
  from: number;
  to: number;
  effect: string;
  stamina: number;
};

/** The sheet for the oldest point not picked: its rank, its cards, what rest gives, and the points waiting after it. */
export type BoonSheetPlan = { rank: BoonOffer["rank"]; cards: BoonCard[]; rest: number; waiting: number };

/** Where each giver's card stands: the troop's own giver first, then Ward and Spoils, the same places every sheet. */
const PLACE: Record<GiverRole, number> = { war: 0, paths: 0, ward: 1, spoils: 2 };

/** The sheet for an army's oldest point not picked; null with none waiting. */
export const readBoonSheet = (facts: BoonFacts): BoonSheetPlan | null => {
  const [offer, ...later] = facts.offers;
  if (!offer) return null;
  const cards = offer.cards
    .map(({ order, boon }) => boonCard(facts, order, boon, offer.rank))
    .toSorted((a, b) => PLACE[giverOf(a.boon)] - PLACE[giverOf(b.boon)]);
  return { rank: offer.rank, cards, rest: REST_STAMINA_PER_RANK * offer.rank, waiting: later.length };
};

const boonCard = (facts: BoonFacts, order: number, boon: BoonKind, rank: number): BoonCard => {
  const giver = giverOf(boon);
  if (!(GIVERS[giver].troops as readonly BoonTroop[]).includes(facts.troop))
    throw new Error(`${BOON_WORDS.names[boon]} is not offered to a ${facts.troop} army`);
  const named = orders.find(({ orderId }) => orderId === order);
  if (!named) throw new Error(`Unknown Order ${order}`);
  const from = facts.steps[boon];
  const to = Math.min(BOON_STEPS, from + rank);
  return {
    order,
    orderName: named.orderName,
    boon,
    from,
    to,
    effect: BOONS[boon].effect(to),
    stamina: (from + rank - to) * REST_STAMINA_PER_RANK,
  };
};

/** The army's boons for the day, as its line shows them: each boon with a step, in the catalog's order. */
export const armyBoons = (steps: BoonFacts["steps"]): { boon: BoonKind; steps: number }[] =>
  BOON_KINDS.filter((boon) => steps[boon] > 0).map((boon) => ({ boon, steps: steps[boon] }));
