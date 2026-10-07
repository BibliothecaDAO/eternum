import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { plays } = vi.hoisted(() => ({ plays: [] as string[] }));
vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: (id: string) => (plays.push(id), Promise.resolve(null)) }) },
}));
vi.mock("@/ui/motion/motion-settings", () => ({ playHaptic: () => {}, useReducedMotion: () => true }));

import type { ArmyProgressFacts, ProgressionRulesFacts } from "./attributes";
import { closePick, commitPick, liftChoice, onTierBought, openPick, usePick } from "./pick-moment";
import { PickPanel } from "./pick-panel";

const RULES: ProgressionRulesFacts = {
  game_id: 1,
  reveal_xp: 2,
  fixed_xp: 200,
  uncommon_xp: 100,
  rare_xp: 200,
  epic_xp: 400,
  legendary_xp: 800,
};
const ARMY: ArmyProgressFacts = {
  game_id: 1,
  explorer_id: 201,
  xp: 250,
  battle: 2,
  logistics: 1,
  scouting: 5,
  scouting_kinds: 0b10_10_10_10,
  homecoming: 1,
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

describe("the Upgrade", () => {
  it("takes two taps, keeps the card with its reason on a refusal, and flies home only on its own army's story", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Probe />));
    let reject: (error: Error) => void = () => {};
    const send = vi.fn(() => new Promise<void>((_, fail) => (reject = fail)));

    await act(async () => openPick(201));
    expect(plays).toEqual(["card.deal"]);
    await act(async () => commitPick(send));
    expect(send).not.toHaveBeenCalled();
    await act(async () => liftChoice("Battle"));
    await act(async () => commitPick(send));
    expect(send).toHaveBeenCalledWith("Battle");
    // Another army's purchase lands nothing here.
    await act(async () => onTierBought({ explorerId: 202, attribute: "Battle", tier: 3, price: 200 }));
    expect(read()?.phase).toBe("committing");
    await act(async () => onTierBought({ explorerId: 201, attribute: "Battle", tier: 3, price: 200 }));
    expect(read()).toMatchObject({ phase: "chosen", chosen: { tier: 3, price: 200 } });
    expect(plays).toContain("card.pick");

    await act(async () => openPick(201));
    await act(async () => liftChoice("Logistics"));
    await act(async () => commitPick(send));
    await act(async () => reject(new Error("not enough XP")));
    expect(read()).toMatchObject({ phase: "failed", error: "not enough XP", lifted: "Logistics" });
    await act(async () => root.unmount());
  });

  it("deals every attribute priced at its next tier, and lights only those the army can pay for", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<PickPanel progress={ARMY} rules={RULES} commit={() => Promise.resolve()} />));
    await act(async () => openPick(201));
    const card = (attribute: string) => host.querySelector<HTMLButtonElement>(`[aria-label^="${attribute}, tier"]`)!;
    expect(host.textContent).toContain("250 XP");
    expect(card("Battle").disabled).toBe(false);
    expect(card("Battle").textContent).toContain("200 XP");
    expect(card("Logistics").textContent).toContain("100 XP");
    // Legendary is the last tier: nothing to buy.
    expect(card("Scouting").disabled).toBe(true);
    await act(async () => root.unmount());
  });
});
