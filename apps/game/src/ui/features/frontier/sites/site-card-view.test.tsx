import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type SiteVerb, SiteCardView } from "./site-card-view";
import { readSiteCard, type SiteFight } from "./site-card-plan";
import { campBeside, SITE_TILE } from "./site-fixture";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { TARGET_MARKS, type AttackTargetKind } from "./site-marks";
import { plateRows } from "@/three/map-plates/map-plate-rows";
import { frontierSiteName, StructureType } from "@bibliothecadao/types";

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
  it("renders the depth-I Beasts reward and XP in This attack earns", () => {
    const { store, site, structure, attack } = campBeside("Beasts");
    const plan = readSiteCard(store, site, structure, SITE_TILE, attack({ col: 41, row: 12, alt: false }));
    expect(plan.payout).toEqual({ resourceId: 23, amount: 375, fits: 375 });
    expect(plan.xp).toBe(118);
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
          xp={plan.xp}
          verb={{ kind: "attack", stamina: plan.attackStamina, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector(".ui-frame__body header")?.textContent).toBe("This attack earns+375+118 XP+1 site");
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
          xp={82}
          verb={{ kind: "attack", stamina: 30, onAttack }}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='Troll']")!;
    // The owner, 26 October 2026: "moving the clear rewards in the 'this attack clears it' -> This attack earns xxx".
    expect(card.querySelector(".ui-frame__body header")?.textContent).toBe("This attack earns+550+82 XP+1 site");
    // Owner, 28 October 2026 ("v1 token header yes"): the guard heads the card as a token; with an army its strength is
    // the fight's to say, once.
    expect(card.querySelector("header [role='img']")?.getAttribute("aria-label")).toBe("Troll");
    // Its strength is said once; "−1,100" under its bar is what the attack takes of it.
    expect(card.textContent?.match(/(?<!−)1,100/g)).toHaveLength(1);
    expect(card.querySelector(".ui-frame__body header .opacity-50")).toBeNull();
    const sides = [...card.querySelectorAll(".ui-frame__body > .flex.gap-2 > *")].map((side) => side.textContent);
    expect(sides).toEqual(["5,000 →4,820−180 · 4% lost", "1,100 →0−1,100 · 100% lost"]);
    expect(card.textContent).not.toContain("When cleared");
    expect(card.textContent).toContain("+550");
    expect(card.textContent).toContain("+82 XP");
    const attack = buttons().find((button) => button.textContent?.startsWith("Attack"))!;
    expect(attack.textContent).toBe("Attack");
    expect(card.querySelector(".ui-cost")?.textContent).toBe("30 stamina");
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
          xp={90}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onRealm={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    const foot = document.querySelector("section[role=dialog] footer.ui-actions")!;
    const words = [...foot.querySelectorAll("button")].map((button) => button.textContent);
    // The way out on the left, Attack last: the shared actions rule puts the last alone on the right.
    expect(words).toEqual(["Realm", "Attack"]);
    expect(foot.lastElementChild?.textContent).toBe("Attack");
    expect(document.body.textContent).not.toContain("Details");
    expect(document.body.textContent).not.toContain("The whole fight");
    expect(document.querySelector("section[role=dialog] dl")).toBeNull();
  });

  it("heads a loss in red with the guard left, dims a ruin's chest, and keeps Attack, in red", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Ruin"
          beast={{ name: "Basilisk", beast: "basilisk", combatClass: "Knight" }}
          army={{ ...army, troops: 1_200 }}
          guard={3_400}
          fight={{
            troopsLost: 1_200,
            guardLeft: 2_300,
          }}
          pay={null}
          chest={{ tier: 3, lords: 128 }}
          xp={145}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='Ruin']")!;
    // The site's painting and the guard's side name the Basilisk.
    expect(card.querySelectorAll('[data-icon="beast-basilisk"]')).toHaveLength(2);
    // The headline says the loss, and the chest this attack does not win stands dimmed beside it.
    expect(card.querySelector(".ui-frame__body header")?.textContent).toBe("Your army is lost+128Rare+1 site");
    expect(card.querySelector(".ui-frame__body header .opacity-50")?.textContent).toBe("+128Rare+1 site");
    expect(card.querySelector('[data-icon="troops"]')).toBeNull();
    expect(card.querySelector('[data-tip="Knight"]')).not.toBeNull();
    expect(card.textContent).toContain("2,300");
    expect(card.querySelector('[aria-label="128 LORDS"]')).not.toBeNull();
    // The chest's rarity is its word on its plate, never pips.
    expect(card.querySelector(".ui-rarity")?.textContent).toBe("Rare");
    expect(card.querySelectorAll(".ui-rarity i")).toHaveLength(0);
    const attack = buttons().find((button) => button.textContent?.startsWith("Attack"))!;
    expect(attack.disabled).toBe(false);
    expect(attack.dataset.kind).toBe("danger");
    // The headline already says it: no line under Attack says it again.
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it("reads the owner's Blightglow Rift as this attack leaves it: 794 → 193 against 1,400 → 1,033, and warns of no loss", () => {
    // Prod, 3 November 2026: this attack leaves the army 193, and the card said "Army will be lost" of a second attack
    // it does not send (owner: "the army will be lost shouldnt be shown either ?").
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
          xp={93}
          verb={{ kind: "attack", stamina: 30, onAttack }}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='Blightglow Rift']")!;
    const header = card.querySelector(".ui-frame__body header")!;
    expect(header.textContent).toBe("The guard holds+4,200+93 XP+1 site");
    expect(header.querySelector(".opacity-50")?.textContent).toBe("+4,200+93 XP+1 site");
    expect(card.textContent).toContain("794");
    expect(card.textContent).toContain("193");
    expect(card.textContent).toContain("1,400");
    expect(card.textContent).toContain("1,033");
    expect(card.textContent).not.toContain("Army will be lost");
    expect(document.querySelector('[role="status"]')).toBeNull();
    // Under each side's bar, what this attack costs it, in troops and in share (owner, 3 November 2026: layout A).
    const sides = [...card.querySelectorAll(".ui-frame__body > .flex.gap-2 > *")].map((side) => side.textContent);
    expect(sides).toEqual(["794 →193−601 · 76% lost", "1,400 →1,033−367 · 26% lost"]);
    const attack = buttons().find((button) => button.textContent?.startsWith("Attack"))!;
    expect(attack.dataset.kind).toBe("primary");
    // An attack the army survives is confirmed by Enter, as any other.
    act(() => void document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onAttack).toHaveBeenCalledOnce();
  });

  it("still earns a site on the Season board for a clear that pays nothing, and an army counts none", () => {
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
          xp={undefined}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector(".ui-frame__body header")?.textContent).toBe("This attack earns+1 site");
    // The chip says what the board ranks by on its tip.
    expect(document.querySelector('[aria-label="Sites cleared +1 site"]')?.getAttribute("data-tip")).toBe(
      "Ranked by sites cleared, then deepest depth",
    );
    act(() =>
      root.render(
        <SiteCardView
          site="Army"
          beast={undefined}
          army={army}
          guard={1_100}
          fight={{ troopsLost: 180, guardLeft: 0 }}
          pay={null}
          xp={undefined}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector(".ui-frame__body header")?.textContent).toBe("This attack clears it");
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
          xp={82}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onRealm={onRealm}
          onClose={() => {}}
        />,
      ),
    );
    const header = document.querySelector(".ui-frame__body header")!;
    expect(header.textContent).toBe("This attack earns+120Full: the rest did not fit+82 XP+1 site");
    // The loss is said in sight on the chip, never only on a hover a phone has not got.
    expect(header.querySelector('[data-tip*="did not fit"]')).toBeNull();
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
          xp={82}
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
  it("names a rift by its name and kind, as the map's hover does, with an army chosen or not", () => {
    // The playtest's Brimdeep: its hover reads "Brimdeep Rift" over "Dark fey".
    const [hover] = plateRows({
      kind: "structure",
      relation: "neutral",
      owner: "",
      beast: "Dark fey",
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
            beast={{ name: "Dark fey", beast: "dark-fey", combatClass: "Paladin" }}
            army={chosen}
            guard={1_200}
            fight={undefined}
            pay={{ icon: "essence", amount: 3_600 }}
            xp={86}
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
          beast={{ name: "Basilisk", beast: "basilisk", combatClass: "Knight" }}
          army={null}
          guard={1_100}
          fight={undefined}
          pay={null}
          xp={undefined}
          verb={null}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='North Watch Ruin']")!;
    expect(card.textContent?.match(/North Watch/g)).toHaveLength(1);
    // Its kind is in its title, as the hover says it; the guard's token, its strength under it, then its beast.
    expect(card.querySelector(".ui-frame__body header")?.textContent).toBe("1,100Basilisk+1 site");
    expect(card.querySelector("header [role='img']")?.getAttribute("aria-label")).toBe("Basilisk 1,100");
    expect(card.textContent?.match(/1,100|1\.1K/g)).toHaveLength(1);
  });

  // Owner, 28 October 2026: "agree with no picker".
  it("lists no army and offers no step: what the site is and pays, and its guard", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Rift"
          beast={{ name: "Dark fey", beast: "dark-fey", combatClass: "Knight" }}
          army={null}
          guard={1_100}
          fight={undefined}
          pay={{ icon: "essence", amount: 3_300 }}
          xp={82}
          verb={null}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[data-kit-sheet]")!;
    expect(card.querySelector(".ui-frame__body header")?.textContent).toBe("1,100Dark fey+3,300+82 XP+1 site");
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
      xp={82}
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
          beast={{ name: "Dark fey", beast: "dark-fey", combatClass: "Knight" }}
          army={army}
          guard={1_100}
          fight={undefined}
          pay={{ icon: "essence", amount: 300 }}
          xp={82}
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
          beast={{ name: "Dark fey", beast: "dark-fey", combatClass: "Knight" }}
          army={army}
          guard={1_100}
          fight={undefined}
          pay={{ icon: "essence", amount: 300 }}
          xp={82}
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
        beast={{ name: "Wraith", beast: "wraith", combatClass: "Knight" }}
        army={null}
        guard={314}
        fight={undefined}
        pay={null}
        xp={44}
        verb={null}
        onClose={() => {}}
      />,
    ),
  );
  expect(host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label")).toBe("Wraith");
});

