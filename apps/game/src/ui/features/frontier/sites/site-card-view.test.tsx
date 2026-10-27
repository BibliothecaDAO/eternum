import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RuinChestMoment } from "../chest/ruin-chest-moment";
import { SiteCardView } from "./site-card-view";

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
            outcome: "wins",
            exchanges: 1,
            troopsLost: 180,
            guardLeft: 0,
            whole: { troopsLost: 180, guardKilled: 1_100, stamina: 30 },
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
    expect(card.querySelector(".ui-sheet__body header")?.textContent).toBe("This attack earns+550+82 XP");
    expect(card.querySelector(".ui-sheet__body header .opacity-50")).toBeNull();
    const sides = [...card.querySelectorAll(".ui-sheet__body > .flex.gap-2 > *")].map((side) => side.textContent);
    expect(sides).toEqual(["5,000 →4,820", "1,100 →0"]);
    expect(card.textContent).not.toContain("When cleared");
    expect(card.textContent).toContain("+550");
    expect(card.textContent).toContain("+82 XP");
    const attack = buttons().find((button) => button.textContent?.startsWith("Attack"))!;
    expect(attack.textContent).toBe("Attack");
    expect(card.querySelector(".ui-cost")?.textContent).toBe("30 stamina");
    act(() => attack.click());
    expect(onAttack).toHaveBeenCalled();
  });

  it("stands Details at the foot's left and Attack alone at its right, and opens the whole fight's figures", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
          army={{ ...army, troops: 1_500 }}
          guard={1_300}
          fight={{
            outcome: "wins",
            exchanges: 3,
            troopsLost: 180,
            guardLeft: 740,
            whole: { troopsLost: 610, guardKilled: 1_300, stamina: 90 },
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
    // The way out and Details on the left, Attack last: the shared actions rule puts the last alone on the right.
    expect(words).toEqual(["Details", "Realm", "Attack"]);
    expect(foot.lastElementChild?.textContent).toBe("Attack");
    const details = [...foot.querySelectorAll("button")][0]!;
    expect(details.getAttribute("aria-expanded")).toBe("false");
    expect(document.body.textContent).not.toContain("The whole fight");

    act(() => details.click());
    expect(details.getAttribute("aria-expanded")).toBe("true");
    const whole = [...document.querySelectorAll("section[role=dialog] dl dt, section[role=dialog] dl dd")].map(
      (cell) => cell.textContent,
    );
    expect(whole).toEqual([
      "Attacks",
      "3 · The guard falls",
      "You lose",
      "−610",
      "You kill",
      "1,300 / 1,300",
      "Stamina",
      "90",
    ]);
    expect(document.body.textContent).not.toContain("When cleared");
    expect(document.body.textContent).not.toContain("Cleared in");

    act(() => details.click());
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
            outcome: "loses",
            exchanges: 3,
            troopsLost: 1_200,
            guardLeft: 2_300,
            whole: { troopsLost: 1_200, guardKilled: 1_100, stamina: 90 },
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
    expect(card.querySelector(".ui-sheet__body header")?.textContent).toBe("Your army is lost+128Rare");
    expect(card.querySelector(".ui-sheet__body header .opacity-50")?.textContent).toBe("+128Rare");
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

  it("holds the clear's reward dimmed under a guard that holds, and warns under Attack when the whole fight loses the army", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
          army={{ ...army, troops: 1_200 }}
          guard={3_400}
          fight={{
            outcome: "loses",
            exchanges: 3,
            troopsLost: 400,
            guardLeft: 3_000,
            whole: { troopsLost: 1_200, guardKilled: 1_200, stamina: 90 },
          }}
          pay={{ icon: "labor", amount: 550 }}
          xp={82}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    const header = document.querySelector(".ui-sheet__body header")!;
    expect(header.textContent).toBe("The guard holds+550+82 XP");
    expect(header.querySelector(".opacity-50")?.textContent).toBe("+550+82 XP");
    expect(document.querySelector('[role="status"]')?.textContent).toBe("Army will be lost");
  });

  it("says only that the attack clears a site that pays nothing", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
          army={army}
          guard={1_100}
          fight={{
            outcome: "wins",
            exchanges: 1,
            troopsLost: 180,
            guardLeft: 0,
            whole: { troopsLost: 180, guardKilled: 1_100, stamina: 30 },
          }}
          pay={null}
          xp={undefined}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector(".ui-sheet__body header")?.textContent).toBe("This attack clears it");
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
            outcome: "wins",
            exchanges: 1,
            troopsLost: 180,
            guardLeft: 0,
            whole: { troopsLost: 180, guardKilled: 1_100, stamina: 30 },
          }}
          pay={{ icon: "labor", amount: 550, fits: 120 }}
          xp={82}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onRealm={onRealm}
          onClose={() => {}}
        />,
      ),
    );
    const header = document.querySelector(".ui-sheet__body header")!;
    expect(header.textContent).toBe("This attack earns+120Full+82 XP");
    expect(header.querySelector('[data-tip="Storage full: the rest did not fit"]')).not.toBeNull();
    act(() =>
      buttons()
        .find((button) => button.textContent === "Realm")!
        .click(),
    );
    expect(onRealm).toHaveBeenCalled();
    expect(buttons().some((button) => button.textContent?.startsWith("Attack"))).toBe(true);
  });

  it("holds Attack back when the army is short, with the stamina it needs, what it has and the wait under it", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={{ name: "Troll", beast: "troll", combatClass: "Knight" }}
          army={army}
          guard={1_100}
          fight={{
            outcome: "wins",
            exchanges: 1,
            troopsLost: 180,
            guardLeft: 0,
            whole: { troopsLost: 180, guardKilled: 1_100, stamina: 30 },
          }}
          pay={{ icon: "labor", amount: 550 }}
          xp={82}
          verb={{ kind: "short", stamina: { cost: 30, held: 10, wait: 40 * 60 } }}
          onClose={() => {}}
        />,
      ),
    );
    expect(buttons().find((button) => button.textContent?.startsWith("Attack"))?.disabled).toBe(true);
    expect(document.querySelector('[role="status"]')?.textContent).toBe("Needs 30 stamina, have 10 · in 40m");
  });
});

