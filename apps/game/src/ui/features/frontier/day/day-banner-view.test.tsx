import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { DAY_BANNER_WORDS } from "@/ui/design-system/kit/words";
import { aspects, orders, questCatalog } from "@bibliothecadao/types";
import { nativeQuestConstants } from "@bibliothecadao/eternum/game-client";

import { DAY_BANNER_CASES } from "./day-banner-fixtures";
import { DayBannerView, type DayBannerProps, type DayLayout } from "./day-banner-view";

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

const draw = (props: Omit<DayBannerProps, "layout">, layout: DayLayout = "desktop") =>
  act(() => root.render(<DayBannerView {...props} layout={layout} />));
const text = () => host.textContent ?? "";
const reward = (resource: "Labor" | "Essence") => host.querySelector(`[data-reward="${resource}"]`)?.textContent;
const button = (name: string) => [...host.querySelectorAll("button")].find((each) => each.textContent?.includes(name));

describe("the day's banner", () => {
  it("shows the quest's plain-word objective, count, named rewards and claim waiting, with no Collect while it runs", () => {
    draw(DAY_BANNER_CASES["Quest running"]);
    expect(text()).toContain("Camp-breakers");
    expect(host.querySelector("[data-quest-objective]")?.textContent).toBe("Clear 2 camps today");
    expect(text()).toContain("1 of 2 camps");
    expect(text()).toContain("Reward");
    expect(reward("Labor")).toBe("2,000 Labor");
    expect(reward("Essence")).toBe("3,000 Essence");
    expect(button("Collect")).toBeUndefined();
    expect(button("1K")).toBeDefined();
  });

  it("collects once the quest is done, and shows a check once collected", () => {
    const onCollect = vi.fn();
    draw({ ...DAY_BANNER_CASES["Quest done, Collect waits"], onCollect });
    act(() => button("Collect")!.click());
    expect(onCollect).toHaveBeenCalledTimes(1);
    draw(DAY_BANNER_CASES["Quest collected, claim made"]);
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(button("Collect")).toBeUndefined();
  });

  it("offers Collect again once the Aspect ended a world bane", () => {
    draw(DAY_BANNER_CASES["World bane ended, second reward"]);
    expect(button("Collect again")).toBeDefined();
    expect(text()).toContain("Your Aspect ended the bane");
    expect(text()).toContain("The Lights");
    expect(host.querySelector("[data-quest-objective]")?.textContent).toBe("Reveal 60 tiles today");
    expect(text()).toContain("60 of 60 tiles");
    expect(reward("Labor")).toBe("4,000 Labor");
    expect(reward("Essence")).toBe("6,000 Essence");
  });

  it("heads the panel with the bane, members at it, and labels the Altar bane bar with what happens at full", () => {
    draw(DAY_BANNER_CASES["World bane day, members at it"]);
    expect(text()).toContain("Blood Moon");
    expect(text()).toContain("The Stand");
    expect(host.querySelector("[data-quest-objective]")?.textContent).toBe("Clear 3 guarded sites today");
    expect(text()).toContain("1 of 3 sites");
    expect(reward("Labor")).toBe("1,500 Labor");
    expect(reward("Essence")).toBe("1,500 Essence");
    expect(text()).toContain("4 of 6 members");
    const bar = host.querySelector("[data-day-bane-bar]")!;
    expect(bar.textContent).toContain("Your Aspect's Altar bane bar");
    expect(bar.textContent).toContain("30 of 100");
    expect(bar.textContent).toContain(
      "Hold a Deep Altar to charge. At full, sends a bane to the leading rival Aspect tomorrow.",
    );
  });

  it("a rival's bane comes with the Cull, counted in troops, and exactly the sender Aspect's four crests", () => {
    draw(DAY_BANNER_CASES["Rival bane and Triumph"]);
    expect(text()).toContain("The Cull");
    expect(host.querySelector("[data-quest-objective]")?.textContent).toBe("Defeat 6,000 guard troops today");
    expect(text()).toContain("0 of 6,000 troops");
    expect(reward("Labor")).toBe("2,000 Labor");
    expect(reward("Essence")).toBe("3,000 Essence");
    const orderIcons = new Set(orders.map(({ orderId }) => orderMeaning(orderId)));
    const shown = [...host.querySelectorAll("[data-icon]")]
      .map((each) => each.getAttribute("data-icon")!)
      .filter((icon) => orderIcons.has(icon as never));
    const prowess = aspects[0];
    expect(shown.toSorted()).toEqual(
      orders
        .filter((order) => order.aspect === prowess.id)
        .map(({ orderId }) => orderMeaning(orderId))
        .toSorted(),
    );
    expect(shown).toHaveLength(4);
    expect(text()).toContain("Your Aspect's hyperstructure does not grow while the bane lasts");
    expect(text()).toContain("Clear Mist");
  });

  it("says it is reading, and offers nothing, while the facts are not settled", () => {
    draw(DAY_BANNER_CASES["Facts not settled"]);
    expect(text()).toContain("Loading today's quest…");
    expect(button("Collect")).toBeUndefined();
  });

  it("is lighter on a phone while keeping the plain-word objective, named rewards, and labeled Altar bane bar", () => {
    draw(DAY_BANNER_CASES["World bane day, members at it"], "phone");
    expect(host.querySelector("[data-quest-objective]")?.textContent).toBe("Clear 3 guarded sites today");
    expect(reward("Labor")).toBe("1,500 Labor");
    expect(reward("Essence")).toBe("1,500 Essence");
    expect(host.querySelector("[data-day-bane-bar]")?.textContent).toContain("Your Aspect's Altar bane bar");
    expect(text()).not.toContain("Guarded sites have 150% strength while the bane lasts");
    expect(text()).toContain("4 of 6");
    act(() => button("Blood Moon")!.click());
    expect(text()).toContain("Guarded sites have 150% strength while the bane lasts");
  });

  it("never offers LORDS", () => {
    for (const props of Object.values(DAY_BANNER_CASES)) {
      draw(props);
      expect(text().toLowerCase()).not.toContain("lords");
    }
  });

  it("writes a plain-word objective with target for every quest in the catalog", () => {
    const reveals = questCatalog.find((entry) => entry.id === nativeQuestConstants.REVEALS)!;
    expect(DAY_BANNER_WORDS.objectiveLine(reveals.objective, 15)).toBe("Reveal 15 tiles today");
    for (const entry of questCatalog) {
      const line = DAY_BANNER_WORDS.objectiveLine(entry.objective, 15);
      expect(line).toContain("15");
      expect(line.endsWith(" today")).toBe(true);
    }
  });
});
