import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpeningPartGate, OpeningProvider } from "./opening-context";
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
    expect(partShown(launch, "relic-slots")).toBe(false);
    expect(partShown(launch, "bane-row")).toBe(false);
    const barracks = new Set<OpeningMoment>(["launch", "barracks"]);
    expect(partShown(barracks, "troops-store")).toBe(true);
    expect(partShown(barracks, "building-list")).toBe(true);
    expect(partShown(barracks, "essence-store")).toBe(false);
    expect(partShown(new Set<OpeningMoment>(["launch", "relic"]), "relic-slots")).toBe(true);
  });

  it("keeps a part earned on an earlier day: only the moment counts, not what is held now", () => {
    expect(partShown(new Set<OpeningMoment>(["essence"]), "essence-store")).toBe(true);
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
    expect(line("guard")).toContain("A blade or a bow shows its kind. Send 150% of the guard's troops to win.");
    expect(line("oath")).toContain(
      "Take one and your army has it for today. A full army swaps one. You can also pass for +20 stamina.",
    );
    expect(line("shop")).toContain("Stamina refills +1/min. A Fragment refills 2 points now.");
    expect(line("relic")).toContain("A relic works for 30 minutes per tier. An army carries 3.");
    expect(line("city")).toContain("Scouts reveal for 10 stamina, not 20.");
    expect(line("spire")).toContain("Guards are x2 on each layer down. A cleared camp refills your armies.");
    expect(line("essence")).toContain("Essence buys research and lores.");
    expect(line("well-lore")).toContain("Your armies can now find wells.");
    expect(line("shrine-lore")).toContain("Your armies can now find shrines.");
    expect(line("deep")).toContain("Every tick (120 seconds) here, each army loses 200 troops. Hold a site to earn.");
    expect(line("bane")).toContain("A bane. Today's quest is the bane quest.");
    expect(line("aspects")).toContain("Your Aspect races to build its hyperstructure.");
  });

  it("draws a gated part once its moment is reached, and every part outside the HUD's provider", () => {
    const draw = (opened?: Set<OpeningMoment>) =>
      act(() =>
        root.render(
          opened ? (
            <OpeningProvider opened={opened}>
              <OpeningPartGate part="research">
                <i data-part />
              </OpeningPartGate>
            </OpeningProvider>
          ) : (
            <OpeningPartGate part="research">
              <i data-part />
            </OpeningPartGate>
          ),
        ),
      );
    draw(new Set(["launch"]));
    expect(host.querySelector("[data-part]")).toBeNull();
    draw(new Set(["launch", "essence"]));
    expect(host.querySelector("[data-part]")).not.toBeNull();
    draw();
    expect(host.querySelector("[data-part]")).not.toBeNull();
  });

  it("puts the line away with Got it", () => {
    const onGotIt = vi.fn();
    line("essence", onGotIt);
    act(() => [...host.querySelectorAll("button")].find((each) => each.textContent === "Got it")!.click());
    expect(onGotIt).toHaveBeenCalledTimes(1);
  });
});
