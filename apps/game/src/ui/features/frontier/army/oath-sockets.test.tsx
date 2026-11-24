import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { nativeOathConstants } from "@bibliothecadao/eternum/game-client";
import { GameProvider } from "@/hooks/context/game-context";
import { oathName } from "./oath-details";
import { ArmyOathSockets } from "./oath-slots";
import { transferArmies } from "./transfer-fixture";

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
      "Clear a site to swear an Oath",
      "Clear a site to swear an Oath",
      "Locked",
      "Locked",
    ]);
    expect(host.querySelector('[role="status"]')).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>("button.oath-socket")!.click());
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Clear a site to swear an Oath");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
