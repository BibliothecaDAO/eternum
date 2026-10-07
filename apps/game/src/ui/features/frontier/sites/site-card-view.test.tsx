import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RuinChestMoment } from "../chest/ruin-chest-moment";
import { SiteCardView } from "./site-card-view";
import { SiteClearCard } from "./site-clear-card";

const text = (markup: string) => new DOMParser().parseFromString(markup, "text/html").body.textContent ?? "";

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

const army = { art: "/images/armies/knightT1.png", troops: 5_000 };
const buttons = () => [...document.querySelectorAll<HTMLButtonElement>("section[role=dialog] button")];

describe("a guarded site's card", () => {
  it("forecasts a win as attacks to win and troops lost, and pays what the clear sends home with its XP", () => {
    const onAttack = vi.fn();
    act(() =>
      root.render(
        <SiteCardView
          site="camp"
          beast={undefined}
          army={army}
          guard={1_100}
          fight={{ outcome: "wins", exchanges: 1, troopsLost: 180, guardLeft: 0 }}
          pay={{ icon: "La", amount: 550 }}
          xp={82}
          verb={{ kind: "attack", stamina: 30, sending: false, onAttack }}
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

  it("shows a loss in amber with the guard left, dims a ruin's chest, and keeps the same Attack", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="ruin"
          beast="Troll"
          army={{ ...army, troops: 1_200 }}
          guard={3_400}
          fight={{ outcome: "loses", exchanges: 3, troopsLost: 1_200, guardLeft: 2_300 }}
          pay={null}
          chest={{ tier: 3, lords: 128 }}
          xp={145}
          verb={{ kind: "attack", stamina: 30, sending: false, onAttack: () => {} }}
          onClose={() => {}}
        />,
      ),
    );
    const card = document.querySelector("section[aria-label='Ruin']")!;
    expect(card.textContent).toContain("Troll");
    expect(card.textContent).toContain("2,300");
    expect(card.querySelector('[aria-label="128 LORDS"]')).not.toBeNull();
    expect(card.querySelector('[aria-label="Rare"]')).not.toBeNull();
    expect(buttons().some((button) => button.textContent?.startsWith("Attack"))).toBe(true);
  });

  it("says what fits when the store would overflow, with Realm to make room; never blocks the attack", () => {
    const onRealm = vi.fn();
    act(() =>
      root.render(
        <SiteCardView
          site="camp"
          beast={undefined}
          army={army}
          guard={1_100}
          fight={{ outcome: "wins", exchanges: 1, troopsLost: 180, guardLeft: 0 }}
          pay={{ icon: "La", amount: 550, fits: 120 }}
          xp={82}
          verb={{ kind: "attack", stamina: 30, sending: false, onAttack: () => {} }}
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

  it("replaces Attack with the stamina held against its cost when the army is short", () => {
    act(() =>
      root.render(
        <SiteCardView
          site="camp"
          beast={undefined}
          army={army}
          guard={1_100}
          fight={{ outcome: "wins", exchanges: 1, troopsLost: 180, guardLeft: 0 }}
          pay={{ icon: "La", amount: 550 }}
          xp={82}
          verb={{ kind: "short", stamina: { cost: 30, held: 10, wait: 40 * 60 } }}
          onClose={() => {}}
        />,
      ),
    );
    expect(buttons().some((button) => button.textContent?.startsWith("Attack"))).toBe(false);
    expect(document.querySelector('[role="status"]')?.textContent).toBe("10 / 3040m");
  });
});

describe("the clear and its chest", () => {
  it("pays what fitted large, the full amount small beside a full bar, its XP and the troops lost", () => {
    const card = text(
      renderToStaticMarkup(
        <SiteClearCard
          site="Camp"
          paid={{ icon: "La", amount: 120, full: 550 }}
          xp={22}
          troopsLost={180}
          onClose={() => {}}
        />,
      ),
    );
    expect(card).toBe("+120550+22XP−180");
  });

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
