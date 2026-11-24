import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
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

import { FrontierOathPick } from "./oath-pick";

let host: HTMLDivElement;
let root: Root;

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
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("renders three Aspect-accented altar pillars with hero stat badges, active slot pips, redraw dice and pass bar", () => {
  act(() => root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />));

  const cards = [...host.querySelectorAll<HTMLElement>("[data-oath-id]")];
  expect(cards).toHaveLength(3);
  expect(cards.every((card) => card.style.getPropertyValue("--hud-aspect").length > 0)).toBe(true);
  expect(cards.map((card) => card.querySelector(".oath-card__title")?.textContent)).toEqual(["Power", "Fox", "Rage"]);
  expect(cards.map((card) => card.querySelector(".oath-card__hero")?.textContent)).toEqual(["+20%", "20 → 16", "+25%"]);
  expect(cards.map((card) => card.querySelector(".oath-card__unit")?.textContent)).toEqual([
    "Damage dealt",
    "Reveal cost",
    "Site and guard rewards",
  ]);
  expect(cards.map((card) => card.querySelector(".oath-card__sub")?.textContent)).toEqual([
    "100% → 120%",
    "Scouts 10 → 8",
    "100% → 125%",
  ]);
  expect(cards.map((card) => card.querySelector(".oath-card__cta")?.textContent)).toEqual([
    "Swear Power",
    "Swear Fox",
    "Swear Rage",
  ]);
  expect(host.querySelectorAll(".oath-card__redraw-dice")).toHaveLength(3);

  const pips = [...host.querySelectorAll<HTMLElement>(".oath-pip")];
  expect(pips).toHaveLength(2);
  expect(pips[0]!.hasAttribute("data-active")).toBe(true);
  expect(pips[0]!.textContent).toBe("1");
  expect(pips[1]!.textContent).toBe("2");
});

it("enters Replace mode with Replace labels and dispatches choose_oath with the replaced Oath when slots are full", async () => {
  state.progress.oath_slots = 1;
  state.progress.oaths = 1 << (oaths.GIANTS - 1);
  act(() => root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />));

  expect(host.querySelectorAll(".oath-pip[data-filled]")).toHaveLength(1);
  expect(host.querySelectorAll(".oath-pip[data-active]")).toHaveLength(0);

  await act(async () => host.querySelector<HTMLButtonElement>(`[data-oath-id="${oaths.POWER}"] button`)!.click());
  const replaceButton = host.querySelector<HTMLButtonElement>(`[data-replace-oath="${oaths.GIANTS}"]`)!;
  expect(replaceButton).not.toBeNull();
  expect(replaceButton.getAttribute("aria-label")).toBe("Replace Giants");
  expect(replaceButton.querySelector(".oath-card__cta")?.textContent).toBe("Replace Giants");

  await act(async () => replaceButton.click());
  expect(state.chooseOath).toHaveBeenCalledWith({
    signer: state.signer,
    explorerId: army.explorerId,
    expectedPick: state.progress.oath_pick,
    oath: oaths.POWER,
    replace: oaths.GIANTS,
  });
});
