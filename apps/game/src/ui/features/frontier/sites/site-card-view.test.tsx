import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type SiteVerb, SiteCardView } from "./site-card-view";
import { readSiteCard, type SiteFight } from "./site-card-plan";
import { campBeside, placeSite } from "./site-fixture";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { TARGET_MARKS, type AttackTargetKind } from "./site-marks";
import { plateRows } from "@/three/map-plates/map-plate-rows";
import { frontierSiteName, StructureType, ResourcesIds } from "@bibliothecadao/types";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const army = { art: "knight-t1" as const, troops: 5_000 };
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("section[role=dialog] button")];

describe("a guarded site's card", () => {
  it("renders the depth-I Beasts reward beside its Victory likely verdict", () => {
    const { store, site, structure, attack } = campBeside("Beasts");
    placeSite(store);
    const plan = readSiteCard(store, site, structure, attack({ col: 41, row: 12, alt: false }));
    expect(plan.payout).toEqual({ resourceId: ResourcesIds.Wheat, amount: 6000, fits: 5000 });
    const payout = plan.payout!;
    act(() =>
      root.render(
        <SiteCardView
          site="Beasts"
          beast={plan.beast && plan.guard ? { ...plan.beast, combatClass: plan.guard.type } : undefined}
          army={army}
          guard={plan.guard?.count}
          fight={{ troopsLost: 30, guardLeft: 0 }}
          pay={{ icon: resourceMeaning(payout.resourceId), amount: payout.amount, fits: payout.fits }}
          verb={{ kind: "attack", stamina: plan.attackStamina, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector("[data-fight-outcome]")?.textContent).toBe("Victory likely");
    expect(document.querySelector("[data-fight-reward]")?.textContent).toBe("+5KFull: the rest did not fit");
  });

  it("heads the attack with what it earns, and reads each side before and after as numbers alone", () => {
    const onAttack = vi.fn();
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
          army={army}
          guard={1_100}
          fight={{
            troopsLost: 180,
            guardLeft: 0,
          }}
          pay={{ icon: "labor", amount: 550 }}
          verb={{ kind: "attack", stamina: 30, onAttack }}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='Troll']")!;
    expect(card.querySelector("[data-fight-outcome]")?.textContent).toBe("Victory likely");
    expect(card.textContent?.match(/(?<!−)1,100/g)).toHaveLength(1);
    expect(card.querySelector(".fight-spoils .opacity-50")).toBeNull();
    const sides = [...card.querySelectorAll('.fight-arena [role="img"]')].map((side) =>
      side.getAttribute("aria-label"),
    );
    expect(sides).toEqual(["Army 5,000 → 4,820, −180 · 4% lost", "Troll 1,100 → 0, −1,100 · 100% lost"]);
    expect(card.textContent).not.toContain("When cleared");
    expect(card.textContent).toContain("+550");
    const attack = buttons().find((button) => button.textContent?.startsWith("Attack"))!;
    expect(attack.textContent).toContain("Attack");
    expect(attack.querySelector('[data-attack-stamina="30"]')).not.toBeNull();
    act(() => attack.click());
    expect(onAttack).toHaveBeenCalled();
  });

  it("holds only Realm and Attack in its foot, Attack alone at the right, and no whole fight's figures (owner, 10-27)", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
          army={{ ...army, troops: 1_500 }}
          guard={1_300}
          fight={{
            troopsLost: 180,
            guardLeft: 740,
          }}
          pay={{ icon: "wood", amount: 650, fits: 120 }}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onRealm={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    const foot = document.querySelector("section[role=dialog] footer.ui-actions")!;
    const words = [...foot.querySelectorAll("button")].map((button) => button.textContent);
    expect(words[0]).toBe("Realm");
    expect(words[1]).toMatch(/^Attack/);
    expect(foot.lastElementChild?.textContent).toMatch(/^Attack/);
    expect(document.body.textContent).not.toContain("Details");
    expect(document.body.textContent).not.toContain("The whole fight");
    expect(document.querySelector("section[role=dialog] dl")).toBeNull();
  });

  it("heads a loss in red with the guard left, dims the reward, and keeps Attack, in red", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Ruin"
          beast={{ name: "Ammit", beast: "ammit", combatClass: "Knight" }}
          army={{ ...army, troops: 1_200 }}
          guard={3_400}
          fight={{
            troopsLost: 1_200,
            guardLeft: 2_300,
          }}
          pay={null}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='Ruin']")!;
    expect(card.querySelectorAll('[data-icon="beast-ammit"]')).toHaveLength(1);
    expect(card.querySelector("[data-fight-outcome]")?.textContent).toContain("Your army is lost");
    expect(card.querySelector("[data-fight-reward]")).toBeNull();
    expect(card.querySelector('[data-icon="troops"]')).toBeNull();
    expect(card.textContent).toContain("2,300");
    const attack = buttons().find((button) => button.textContent?.startsWith("Attack"))!;
    expect(attack.disabled).toBe(false);
    expect(attack.dataset.kind).toBe("danger");
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it("reads the owner's Blightglow Rift as this attack leaves it: 794 → 193 against 1,400 → 1,033, and warns of no loss", () => {
    const onAttack = vi.fn();
    act(() =>
      root.render(
        <SiteCardView
          site="Rift"
          name="Blightglow"
          beast={{ name: "Wyvern", beast: "wyvern", combatClass: "Knight" }}
          army={{ ...army, troops: 794 }}
          guard={1_400}
          fight={{ troopsLost: 601, guardLeft: 1_033 }}
          pay={{ icon: "essence", amount: 4_200 }}
          verb={{ kind: "attack", stamina: 30, onAttack }}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='Blightglow Rift']")!;
    expect(card.querySelector("[data-fight-outcome]")?.textContent).toContain("The guard survives");
    expect(card.querySelector(".fight-spoils .opacity-50")?.textContent).toBe("+4.2K");
    expect(card.textContent).toContain("794");
    expect(card.textContent).toContain("193");
    expect(card.textContent).toContain("1,400");
    expect(card.textContent).toContain("1,033");
    expect(card.textContent).not.toContain("Army will be lost");
    expect(document.querySelector('[role="status"]')).toBeNull();
    const sides = [...card.querySelectorAll('.fight-arena [role="img"]')].map((side) =>
      side.getAttribute("aria-label"),
    );
    expect(sides).toEqual(["Army 794 → 193, −601 · 76% lost", "Wyvern 1,400 → 1,033, −367 · 26% lost"]);
    const attack = buttons().find((button) => button.textContent?.startsWith("Attack"))!;
    expect(attack.dataset.kind).toBe("primary");
    act(() => void document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onAttack).toHaveBeenCalledOnce();
  });

  it("forecasts a clear that pays nothing with no site count, for a site and an army alike", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
          army={army}
          guard={1_100}
          fight={{
            troopsLost: 180,
            guardLeft: 0,
          }}
          pay={null}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector("[data-fight-outcome]")?.textContent).toBe("Victory likely");
    expect(document.querySelector("[data-fight-reward]")).toBeNull();
    expect(document.body.textContent).not.toContain("site");
    act(() =>
      root.render(
        <SiteCardView
          site="Army"
          beast={undefined}
          army={army}
          guard={1_100}
          fight={{ troopsLost: 180, guardLeft: 0 }}
          pay={null}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector("[data-fight-outcome]")?.textContent).toBe("Victory likely");
  });

  it("earns what fits, marked Full, when the store would overflow, with Realm to make room; never blocks the attack", () => {
    const onRealm = vi.fn();
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
          army={army}
          guard={1_100}
          fight={{
            troopsLost: 180,
            guardLeft: 0,
          }}
          pay={{ icon: "labor", amount: 550, fits: 120 }}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onRealm={onRealm}
          onClose={() => {}}
        />,
      ),
    );
    const spoils = document.querySelector("[data-fight-reward]")!;
    expect(spoils.textContent).toBe("+120Full: the rest did not fit");
    expect(spoils.querySelector('[data-tip*="did not fit"]')).toBeNull();
    act(() =>
      buttons()
        .find((button) => button.textContent === "Realm")!
        .click(),
    );
    expect(onRealm).toHaveBeenCalled();
    expect(buttons().some((button) => button.textContent?.startsWith("Attack"))).toBe(true);
  });

  // Owner, 28 October 2026: "the need 30 stamina line can actually replace the 30 stamina below it it just makes more
  // sense, and we save space".
  it("holds Attack back when the army is short, the stamina it needs, has and waits for in the foot, the cost's place", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
          army={army}
          guard={1_100}
          fight={{
            troopsLost: 180,
            guardLeft: 0,
          }}
          pay={{ icon: "labor", amount: 550 }}
          verb={{ kind: "short", stamina: { cost: 30, held: 10, wait: 40 * 60 } }}
          onClose={() => {}}
        />,
      ),
    );
    const foot = document.querySelector(".ui-window__foot")!;
    expect(foot.querySelector('[role="status"]')?.textContent).toBe("Needs 30 stamina, have 10 · in 40m");
    expect(foot.querySelector("button")?.textContent).toBe("Attack");
    expect(foot.querySelector("button")?.disabled).toBe(true);
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(document.querySelector(".ui-cost")).toBeNull();
  });
});