describe("a guarded site's card with no army chosen", () => {
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
          choices={[{ label: "Army 1", ...army, fight: undefined, onPick: () => {} }]}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='North Watch']")!;
    expect(card.textContent?.match(/North Watch/g)).toHaveLength(1);
    expect(card.querySelector(".ui-sheet__body header")?.textContent).toBe("RuinBasilisk1.1K");
  });

  it("gives each army a row with the fight it would have, names the skull, and opens the attack on a tap", () => {
    const onPick = vi.fn();
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
          choices={[
            {
              label: "Army 1",
              art: army.art,
              troops: 5_000,
              fight: {
                outcome: "wins",
                exchanges: 2,
                troopsLost: 456,
                guardLeft: 492,
                whole: { troopsLost: 912, guardKilled: 1_100, stamina: 60 },
              },
              onPick,
            },
            {
              label: "Army 2",
              art: army.art,
              troops: 154,
              fight: {
                outcome: "loses",
                exchanges: 1,
                troopsLost: 154,
                guardLeft: 1_028,
                whole: { troopsLost: 154, guardKilled: 72, stamina: 30 },
              },
              onPick: () => {},
            },
            { label: "Army 3", art: army.art, troops: 600, fight: undefined, onPick: () => {} },
          ]}
          onClose={() => {}}
        />,
      ),
    );
    /** An army's row: its button names it and its troops, its forecast sits beside the button. */
    const row = (label: string) =>
      [...document.querySelectorAll(".ui-row")].find((candidate) =>
        candidate.querySelector("button")?.textContent?.startsWith(`${label}`),
      )!;
    // Two attacks win it, counted beside the flag: the figures are the first one's, the troops it costs and the guard it
    // leaves standing.
    expect(row("Army 1").querySelector('[data-icon="beast-dark-fey"]')).not.toBeNull();
    expect(row("Army 1").textContent).toBe("Army 15,000 troops×2−456492");
    expect(row("Army 1").querySelector('[data-tip="Attacks"]')?.textContent).toBe("×2");
    expect(row("Army 2").textContent).toBe("Army 2154 troops−1541,028");
    expect(row("Army 2").querySelector('[data-tip="Would be lost"]')).not.toBeNull();
    // Out of reach: the army is still a choice, with no forecast to show and no dash in its place.
    expect(row("Army 3").textContent).toBe("Army 3600 troops");
    expect(document.body.textContent).toContain("Pick an army to attack it");
    expect(document.querySelector("section[aria-label='Rift']")!.textContent).not.toContain("—");
    act(() => row("Army 1").querySelector("button")!.click());
    expect(onPick).toHaveBeenCalled();
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
        outcome: fight,
        exchanges: 1,
        troopsLost: 180,
        guardLeft: fight === "wins" ? 0 : 900,
        whole: { troopsLost: 180, guardKilled: fight === "wins" ? 1_100 : 200, stamina: 30 },
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

describe("a cleared ruin's chest", () => {
  it("opens a ruin's chest with its exact LORDS and tier, and goes on with a tap", () => {
    const onClose = vi.fn();
    act(() => root.render(<RuinChestMoment tier={5} lords={640} xp={145} troopsLost={1_250} onClose={onClose} />));
    const moment = host.querySelector("button[aria-label='Ruin']")!;
    expect(moment.querySelector('[aria-label="640 LORDS"]')).not.toBeNull();
    expect(moment.querySelector(".ui-rarity")?.textContent).toBe("Legendary");
    act(() => (moment as HTMLButtonElement).click());
    expect(onClose).toHaveBeenCalled();
  });
});

it("says where an army comes from when the realm has none out, in the place of the rows", () => {
  act(() =>
    root.render(
      <SiteCardView
        site="Camp"
        army={null}
        beast={undefined}
        guard={1_100}
        fight={undefined}
        pay={null}
        xp={undefined}
        verb={null}
        choices={[]}
        onClose={() => {}}
      />,
    ),
  );
  expect(document.querySelectorAll(".ui-row")).toHaveLength(0);
  expect(document.body.textContent).toContain("No army out: deploy one");
  expect(document.body.textContent).not.toContain("Pick an army");
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
