import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { nativeOathConstants } from "@bibliothecadao/eternum/game-client";
import { TroopType } from "@bibliothecadao/types";
import { GameProvider } from "@/hooks/context/game-context";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import { oathName } from "./oath-details";
import { ArmyOathSockets, TroopOathSlots } from "./oath-slots";
import { transferArmies } from "./transfer-fixture";

it("says how an army earns an Oath as the game grants one: a site that holds an Oath, or a Shrine revealed", () => {
  expect(RESEARCH_TREE.oathEarn).toBe("Clear a site that holds an Oath, or reveal a Shrine");
});

it("draws every Oath socket of an army: its Oaths as icons, each open one explaining how to earn one, the rest locked", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const store = transferArmies();
  const progress = store.require("ArmyProgress", { game_id: 1, explorer_id: 201 });
  store.applyFacts([
    {
      model: "ArmyProgress",
      key: store.wireKeyOf("ArmyProgress", progress)!,
      value: { ...progress, explorer_id: "201", oath_slots: 3, oaths: 1 << (nativeOathConstants.POWER - 1) },
    },
  ]);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
        <ArmyOathSockets explorerId={201} />
      </GameProvider>,
    ),
  );
  try {
    const sockets = () => [...host.querySelectorAll(".oath-socket")].map((socket) => socket.getAttribute("aria-label"));
    expect(sockets()).toEqual([
      oathName(nativeOathConstants.POWER),
      RESEARCH_TREE.oathEarn,
      RESEARCH_TREE.oathEarn,
      "Locked",
      "Locked",
    ]);
    expect(host.querySelector('[role="status"]')).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>("button.oath-socket")!.click());
    expect(host.querySelector('[role="status"]')?.textContent).toBe(RESEARCH_TREE.oathEarn);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("draws the army panel's Oath slots as sockets: its Oath named, each open one marked open, each locked one closed, and how to earn one", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const store = transferArmies();
  const progress = store.require("ArmyProgress", { game_id: 1, explorer_id: 201 });
  store.applyFacts([
    {
      model: "ArmyProgress",
      key: store.wireKeyOf("ArmyProgress", progress)!,
      value: { ...progress, explorer_id: "201", oath_slots: 3, oaths: 1 << (nativeOathConstants.POWER - 1) },
    },
  ]);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
        <TroopOathSlots category={TroopType.Knight} explorerId={201} />
      </GameProvider>,
    ),
  );
  try {
    const board = host.querySelector('[data-oath-slots="3"]')!;
    expect(board.querySelector(".oath-board__title")?.textContent).toBe("3 Oath slots");
    expect(board.querySelector(".oath-board__hint")?.textContent).toBe(RESEARCH_TREE.oathEarn);
    expect([...board.querySelectorAll(".oath-card")].map((card) => card.getAttribute("aria-label"))).toEqual([
      "1 Oath slot · Open",
      "2 Oath slots · Open",
      "3 Oath slots · Open",
      "4 Oath slots · Locked",
      "5 Oath slots · Locked",
    ]);
    expect(board.querySelector(".oath-card[data-filled]")?.textContent).toBe(oathName(nativeOathConstants.POWER));
    expect(board.querySelectorAll(".oath-card[data-open]")).toHaveLength(2);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