describe("a guarded site's card with no army chosen", () => {
  it("shows a band's Oath beside its pay", () => {
    for (const holdsOath of [true, false]) {
      act(() =>
        root.render(
          <SiteCardView
            site="Beasts"
            beast={undefined}
            army={null}
            guard={1_200}
            fight={undefined}
            pay={{ icon: "wheat", amount: 3_600 }}
            holdsOath={holdsOath}
            verb={null}
            onClose={() => {}}
          />,
        ),
      );
      const oath = document.querySelector('section[role=dialog] [data-fight-reward] [data-icon="shrine"]');
      expect([oath !== null, oath?.parentElement?.parentElement?.textContent]).toEqual(
        holdsOath ? [true, "Oath"] : [false, undefined],
      );
    }
  });

  it("names a rift by its name and kind, as the map's hover does, with an army chosen or not", () => {
    // The playtest's Brimdeep: its hover reads "Brimdeep Rift" over "Dark fey".
    const [hover] = plateRows({
      kind: "structure",
      relation: "neutral",
      owner: "",
      beast: "Fairy",
      name: frontierSiteName(StructureType.Rift),
      named: false,
      place: "Brimdeep",
      guards: [{ type: "knight", tier: 1, count: 1_200 }],
      arrivals: [],
      icon: "rift",
    });
    const hoverTitle = hover!.map((segment) => ("text" in segment ? segment.text : "")).join("");
    expect(hoverTitle).toBe("Brimdeep Rift");
    for (const chosen of [null, army]) {
      act(() =>
        root.render(
          <SiteCardView
            site="Rift"
            name="Brimdeep"
            beast={{ name: "Fairy", beast: "dark-fey", combatClass: "Crossbowman" }}
            army={chosen}
            guard={1_200}
            fight={undefined}
            pay={{ icon: "essence", amount: 3_600 }}
            verb={null}
            onClose={() => {}}
          />,
        ),
      );
      expect(document.querySelector("section[role=dialog]")!.getAttribute("aria-label")).toBe(hoverTitle);
    }
  });

  it("keeps a named ruin's distinct kind and guard species beside its strength", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Ruin"
          name="North Watch"
          beast={{ name: "Ammit", beast: "ammit", combatClass: "Knight" }}
          army={null}
          guard={1_100}
          fight={undefined}
          pay={null}
          verb={null}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='North Watch Ruin']")!;
    expect(card.textContent?.match(/North Watch/g)).toHaveLength(1);
    // Its kind is in its title, as the hover says it; the guard's token, its strength under it, then its beast.
    expect(card.querySelector(".ui-frame__body header")?.textContent).toBe("1,100BladeAmmit");
    expect(card.querySelector("header [role='img']")?.getAttribute("aria-label")).toBe("Ammit 1,100");
    expect(card.textContent?.match(/1,100|1\.1K/g)).toHaveLength(1);
  });

  // Owner, 28 October 2026: "agree with no picker".
  it("lists no army and offers no step: what the site is and pays, and its guard", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Rift"
          beast={{ name: "Fairy", beast: "dark-fey", combatClass: "Crossbowman" }}
          army={null}
          guard={1_100}
          fight={undefined}
          pay={{ icon: "essence", amount: 3_300 }}
          verb={null}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[data-kit-sheet]")!;
    expect(card.querySelector(".ui-frame__body header")?.textContent).toBe("1,100BowFairy+3.3K");
    expect(card.querySelectorAll(".ui-row")).toHaveLength(0);
    expect(card.querySelectorAll("button")).toHaveLength(1);
    expect(card.textContent).not.toContain("Pick an army");
  });
});

