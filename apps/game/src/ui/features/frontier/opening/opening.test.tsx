import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OPENING, OPENING_MOMENTS, partShown, type OpeningMoment } from "./opening";
import { OPENING_RULES } from "./opening-fixtures";
import { OpeningLineView } from "./opening-line-view";

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

const line = (moment: OpeningMoment, onGotIt = () => {}) => {
  act(() => root.render(<OpeningLineView moment={moment} rules={OPENING_RULES} onGotIt={onGotIt} />));
  return host.textContent ?? "";
};

describe("the interface that opens as you play", () => {
  it("shows no waiting part at launch, and a part once its moment is reached", () => {
    const launch = new Set<OpeningMoment>(["launch"]);
    expect(partShown(launch, "troops-store")).toBe(false);
    expect(partShown(launch, "bane-row")).toBe(false);
    const barracks = new Set<OpeningMoment>(["launch", "barracks"]);
    expect(partShown(barracks, "troops-store")).toBe(true);
    expect(partShown(barracks, "building-list")).toBe(true);
    expect(partShown(barracks, "army-xp")).toBe(false);
  });

  it("keeps a part earned on an earlier day: only the moment counts, not what is held now", () => {
    expect(partShown(new Set<OpeningMoment>(["fight"]), "army-xp")).toBe(true);
  });

  it("shows every part with Show everything, outside the game's HUD or while watching", () => {
    for (const moment of OPENING_MOMENTS)
      for (const part of OPENING[moment].parts) expect(partShown("all", part)).toBe(true);
  });

  it("waits each part on exactly one moment", () => {
    const parts = OPENING_MOMENTS.flatMap((moment) => OPENING[moment].parts);
    expect(new Set(parts).size).toBe(parts.length);
  });

  it("says the design's line for each moment, naming the rules it reads", () => {
    expect(line("launch")).toContain("This is your Realm. Build on the lit plot, then send an army into the mist.");
    expect(line("barracks")).toContain("A Barracks raises 100 Knights an hour. Knights fill your armies.");
    expect(line("guard")).toContain("Send 150% of the guard's troops to win.");
    expect(line("fight")).toContain("Armies earn XP by fighting. Enough XP gives a skill point.");
    expect(line("essence")).toContain("Essence buys research and lores.");
    expect(line("well-lore")).toContain("Your armies can now find wells.");
    expect(line("shrine-lore")).toContain("Your armies can now find shrines.");
    expect(line("deep")).toContain("Every tick (120 seconds) here, each army loses 200 troops. Hold a site to earn.");
    expect(line("bane")).toContain("A bane. Today's quest is the bane quest.");
  });

  it("puts the line away with Got it", () => {
    const onGotIt = vi.fn();
    line("fight", onGotIt);
    act(() => [...host.querySelectorAll("button")].find((each) => each.textContent === "Got it")!.click());
    expect(onGotIt).toHaveBeenCalledTimes(1);
  });
});
