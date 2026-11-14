import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const button = (name: string) => [...host.querySelectorAll("button")].find((each) => each.textContent?.includes(name));

describe("the day's banner", () => {
  it("shows the quest's count, its reward and the claim waiting, with no Collect while it runs", () => {
    draw(DAY_BANNER_CASES["Quest running"]);
    expect(text()).toContain("Camp-breakers");
    expect(text()).toContain("1 of 2 camps");
    expect(text()).toContain("1,500");
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
  });

  it("heads the panel with the bane and how many members are at it", () => {
    draw(DAY_BANNER_CASES["World bane day, members at it"]);
    expect(text()).toContain("Blood Moon");
    expect(text()).toContain("4 of 6 members");
  });

  it("says it is reading, and offers nothing, while the facts are not settled", () => {
    draw(DAY_BANNER_CASES["Facts not settled"]);
    expect(text()).toContain("Reading today's quest…");
    expect(button("Collect")).toBeUndefined();
  });

  it("is lighter on a phone: the news is chips, and a press opens the bane's line", () => {
    draw(DAY_BANNER_CASES["World bane day, members at it"], "phone");
    expect(text()).not.toContain("Guards hit 25% harder today");
    expect(text()).toContain("4 of 6");
    act(() => button("Blood Moon")!.click());
    expect(text()).toContain("Guards hit 25% harder today");
  });

  it("never offers LORDS", () => {
    for (const props of Object.values(DAY_BANNER_CASES)) {
      draw(props);
      expect(text().toLowerCase()).not.toContain("lords");
    }
  });
});
