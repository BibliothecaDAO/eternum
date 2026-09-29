import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { plays } = vi.hoisted(() => ({ plays: [] as string[] }));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: (id: string) => (plays.push(id), Promise.resolve(null)) }) },
}));
vi.mock("@/ui/motion/motion-settings", () => ({ playHaptic: () => {}, useReducedMotion: () => true }));

import type { ArmyProgressFacts, AttributeOfferFacts, ProgressionRulesFacts } from "./attributes";
import {
  closePick,
  commitPick,
  liftChoice,
  onAttributeChosen,
  openPick,
  shouldAutoOpenPick,
  usePick,
} from "./pick-moment";
import { PickPanel } from "./pick-panel";

const LEVEL_OFFER: AttributeOfferFacts = {
  id: 7,
  source: "Level",
  amount: 1,
  choices: ["Battle", "Scouting", "Support"],
};
const RULES: ProgressionRulesFacts = { game_id: 1, reveal_xp: 10, clear_xp: 25, level_step_xp: 20 };
const ARMY: ArmyProgressFacts = {
  game_id: 1,
  explorer_id: 201,
  level: 3,
  xp: 40,
  battle: 2,
  logistics: 1,
  scouting: 4,
  support: 1,
  pending: LEVEL_OFFER,
};

let read: () => ReturnType<typeof usePick> = () => null;
const Probe = () => {
  const pick = usePick();
  read = () => pick;
  return null;
};

beforeEach(() => {
  closePick();
  plays.length = 0;
});

describe("the pick", () => {
  it("opens on its own for the session's first level-up and for every Shrine offer", () => {
    expect(shouldAutoOpenPick({ ...LEVEL_OFFER, source: "Relic" })).toBe(false);
    expect(shouldAutoOpenPick(LEVEL_OFFER)).toBe(true);
    expect(shouldAutoOpenPick({ ...LEVEL_OFFER, id: 8 })).toBe(false);
    // Every Shrine offer opens it: the player used the Shrine to pick.
    expect(shouldAutoOpenPick({ ...LEVEL_OFFER, id: 9, source: "Shrine" })).toBe(true);
    expect(shouldAutoOpenPick({ ...LEVEL_OFFER, id: 10, source: "Shrine" })).toBe(true);
  });

  it("takes two taps, keeps the offer with its reason on a refusal, and flies home only on its own story", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Probe />));
    const send = vi.fn(() => Promise.reject(new Error("This offer was already answered.")));

    await act(async () => openPick(201, LEVEL_OFFER));
    expect(plays).toEqual(["card.deal"]);
    await act(async () => commitPick(send));
    expect(send).not.toHaveBeenCalled();
    await act(async () => liftChoice("Scouting"));
    await act(async () => commitPick(send));
    expect(send).toHaveBeenCalledWith("Scouting");
    expect(read()).toMatchObject({ phase: "failed", error: "This offer was already answered.", lifted: "Scouting" });

    await act(async () =>
      onAttributeChosen({ explorerId: 201, offerId: 99, attribute: "Scouting", applied: 1, lost: 0 }),
    );
    expect(read()?.phase).toBe("failed");
    await act(async () =>
      onAttributeChosen({ explorerId: 201, offerId: 7, attribute: "Scouting", applied: 1, lost: 0 }),
    );
    expect(read()).toMatchObject({ phase: "chosen", chosen: { applied: 1, lost: 0 } });
    expect(plays).toContain("card.pick");
    await act(async () => root.unmount());
  });

  it("closes when the offer leaves the army's progress, however it was answered", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    const root = createRoot(host);
    const commit = () => Promise.resolve();
    await act(async () =>
      root.render(
        <>
          <Probe />
          <PickPanel progress={ARMY} rules={RULES} commit={commit} />
        </>,
      ),
    );
    await act(async () => openPick(201, LEVEL_OFFER));
    expect(host.querySelector('[aria-label="Choose an attribute"]')).not.toBeNull();
    await act(async () =>
      root.render(
        <>
          <Probe />
          <PickPanel progress={{ ...ARMY, pending: null }} rules={RULES} commit={commit} />
        </>,
      ),
    );
    expect(read()).toBeNull();
    expect(host.textContent).not.toContain("+1 to one attribute");
    await act(async () => root.unmount());
  });
});
