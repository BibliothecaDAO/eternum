// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";

import { ArmyRow } from "../hud/army-row";

const game = vi.hoisted(() => ({
  buyTier: vi.fn(() => Promise.resolve()),
  signer: { address: "0x111" },
  progress: {
    game_id: 1,
    explorer_id: 12n,
    xp: 260,
    battle: 1,
    logistics: 1,
    scouting: 1,
    scouting_kinds: 0,
    homecoming: 1,
  },
  rules: { game_id: 1, reveal_xp: 2, fixed_xp: 200, uncommon_xp: 100, rare_xp: 200, epic_xp: 400, legendary_xp: 800 },
}));

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: { get: (model: string) => (model === "ArmyProgress" ? game.progress : game.rules) },
      systemCalls: { buy_tier: game.buyTier },
    },
    account: { account: game.signer },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("../hud/dock-armies", () => ({
  useDockArmies: () => [
    {
      explorerId: 12,
      label: "Army 1",
      art: "knight-t1",
      troops: 5_000,
      stamina: { current: 90, max: 150 },
      secondsToFull: 7_200,
      canBuyTier: true,
    },
  ],
}));
vi.mock("./army-refill", () => ({ ArmyRefill: () => null }));

const { FrontierArmy } = await import("./frontier-army");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const buttons = () => [...host.querySelectorAll("button")];

it("offers Upgrade on a desktop army row whose XP buys a tier, and it opens the army's sheet", () => {
  const onUpgrade = vi.fn();
  const row = (props: { canBuyTier: boolean; onUpgrade?: () => void }) =>
    act(() =>
      root.render(
        <ArmyRow
          label="Army 1"
          number={1}
          art="knight-t1"
          troops={5_000}
          stamina={{ current: 90, max: 150 }}
          xp={260}
          selected={false}
          onPick={vi.fn()}
          {...props}
        />,
      ),
    );
  row({ canBuyTier: true, onUpgrade });
  act(() =>
    buttons()
      .find((button) => button.getAttribute("aria-label") === "Upgrade Army 1")!
      .click(),
  );
  expect(onUpgrade).toHaveBeenCalledTimes(1);

  row({ canBuyTier: false, onUpgrade });
  expect(buttons().some((button) => button.getAttribute("aria-label") === "Upgrade Army 1")).toBe(false);
});

it("buys the chosen tier from the army's sheet: buy_tier for the selected army and its attribute, signed by the player", async () => {
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} onClose={vi.fn()} />));
  const upgrade = buttons().find((button) => button.textContent?.startsWith("Upgrade"));
  expect(upgrade).toBeDefined();
  await act(async () => upgrade!.click());
  expect(game.buyTier).toHaveBeenCalledWith({
    signer: game.signer,
    explorerId: 12,
    attribute: "Battle",
    scoutingKind: undefined,
  });
});