describe("Enter on a guarded site's card", () => {
  const enter = () => new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  const card = (fight: "wins" | "loses", onAttack: () => void) => (
    <SiteCardView
      site="Camp"
      beast={undefined}
      army={army}
      guard={1_100}
      fight={{
        troopsLost: fight === "wins" ? 180 : army.troops,
        guardLeft: fight === "wins" ? 0 : 900,
      }}
      pay={{ icon: "labor", amount: 550 }}
      verb={{ kind: "attack", stamina: 30, onAttack }}
      onClose={() => {}}
    />
  );

  it("confirms the attack the army wins", () => {
    const onAttack = vi.fn();
    act(() => root.render(card("wins", onAttack)));
    act(() => void document.body.dispatchEvent(enter()));
    expect(onAttack).toHaveBeenCalledTimes(1);
  });

  it("never sends the attack that loses the army: that one takes its own tap", () => {
    const onAttack = vi.fn();
    act(() => root.render(card("loses", onAttack)));
    act(() => void document.body.dispatchEvent(enter()));
    expect(onAttack).not.toHaveBeenCalled();
  });
});

describe("a guarded site's card for an army out of reach", () => {
  it("holds Attack back and says the site is too far when no order of the army leads beside it", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Rift"
          beast={{ name: "Fairy", beast: "dark-fey", combatClass: "Crossbowman" }}
          army={army}
          guard={1_100}
          fight={undefined}
          pay={{ icon: "essence", amount: 300 }}
          verb={{ kind: "far" }}
          onClose={() => {}}
        />,
      ),
    );
    expect(buttons().find((button) => button.textContent?.startsWith("Attack"))?.disabled).toBe(true);
    expect(document.querySelector('[role="status"]')?.textContent).toBe("Too far from the Rift");
  });

  it("offers Move toward the site, with the same line, while an order leads beside it", () => {
    const onMove = vi.fn();
    act(() =>
      root.render(
        <SiteCardView
          site="Rift"
          beast={{ name: "Fairy", beast: "dark-fey", combatClass: "Crossbowman" }}
          army={army}
          guard={1_100}
          fight={undefined}
          pay={{ icon: "essence", amount: 300 }}
          verb={{ kind: "move", prices: [{ of: "stamina", amount: 20 }], onMove }}
          onClose={() => {}}
        />,
      ),
    );
    expect(buttons().some((button) => button.textContent?.startsWith("Attack"))).toBe(false);
    // Move carries its verb only; what it costs is the line under it.
    expect(buttons().find((button) => button.textContent?.startsWith("Move"))!.textContent).toBe("Move");
    expect(document.querySelector(".ui-cost")?.textContent).toBe("20 stamina");
    act(() =>
      buttons()
        .find((button) => button.textContent?.startsWith("Move"))!
        .click(),
    );
    expect(onMove).toHaveBeenCalled();
    expect(document.querySelector('[role="status"]')?.textContent).toBe("Too far from the Rift");
  });
});

