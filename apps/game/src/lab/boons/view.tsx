import { HudButton } from "@/ui/design-system/kit/hud-elements";
import {
  BOON_KINDS,
  BOON_STEPS,
  type BoonKind,
  REST_STAMINA_PER_RANK,
} from "@/ui/features/frontier/boons/boon-catalog";
import { type BoonFacts, readBoonSheet } from "@/ui/features/frontier/boons/boon-sheet-plan";
import { ArmyBoonsLine, BoonSheet, type BoonPick } from "@/ui/features/frontier/boons/boon-sheet";
import { useState } from "react";

/** The Orders that give to an army of Might (reports/s1-xp-3.md): War Power, Ward Giants, Spoils Titans, Paths Skill. */
const MIGHT = { power: 12, giants: 1, titans: 13, skill: 9 } as const;

const noSteps = (): Record<BoonKind, number> =>
  Object.fromEntries(BOON_KINDS.map((boon) => [boon, 0])) as Record<BoonKind, number>;

/**
 * The armies the lab shows, their facts shaped as the design stores them (C14): a Knight army of Might at Battle 2 with
 * two points waiting, a Rare then a Common; a Scout army of Might with an Uncommon (reports/s1-xp-3.md's City moment:
 * Skill's Camps, Giants' Vigour, Titans' Plunder).
 */
const ARMIES: Record<"knight" | "scout", BoonFacts> = {
  knight: {
    troop: "knight",
    steps: { ...noSteps(), battle: 2 },
    offers: [
      {
        rank: 3,
        cards: [
          { order: MIGHT.power, boon: "battle" },
          { order: MIGHT.giants, boon: "guard" },
          { order: MIGHT.titans, boon: "lore" },
        ],
      },
      {
        rank: 1,
        cards: [
          { order: MIGHT.power, boon: "charge" },
          { order: MIGHT.giants, boon: "vigour" },
          { order: MIGHT.titans, boon: "plunder" },
        ],
      },
    ],
  },
  scout: {
    troop: "scout",
    steps: noSteps(),
    offers: [
      {
        rank: 2,
        cards: [
          { order: MIGHT.skill, boon: "camps" },
          { order: MIGHT.giants, boon: "vigour" },
          { order: MIGHT.titans, boon: "plunder" },
        ],
      },
    ],
  },
};

/**
 * The pick answered as the design says the contract answers it: a boon gains the point's rank in steps, 5 at most, the
 * steps past 5 coming back as stamina; rest gives 20 stamina a rank; either way the point's offer is spent. This is the
 * lab's stand-in until the deep lane's boon command lands.
 */
const answerPick = (facts: BoonFacts, pick: BoonPick): { facts: BoonFacts; stamina: number } => {
  const [offer, ...later] = facts.offers;
  if (!offer) return { facts, stamina: 0 };
  if (pick === "rest") return { facts: { ...facts, offers: later }, stamina: REST_STAMINA_PER_RANK * offer.rank };
  const to = Math.min(BOON_STEPS, facts.steps[pick] + offer.rank);
  const past = facts.steps[pick] + offer.rank - to;
  return {
    facts: { ...facts, steps: { ...facts.steps, [pick]: to }, offers: later },
    stamina: past * REST_STAMINA_PER_RANK,
  };
};

/** The boon sheet in the lab (/lab/boons): an army's points one after the other, and its boons on its line. */
export function BoonSheetLab() {
  const [army, setArmy] = useState<keyof typeof ARMIES>("knight");
  const [facts, setFacts] = useState<BoonFacts>(ARMIES.knight);
  const [stamina, setStamina] = useState(0);
  const plan = readBoonSheet(facts);
  const choose = (next: keyof typeof ARMIES) => {
    setArmy(next);
    setFacts(ARMIES[next]);
    setStamina(0);
  };
  const pick = (choice: BoonPick) => {
    const answered = answerPick(facts, choice);
    setFacts(answered.facts);
    setStamina((held) => held + answered.stamina);
  };
  return (
    <div data-boon-lab className="flex min-h-full flex-col gap-3 bg-hud-dark p-4 text-hud-ink">
      <div className="flex gap-2">
        <HudButton kind={army === "knight" ? "primary" : "secondary"} onClick={() => choose("knight")}>
          Knight army
        </HudButton>
        <HudButton kind={army === "scout" ? "primary" : "secondary"} onClick={() => choose("scout")}>
          Scout army
        </HudButton>
      </div>
      <div data-boon-army className="flex flex-wrap items-center gap-2">
        <span className="text-hud-strong">Army 1</span>
        <ArmyBoonsLine steps={facts.steps} />
        {stamina > 0 && <span className="text-hud-label text-hud-good">+{stamina} stamina</span>}
      </div>
      {plan && <BoonSheet plan={plan} onPick={pick} onClose={() => choose(army)} />}
    </div>
  );
}
