import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BANNED_WORDS, VOICE_RULES } from "@bibliothecadao/types";
import { OPENING_WORDS } from "@/ui/design-system/kit/words";
import { AspectEmissaryDock } from "../tutorial/aspect-emissary-dock";
import { OpeningPartGate, OpeningProvider } from "./opening-context";
import { OPENING, OPENING_MOMENTS, partShown, TUTORIAL_WORD_BUDGET, type OpeningMoment } from "./opening";
import { OPENING_RULES } from "./opening-fixtures";

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

const renderMoment = (moment: OpeningMoment, onDismiss = () => {}, onSkipAll?: () => void) => {
  act(() =>
    root.render(
      <AspectEmissaryDock moment={moment} rules={OPENING_RULES} onDismiss={onDismiss} onSkipAll={onSkipAll} />,
    ),
  );
  return host.textContent ?? "";
};

describe("the interface that opens as you play", () => {
  it("shows no waiting part initially, and a part once its moment is reached", () => {
    const empty = new Set<OpeningMoment>();
    expect(partShown(empty, "building-list")).toBe(false);
    expect(partShown(empty, "relic-slots")).toBe(false);
    expect(partShown(empty, "bane-row")).toBe(false);
    const barracks = new Set<OpeningMoment>(["barracks"]);
    expect(partShown(barracks, "building-list")).toBe(true);
    expect(partShown(barracks, "essence-store")).toBe(false);
    expect(partShown(new Set<OpeningMoment>(["relic"]), "relic-slots")).toBe(true);
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

  it("keeps every contextual line within the word budget and free of banned or numeric depth jargon", () => {
    const ruleVariants = [OPENING_RULES, { ...OPENING_RULES, dayLeftSeconds: undefined }];
    const completableMoments = OPENING_MOMENTS.filter(
      (moment) => "completesWhen" in OPENING[moment] || "completesWhileShowing" in OPENING[moment],
    );
    expect(Object.keys(OPENING_WORDS.completed).sort()).toEqual([...completableMoments].sort());
    for (const moment of OPENING_MOMENTS) {
      const texts = ruleVariants.flatMap((variant) => [
        OPENING_WORDS.lines[moment](variant),
        OPENING_WORDS.titles[moment](variant),
      ]);
      if (moment in OPENING_WORDS.completed) {
        const { title, line } = OPENING_WORDS.completed[moment as keyof typeof OPENING_WORDS.completed];
        texts.push(title, line);
      }
      for (const text of texts) {
        const words = text.trim().split(/\s+/).filter(Boolean);
        expect(words.length, `${moment}: "${text}"`).toBeLessThanOrEqual(TUTORIAL_WORD_BUDGET);
        for (const entry of BANNED_WORDS) {
          expect(text, `${moment} used banned phrase ${entry.banned}`).not.toMatch(entry.pattern);
        }
        for (const rule of VOICE_RULES) {
          if (rule.forbidden) expect(text, `${moment} broke voice rule ${rule.rule}`).not.toMatch(rule.forbidden);
        }
      }
    }
  });

  it("renders each moment with live rule figures and its desktop action", () => {
    expect(renderMoment("barracks")).toContain("It raises +2/min Knights.");
    expect(renderMoment("deploy")).toContain("2,000 Knights wait at home. Send an army onto the Surface.");
    expect(renderMoment("explore")).toContain("Reveal a dark hex for 20 stamina.");
    expect(renderMoment("oath")).toContain("Swear one Oath, or pass for +20 stamina.");
    expect(renderMoment("shop")).toContain("Stamina returns +1/min. A Fragment refills 2 now or unlocks Ancient Seal.");
    expect(renderMoment("relic")).toContain("Relics last 30 minutes per tier. Each army carries 3.");
    expect(renderMoment("city")).toContain("Scouts reveal mist for 10 stamina instead of 20.");
    expect(renderMoment("spire")).toContain("In the Veil, guards are 2x stronger and camps refill your armies.");
    expect(renderMoment("deep")).toContain("Every 120 seconds here, armies lose 200 troops. Hold sites to earn.");
    expect(renderMoment("day-end")).toContain("Today's map and armies go at day end.");
    expect(renderMoment("bane")).toContain("A bane strikes today.");
    expect(renderMoment("aspects")).toContain("Prowess races to finish its hyperstructure first.");
    expect(renderMoment("daily-quest")).toContain("Today's quest is done.");
    expect(renderMoment("essence")).toContain("Essence buys permanent upgrades and lores for your Realm.");
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
    draw(new Set(["barracks"]));
    expect(host.querySelector("[data-part]")).toBeNull();
    draw(new Set(["barracks", "essence"]));
    expect(host.querySelector("[data-part]")).not.toBeNull();
    draw();
    expect(host.querySelector("[data-part]")).not.toBeNull();
  });

  it("dismisses a line with Close and skips all with Skip tutorial", () => {
    const onDismiss = vi.fn();
    const onSkipAll = vi.fn();
    renderMoment("essence", onDismiss, onSkipAll);
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    const pressSkip = () =>
      act(() => [...host.querySelectorAll("button")].find((each) => each.textContent === "Skip tutorial")!.click());
    pressSkip();
    expect(onSkipAll).not.toHaveBeenCalled();
    pressSkip();
    expect(onSkipAll).toHaveBeenCalledTimes(1);
  });
});
