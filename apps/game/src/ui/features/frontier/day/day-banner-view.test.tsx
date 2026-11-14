import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { aspects, orders } from "@bibliothecadao/types";

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
  it("shows the quest's count, its reward and the claim waiting, with no Collect while it runs", () => {
    draw(DAY_BANNER_CASES["Quest running"]);
    expect(text()).toContain("Camp-breakers");
    expect(text()).toContain("1 of 2 camps");
    // a City's quest (the level that doubles a Settlement's count and reward), no labor bonus
    expect(reward("Labor")).toBe("2,000");
    expect(reward("Essence")).toBe("3,000");
    expect(button("Collect")).toBeUndefined();
    expect(button("1,000")).toBeDefined();
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
    expect(text()).toContain("60 of 60 tiles");
    // a Kingdom's Lights, no bonus: 4,000 labor and 6,000 Essence
    expect(reward("Labor")).toBe("4,000");
    expect(reward("Essence")).toBe("6,000");
  });

  it("heads the panel with the bane and how many members are at it", () => {
    draw(DAY_BANNER_CASES["World bane day, members at it"]);
    expect(text()).toContain("Blood Moon");
    expect(text()).toContain("The Stand");
    expect(text()).toContain("1 of 3 sites");
    // a Settlement's Stand with the labor bonus: 150% of 1,000 labor, 1,500 Essence
    expect(reward("Labor")).toBe("1,500");
    expect(reward("Essence")).toBe("1,500");
    expect(text()).toContain("4 of 6 members");
  });

  it("a rival's bane comes with the Cull, counted in troops, and exactly the sender Aspect's four crests", () => {
    draw(DAY_BANNER_CASES["Rival bane and Triumph"]);
    expect(text()).toContain("The Cull");
    expect(text()).toContain("0 of 6,000 troops");
    expect(reward("Labor")).toBe("2,000");
    expect(reward("Essence")).toBe("3,000");
    const orderIcons = new Set(orders.map(({ orderId }) => orderMeaning(orderId)));
    const shown = [...host.querySelectorAll("[data-icon]")].map((each) => each.getAttribute("data-icon")!).filter((icon) => orderIcons.has(icon as never));
    const might = aspects[0];
    expect(shown.toSorted()).toEqual(orders.filter((order) => order.aspect === might.id).map(({ orderId }) => orderMeaning(orderId)).toSorted());
    expect(shown).toHaveLength(4);
    expect(text()).toContain("Your Aspect's hyperstructure does not grow today");
    expect(text()).toContain("Clear Mist");
  });

  it("says it is reading, and offers nothing, while the facts are not settled", () => {
    draw(DAY_BANNER_CASES["Facts not settled"]);
    expect(text()).toContain("Reading today's quest…");
    expect(button("Collect")).toBeUndefined();
  });

  it("is lighter on a phone: the news is chips, and a press opens the bane's line", () => {
    draw(DAY_BANNER_CASES["World bane day, members at it"], "phone");
    expect(text()).not.toContain("Each guarded site is 50% harder today");
    expect(text()).toContain("4 of 6");
    act(() => button("Blood Moon")!.click());
    expect(text()).toContain("Each guarded site is 50% harder today");
  });

  it("never offers LORDS", () => {
    for (const props of Object.values(DAY_BANNER_CASES)) {
      draw(props);
      expect(text().toLowerCase()).not.toContain("lords");
    }
  });
});
