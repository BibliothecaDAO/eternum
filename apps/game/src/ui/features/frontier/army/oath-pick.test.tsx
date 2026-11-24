import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { nativeFragmentConstants, nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import type { DockArmy } from "../hud/dock-armies";

const state = vi.hoisted(() => ({
  chooseOath: vi.fn(() => Promise.resolve({ transaction_hash: "0x8" })),
  rerollOath: vi.fn(() => Promise.resolve({ transaction_hash: "0x9" })),
  fragments: 100 as number | null,
  signer: { address: "0x111" },
  progress: {
    game_id: 1,
    explorer_id: 12n,
    logistics: 0,
    oath_slots: 2,
    oaths: 0,
    oath_pick: 0,
  },
  pickBase: {
    attackStamina: 30,
    revealStamina: 20,
    maxStamina: 180,
    staminaPerSecond: 0.5 / 60,
    deepLossPerTick: 200,
  },
}));

const army = {
  explorerId: 12,
  number: 1,
  label: "Army 1",
  art: "knight-t1",
  troops: 1_498,
  troopsFact: { category: "Knight" } as Pick<DockArmy["troopsFact"], "category">,
  stamina: { current: 100, max: 216 },
  secondsToFull: 232,
};

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      systemCalls: { choose_oath: state.chooseOath, reroll_oath: state.rerollOath },
    },
    account: { account: state.signer },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({
  useNativeFacts: () => ({
    store: { get: (model: string) => (model === "ArmyProgress" ? state.progress : undefined) },
  }),
}));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true }));
vi.mock("../hud/dock-armies", () => ({ useDockArmies: () => [army] }));
vi.mock("../value/fragments", () => ({ useFragmentsHeld: () => state.fragments }));
vi.mock("../pick-effect-text", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pick-effect-text")>()),
  usePickEffectBase: () => state.pickBase,
}));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { FrontierOathPick } from "./oath-pick";

let host: HTMLDivElement;
let root: Root;

const pickArmy = (explorerId: number | null) =>
  act(() =>
    useUIStore.setState((ui) => ({ entityActions: { ...ui.entityActions, selectedEntityId: explorerId } })),
  );
const draw = () => act(() => root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />));
const cards = () => [...host.querySelectorAll<HTMLElement>(".oath-choice")];
const swear = () => host.querySelector<HTMLButtonElement>("[data-oath-swear]")!;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
  state.fragments = 100;
  state.progress.oath_slots = 2;
  state.progress.oaths = 0;
  state.progress.oath_pick = oaths.POWER - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8);
  pickArmy(army.explorerId);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  pickArmy(null);
});

it("waits on its army until the army is picked, then offers three compact cards and swears the one chosen by name", async () => {
  pickArmy(null);
  draw();
  expect(host.querySelector("[data-oath-pick]")).toBeNull();
  pickArmy(army.explorerId);
  expect(host.querySelector("[data-oath-pick]")).not.toBeNull();
  expect(cards().every((card) => card.style.getPropertyValue("--hud-aspect").length > 0)).toBe(true);
  expect(cards().map((card) => card.querySelector(".oath-choice__name")?.textContent)).toEqual(["Power", "Fox", "Rage"]);
  expect(cards().map((card) => card.querySelector(".oath-choice__effect")?.textContent)).toEqual([
    "+20%",
    "20 → 16",
    "+25%",
  ]);
  expect(cards().map((card) => card.querySelector(".oath-choice__unit")?.textContent)).toEqual([
    "Damage dealt",
    "Reveal cost",
    "Site and guard rewards",
  ]);
  expect(host.querySelectorAll("[data-reroll-oath]")).toHaveLength(3);
  expect(host.querySelector(".oath-pick__head .ui-chip")?.textContent).toBe(
    String(nativeFragmentConstants.OATH_REROLL_FRAGMENTS),
  );
  expect(host.querySelector(".oath-pick__title span")?.textContent).toBe("Slot 1 of 2 · 1,498 Knights");
  expect(swear().textContent).toBe("Swear Power");
  await act(async () => host.querySelector<HTMLButtonElement>(`[data-oath-id="${oaths.FOX}"]`)!.click());
  expect(swear().textContent).toBe("Swear Fox");
  expect(state.chooseOath).not.toHaveBeenCalled();
  await act(async () => swear().click());
  expect(state.chooseOath).toHaveBeenCalledWith({
    signer: state.signer,
    explorerId: army.explorerId,
    expectedPick: state.progress.oath_pick,
    oath: oaths.FOX,
    replace: null,
  });
});

it("asks which held Oath the card replaces when every slot is held, and swears it in its place", async () => {
  state.progress.oath_slots = 1;
  state.progress.oaths = 1 << (oaths.GIANTS - 1);
  draw();
  await act(async () => swear().click());
  const replaceButton = host.querySelector<HTMLButtonElement>(`[data-replace-oath="${oaths.GIANTS}"]`)!;
  expect(replaceButton.getAttribute("aria-label")).toBe("Replace Giants");
  await act(async () => replaceButton.click());
  expect(state.chooseOath).toHaveBeenCalledWith({
    signer: state.signer,
    explorerId: army.explorerId,
    expectedPick: state.progress.oath_pick,
    oath: oaths.POWER,
    replace: oaths.GIANTS,
  });
});

it("marks the swapped card New and its head Used once the pick's one reroll is spent, with no Swap left", async () => {
  draw();
  await act(async () => host.querySelector<HTMLButtonElement>('[data-reroll-oath="0"]')!.click());
  expect(state.rerollOath).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
  state.progress.oath_pick = oaths.GIANTS - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8) + oaths.REROLLED;
  draw();
  expect(host.querySelector(".oath-pick__head .ui-chip")?.textContent).toBe("Used");
  expect(host.querySelectorAll("[data-reroll-oath]")).toHaveLength(0);
  expect(cards().map((card) => card.querySelector(".oath-choice__new")?.textContent ?? null)).toEqual([
    "New",
    null,
    null,
  ]);
  expect(swear().textContent).toBe("Swear Giants");
});

it("passes for the stamina it gives, capped at the bar's maximum", async () => {
  draw();
  const pass = host.querySelector<HTMLButtonElement>("[data-oath-pass]")!;
  expect(pass.dataset.oathPassResult).toBe(String(100 + oaths.PASS_STAMINA));
  await act(async () => pass.click());
  expect(state.chooseOath).toHaveBeenCalledWith(expect.objectContaining({ oath: null, replace: null }));
});
