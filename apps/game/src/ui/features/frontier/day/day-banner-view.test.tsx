import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_BANNER_WORDS } from "@/ui/design-system/kit/words";
import { questCatalog } from "@bibliothecadao/types";
import { nativeQuestConstants } from "@bibliothecadao/eternum/game-client";

import { DAY_BANNER_CASES } from "./day-banner-fixtures";
import { DayBannerView, type DayBannerProps } from "./day-banner-view";

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

const draw = (props: DayBannerProps) => act(() => root.render(<DayBannerView {...props} />));
const text = () => host.textContent ?? "";
const reward = (resource: "Labor" | "Essence") =>
  host.querySelector(`[data-reward="${resource}"]`)?.getAttribute("aria-label");
const button = (name: string) => [...host.querySelectorAll("button")].find((each) => each.textContent?.includes(name));

describe("the quest card", () => {
  it("shows the quest's name, objective, count and rewards, with no Collect while it runs", () => {
    draw(DAY_BANNER_CASES["Quest running"]);
    expect(text()).toContain("Camp-breakers");
    expect(host.querySelector("[data-quest-objective]")?.textContent).toBe("Clear 2 camps");
    expect(host.querySelector("[data-quest-count]")?.textContent).toBe("1/2");
    expect(host.querySelector("[data-quest-count]")?.getAttribute("aria-label")).toBe("1 of 2 camps");
    expect(reward("Labor")).toBe("2,000 Labor");
    expect(reward("Essence")).toBe("3,000 Essence");
    expect(button("Collect")).toBeUndefined();
  });

  it("collects once the quest is done, and shows a check once collected", () => {
    const onCollect = vi.fn();
    draw({ ...DAY_BANNER_CASES["Quest done, Collect waits"], onCollect });
    act(() => button("Collect")!.click());
    expect(onCollect).toHaveBeenCalledTimes(1);
    draw(DAY_BANNER_CASES["Quest collected"]);
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(button("Collect")).toBeUndefined();
  });

  it("offers Collect again when a second reward waits", () => {
    draw(DAY_BANNER_CASES["Second reward waits"]);
    expect(button("Collect again")).toBeDefined();
  });

  it("says it is reading, and offers nothing, while the facts are not settled", () => {
    draw(DAY_BANNER_CASES["Facts not settled"]);
    expect(text()).toContain("Loading today's quest…");
    expect(button("Collect")).toBeUndefined();
  });

  it("writes a plain-word objective with its target for every quest in the catalog", () => {
    const reveals = questCatalog.find((entry) => entry.id === nativeQuestConstants.REVEALS)!;
    expect(DAY_BANNER_WORDS.objectiveLine(reveals.objective, 15)).toBe("Reveal 15 tiles");
    for (const entry of questCatalog) expect(DAY_BANNER_WORDS.objectiveLine(entry.objective, 15)).toContain(" 15");
  });
});