it("titles a single roaming Wraith by its species", () => {
  act(() =>
    root.render(
      <SiteCardView
        site="Beasts"
        beast={{ name: "Wraith", beast: "wraith", combatClass: "Crossbowman" }}
        army={null}
        guard={314}
        fight={undefined}
        pay={null}
        verb={null}
        onClose={() => {}}
      />,
    ),
  );
  expect(host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label")).toBe("Wraith");
  expect(host.querySelector("[data-combat-mark]")?.textContent).toBe("Bow");
});

it("heads the card with the site's kind, and offers the supply post its clear opens", () => {
  act(() =>
    root.render(
      <SiteCardView
        site="Camp"
        beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
        army={{ art: "knight-t1", troops: 2_005 }}
        guard={1_000}
        fight={{ troopsLost: 325, guardLeft: 0 }}
        pay={{ icon: "labor", amount: 675 }}
        holdsOath
        opensPost
        verb={{ kind: "attack", stamina: 10, onAttack: () => {} }}
        onClose={() => {}}
      />,
    ),
  );
  const head = document.querySelector("section[data-kit-sheet] .ui-frame__head")!;
  expect(head.querySelector(".ui-chip")?.textContent).toBe("Camp");
  expect(document.querySelector("[data-fight-reward]")?.textContent).toBe("+675OathPost");
  expect([...document.querySelectorAll(".fight-side__taken")].map((line) => line.textContent)).toEqual([
    "−325",
    "Defeated",
  ]);
});

describe("one fight panel for every state of every target (owner, 10-27: 'this panel doesnt match at all')", () => {
  const holds: SiteFight = { troopsLost: 180, guardLeft: 740 };
  const clears: SiteFight = { troopsLost: 180, guardLeft: 0 };
  const attack: SiteVerb = { kind: "attack", stamina: 30, onAttack: () => {} };
  /** Each state: the forecast the card holds, its step, the two sides' figures kept, the line and whether Attack runs. */
  const STATES: {
    state: string;
    fight: SiteFight | undefined;
    verb: SiteVerb;
    kept: [string, string];
    /** What the attack costs each side, under its bar, where the fight is known. */
    lost: [string | undefined, string | undefined];
    line: (word: string) => string | undefined;
    attacks: boolean;
  }[] = [
    {
      state: "in reach, clearing it",
      fight: clears,
      verb: attack,
      kept: ["4,820", "0"],
      lost: ["−180 · 4% lost", "−1,100 · 100% lost"],
      line: () => undefined,
      attacks: true,
    },
    {
      state: "in reach, the guard holds",
      fight: holds,
      verb: attack,
      kept: ["4,820", "740"],
      lost: ["−180 · 4% lost", "−360 · 33% lost"],
      line: () => undefined,
      attacks: true,
    },
    {
      state: "too far",
      fight: undefined,
      verb: { kind: "far" },
      kept: ["—", "—"],
      lost: [undefined, undefined],
      line: (word) => `Too far from the ${word}`,
      attacks: false,
    },
    {
      // The contract refuses an attack short of its stamina, so the card holds no figures, only why.
      state: "short of stamina",
      fight: { refused: true },
      verb: { kind: "short", stamina: { cost: 30, held: 10, wait: 40 * 60 } },
      kept: ["—", "—"],
      lost: [undefined, undefined],
      line: () => "Needs 30 stamina, have 10 · in 40m",
      attacks: false,
    },
    {
      state: "refused",
      fight: { refused: true },
      verb: { ...attack, refused: "The army is on battle cooldown" },
      kept: ["—", "—"],
      lost: [undefined, undefined],
      line: () => "The army is on battle cooldown",
      attacks: true,
    },
  ];
  const TARGETS = Object.keys(TARGET_MARKS) as AttackTargetKind[];

  for (const target of TARGETS)
    for (const { state, fight, verb, kept, lost, line, attacks } of STATES)
      it(`draws both sides for ${target}, ${state}, with its line and its step`, () => {
        act(() =>
          root.render(
            <SiteCardView
              site={target}
              beast={undefined}
              army={army}
              guard={1_100}
              fight={fight}
              pay={null}
              verb={verb}
              onClose={() => {}}
            />,
          ),
        );
        const sides = [...document.querySelectorAll('section[role=dialog] .fight-arena [role="img"]')].map((side) =>
          side.getAttribute("aria-label"),
        );
        const heard = (said: string, lost: string | undefined) => (lost ? `${said}, ${lost}` : said);
        expect(sides).toEqual([heard(`Army 5,000 → ${kept[0]}`, lost[0]), heard(`Troops 1,100 → ${kept[1]}`, lost[1])]);
        expect(document.querySelector('[role="status"]')?.textContent).toBe(line(TARGET_MARKS[target].word));
        const attackBtn = buttons().find((button) => button.textContent?.startsWith("Attack"));
        expect(attackBtn?.disabled).toBe(!attacks);
        expect(attackBtn?.querySelector('[data-attack-stamina="30"]') !== null).toBe(attacks);
      });
});
