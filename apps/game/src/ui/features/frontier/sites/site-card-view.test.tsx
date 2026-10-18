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
  it("forecasts a win as attacks to win and troops lost, and pays what the clear sends home with its XP", () => {
    const onAttack = vi.fn();
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={undefined}
          army={army}
          guard={1_100}
          fight={{ outcome: "wins", exchanges: 1, troopsLost: 180, guardLeft: 0 }}
          pay={{ icon: "labor", amount: 550 }}
          xp={82}
          verb={{ kind: "attack", stamina: 30, onAttack }}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='Camp']")!;
    expect(card.textContent).toContain("−180");
    expect(card.textContent).toContain("+550");
    expect(card.querySelector('[aria-label="XP +82"]')).not.toBeNull();
    const attack = buttons().find((button) => button.textContent?.startsWith("Attack"))!;
    expect(attack.textContent).toBe("Attack30");
    act(() => attack.click());
    expect(onAttack).toHaveBeenCalled();
  });

  it("shows a loss in amber with the guard left, dims a ruin's chest, and keeps Attack, in red, saying the army will be lost", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="Ruin"
          beast="Troll"
          army={{ ...army, troops: 1_200 }}
          guard={3_400}
          fight={{ outcome: "loses", exchanges: 3, troopsLost: 1_200, guardLeft: 2_300 }}
          pay={null}
          chest={{ tier: 3, lords: 128 }}
          xp={145}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='Ruin']")!;
    expect(card.textContent).toContain("Troll");
    expect(card.textContent).toContain("2,300");
    expect(card.querySelector('[aria-label="128 LORDS"]')).not.toBeNull();
    expect(card.querySelector('[aria-label="Rare"]')).not.toBeNull();
    const attack = buttons().find((button) => button.textContent?.startsWith("Attack"))!;
    expect(attack.disabled).toBe(false);
    expect([attack.dataset.kind, attack.dataset.tone]).toEqual(["secondary", "bad"]);
    expect(document.querySelector('[role="status"]')?.textContent).toBe("Army will be lost");
  });

  it("says what fits when the store would overflow, with Realm to make room; never blocks the attack", () => {
    const onRealm = vi.fn();
    act(() =>
      root.render(
        <SiteCardView
          site="Camp"
          beast={undefined}
          army={army}
          guard={1_100}
          fight={{ outcome: "wins", exchanges: 1, troopsLost: 180, guardLeft: 0 }}
          pay={{ icon: "labor", amount: 550, fits: 120 }}
          xp={82}
          verb={{ kind: "attack", stamina: 30, onAttack: () => {} }}
          onRealm={onRealm}
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector("section[aria-label='Camp']")!.textContent).toContain("+120");
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
          beast={undefined}
          army={army}
          guard={1_100}
          fight={{ outcome: "wins", exchanges: 1, troopsLost: 180, guardLeft: 0 }}
          pay={{ icon: "labor", amount: 550 }}
          xp={82}
          verb={{ kind: "short", stamina: { cost: 30, held: 10, wait: 40 * 60 } }}
          onClose={() => {}}
        />,
      ),
    );
    expect(buttons().find((button) => button.textContent?.startsWith("Attack"))?.disabled).toBe(true);
    expect(document.querySelector('[role="status"]')?.textContent).toBe("Needs 30 stamina, has 10 · 40m");
  });
});

describe("a guarded site's card with no army chosen", () => {
  it("gives each army a row with the fight it would have, names the skull, and opens the attack on a tap", () => {
    const onPick = vi.fn();
    act(() =>
      root.render(
        <SiteCardView
          site="Rift"
          beast={undefined}
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
              fight: { outcome: "wins", exchanges: 2, troopsLost: 456, guardLeft: 492 },
              onPick,
            },
            {
              label: "Army 2",
              art: army.art,
              troops: 154,
              fight: { outcome: "loses", exchanges: 1, troopsLost: 154, guardLeft: 1_028 },
              onPick: () => {},
            },
            { label: "Army 3", art: army.art, troops: 600, fight: undefined, onPick: () => {} },
          ]}
          onClose={() => {}}
        />,
      ),
    );
    const row = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    // Two attacks win it: the figures are the first one's, the troops it costs and the guard it leaves standing.
    expect(row("Army 1").textContent).toBe("5,000−456492");
    expect(row("Army 1").querySelector('[aria-label="2"]')).not.toBeNull();
    expect(row("Army 2").textContent).toBe("154−1541,028");
    expect(row("Army 2").querySelector('[data-tip="Would be lost"]')).not.toBeNull();
    // Out of reach: the army is still a choice, with no forecast to show and no dash in its place.
    expect(row("Army 3").textContent).toBe("600");
    expect(document.querySelector("section[aria-label='Rift']")!.textContent).not.toContain("—");
    act(() => row("Army 1").click());
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
      fight={{ outcome: fight, exchanges: 1, troopsLost: 180, guardLeft: fight === "wins" ? 0 : 900 }}
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
          beast={undefined}
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
          beast={undefined}
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
    expect(moment.querySelector('[aria-label="Legendary"]')).not.toBeNull();
    act(() => (moment as HTMLButtonElement).click());
    expect(onClose).toHaveBeenCalled();
  });
});