it("explains the daily ruin choice and disables an unfunded attack", () => {
  act(() =>
    root.render(
      <SiteCardView
        site="Ruin"
        beast={undefined}
        army={army}
        guard={1000}
        fight={undefined}
        pay={null}
        chest={{ tier: 4, lords: 500 }}
        xp={80}
        ruinChoice={{ depth: "Ethereal II" }}
        verb={{ kind: "blocked", reason: "Today's LORDS budget cannot fund this ruin." }}
        onClose={() => {}}
      />,
    ),
  );
  // The ruin's rule is in sight on the card, never only on a hover (owner, 30 October: "the text here could be more
  // explicit !").
  expect(host.querySelector("[data-ruin-rule]")!.textContent).toBe("Ethereal II · One ruin a day · the rest vanish");
  expect(host.querySelector("[data-ruin-rule] [data-tip]")).toBeNull();
  expect(host.textContent).toContain("Today's LORDS budget cannot fund this ruin.");
  const attack = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Attack",
  )!;
  expect(attack.disabled).toBe(true);
  act(() => attack.click());
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
              xp={undefined}
              verb={verb}
              onClose={() => {}}
            />,
          ),
        );
        const sides = [
          ...document.querySelectorAll('section[role=dialog] .ui-frame__body > .flex.gap-2 [role="img"]'),
        ].map((side) => side.getAttribute("aria-label"));
        // Each side as heard, with what the attack costs it where the fight is known.
        const heard = (said: string, lost: string | undefined) => (lost ? `${said}, ${lost}` : said);
        expect(sides).toEqual([heard(`Army 5,000 → ${kept[0]}`, lost[0]), heard(`Troops 1,100 → ${kept[1]}`, lost[1])]);
        expect(document.querySelector('[role="status"]')?.textContent).toBe(line(TARGET_MARKS[target].word));
        expect(buttons().find((button) => button.textContent?.startsWith("Attack"))?.disabled).toBe(!attacks);
        // Attack's stamina is said once: its cost beside it, or why it is held back in the cost's place.
        expect(document.querySelector(".ui-cost")?.textContent).toBe(attacks ? "30 stamina" : undefined);
      });
});
