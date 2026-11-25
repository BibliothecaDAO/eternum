import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_BANNER_WORDS } from "@/ui/design-system/kit/words";
import { questCatalog, questLine } from "@bibliothecadao/types";

import { QUEST_DOCK_CASES } from "./quest-dock-fixtures";
import { QuestDockView, type QuestDockProps } from "./quest-dock-view";

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

const draw = (props: QuestDockProps) => act(() => root.render(<QuestDockView {...props} />));
const text = () => host.textContent ?? "";
const reward = (resource: "Labor" | "Essence") =>
  host.querySelector(`[data-reward="${resource}"]`)?.getAttribute("aria-label");
const button = (name: string) => [...host.querySelectorAll("button")].find((each) => each.textContent?.includes(name));

describe("the quest dock", () => {
  it("has the quest's Aspect speak its name, objective, count and rewards, with no Collect while it runs", () => {
    draw(QUEST_DOCK_CASES["Quest running"]);
    expect(host.querySelector("aside")?.getAttribute("aria-label")).toBe("Prowess: Daily Quest: Camp-breakers");
    const { quest, reading } = QUEST_DOCK_CASES["Quest running"];
    expect(host.querySelector("[data-quest-objective]")?.textContent).toBe(questLine(quest, reading.target));
    expect([...host.querySelectorAll('[role="meter"]')].map((meter) => meter.getAttribute("aria-label"))).toEqual([
      DAY_BANNER_WORDS.count(reading.progress, reading.target, quest.unit),
    ]);
    expect(text()).not.toContain(DAY_BANNER_WORDS.fraction(reading.progress, reading.target));
    expect(reward("Labor")).toBe("2,000 Labor");
    expect(reward("Essence")).toBe("3,000 Essence");
    expect(button("Collect")).toBeUndefined();
  });

  it("collects once the quest is done, and shows a check once collected", () => {
    const onCollect = vi.fn();
    draw({ ...QUEST_DOCK_CASES["Quest done, Collect waits"], onCollect });
    act(() => button("Collect")!.click());
    expect(onCollect).toHaveBeenCalledTimes(1);
    draw(QUEST_DOCK_CASES["Quest collected"]);
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(button("Collect")).toBeUndefined();
  });

  it("offers Collect again when a second reward waits", () => {
    draw(QUEST_DOCK_CASES["Second reward waits"]);
    expect(button("Collect again")).toBeDefined();
  });

  it("says it is reading, and offers nothing, while the facts are not settled", () => {
    draw(QUEST_DOCK_CASES["Facts not settled"]);
    expect(text()).toContain("Loading today's quest…");
    expect(button("Collect")).toBeUndefined();
  });

  it("names a bane, what it does, how near the Aspect is to breaking it and when it clears, over its quest", () => {
    draw(QUEST_DOCK_CASES["World bane"]);
    expect(host.querySelector("aside")?.getAttribute("aria-label")).toBe("Havoc: World Bane: Ash Fall");
    expect(host.querySelector("aside")?.getAttribute("data-tone")).toBe("bane");
    expect(host.querySelector(".emissary-dock__portrait")?.getAttribute("data-icon")).toBe("bane-ash-fall");
    const bane = host.querySelector("[data-bane-row]")!;
    expect(bane.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(
      "Production runs at 50% while the bane lasts",
    );
    expect(bane.textContent).toBe("▾50% Production2× if brokenBreak: 4/12 of your Aspect · Clears in 5h");
    const { quest, reading } = QUEST_DOCK_CASES["World bane"];
    expect(host.querySelector("[data-quest-objective]")?.textContent).toBe(
      `${quest.name} · ${questLine(quest, reading.target)}`,
    );
    expect(text()).not.toContain(DAY_BANNER_WORDS.fraction(reading.progress, reading.target));
  });

  it("titles a phone's dock with the quest's name alone", () => {
    draw({ ...QUEST_DOCK_CASES["Quest running"], layout: "phone" });
    expect(host.querySelector(".emissary-dock__title")?.textContent).toBe("Camp-breakers");
  });

  it("writes every quest's line with its target, one at a target of 1 and many above", () => {
    for (const entry of questCatalog) {
      expect(questLine(entry, 1)).toBe(`${entry.verb} 1 ${entry.unit.one}`);
      expect(questLine(entry, 15)).toBe(`${entry.verb} 15 ${entry.unit.many}`);
      expect(DAY_BANNER_WORDS.count(0, 1, entry.unit)).toBe(`0 of 1 ${entry.unit.one}`);
    }
  });
});
