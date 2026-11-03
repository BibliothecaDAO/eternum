import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { planRealmLabor, seasonStrip } from "./realm-labor";
import { RealmsSheet } from "./realms-sheet";
import type { RealmLaborFacts } from "./use-realm-labor";

/** A Devcon home on Day 12, its claim taken: the moment push ask A comes. */
const claimed: RealmLaborFacts = {
  plan: planRealmLabor({ eligible: true, claimed: true, amount: 2_000, essence: 2_000, held: 0, limit: 18_000 }),
  dailyAmount: 2_000,
  dailyEssence: 2_000,
  home: { kind: "realm", realmId: 3, name: "Stolsli" },
  days: seasonStrip({ today: 11, last: 40, founded: 0, claimed: () => true, claimedToday: true }),
  secondsLeft: 7 * 3_600,
  nextDay: 13,
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

const sheet = (dayAsk: Parameters<typeof RealmsSheet>[0]["dayAsk"]) => {
  act(() =>
    root.render(
      <RealmsSheet
        labor={claimed}
        map={null}
        ask={{ kind: "remind", busy: false, act: vi.fn() }}
        dayAsk={dayAsk}
        sending={false}
        onClaim={vi.fn()}
        onClose={vi.fn()}
      />,
    ),
  );
  // The sheet's own buttons: its body's and its foot's, not its frame's way out.
  return [...host.querySelectorAll(".realm-labor button, .ui-window__foot button")].map((button) => button.textContent);
};

it("puts the game day's ask after the claim in the countdown's place, and Not now gives back the countdown and its Remind me", () => {
  const notNow = vi.fn();
  expect(sheet({ ask: { kind: "remind", busy: false, act: vi.fn() }, nextDay: 13, offer: vi.fn(), notNow })).toEqual([
    "Not now",
    "Turn on alerts",
  ]);
  // It says the countdown it stands in place of, and what the push brings.
  expect(host.querySelector('[role="timer"]')).toBeNull();
  expect(host.querySelector(".ui-notice")?.textContent).toBe(
    "Day 13 opens in 7h. Get one push when your claim is ready.",
  );
  act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Not now")!.click());
  expect(notNow).toHaveBeenCalledOnce();
  // Held by Not now (useDayAsk answers null): the small Remind me stays beside the next day's time.
  expect(sheet(null)).toEqual(["Remind me"]);
  expect(host.querySelector(".ui-notice")).toBeNull();
  expect(host.querySelector('[role="timer"]')?.textContent).toBe("Day 13 opens in 7hRemind me");
});
