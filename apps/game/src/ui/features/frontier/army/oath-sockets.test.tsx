import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { nativeOathConstants } from "@bibliothecadao/eternum/game-client";
import { GameProvider } from "@/hooks/context/game-context";
import { oathEffectDescription, oathName, oathStatBadge } from "./oath-details";
import { ArmyOathEffects, ArmyOathSockets } from "./oath-slots";
import { transferArmies } from "./transfer-fixture";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import { readPickEffectBase } from "../pick-effect-text";

it("draws every Oath socket of an army: its Oaths as icons, each open one explaining how to earn one, the rest locked", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const store = transferArmies();
  const progress = store.require("ArmyProgress", { game_id: 1, explorer_id: 201 });
  const sworn = (1 << (nativeOathConstants.DETECTION - 1)) | (1 << (nativeOathConstants.POWER - 1));
  store.applyFacts([
    {
      model: "ArmyProgress",
      key: store.wireKeyOf("ArmyProgress", progress)!,
      value: { ...progress, explorer_id: "201", oath_slots: 3, oaths: sworn },
    },
  ]);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as never} account={{ address: "0x111" } as never}>
        <ArmyOathSockets explorerId={201} />
        <ArmyOathEffects explorerId={201} />
      </GameProvider>,
    ),
  );
  try {
    const sockets = () => [...host.querySelectorAll(".oath-socket")].map((socket) => socket.getAttribute("aria-label"));
    expect(sockets()).toEqual([
      oathName(nativeOathConstants.DETECTION),
      oathName(nativeOathConstants.POWER),
      RESEARCH_TREE.oathEarn,
      "Locked",
      "Locked",
    ]);
    const tips = [...host.querySelectorAll(".oath-socket[data-filled]")].map((socket) =>
      socket.getAttribute("data-tip"),
    );
    const base = readPickEffectBase(store, 1);
    const detectionBadge = oathStatBadge(nativeOathConstants.DETECTION, base);
    const powerBadge = oathStatBadge(nativeOathConstants.POWER, base);
    expect(tips).toEqual([
      `${oathName(nativeOathConstants.DETECTION)}: ${oathEffectDescription(nativeOathConstants.DETECTION, base)}`,
      `${oathName(nativeOathConstants.POWER)}: ${oathEffectDescription(nativeOathConstants.POWER, base)}`,
    ]);
    expect(tips.every((tip) => !tip?.includes("\u2014"))).toBe(true);
    const effectRows = [...host.querySelectorAll("[data-oath-effects] li")].map((row) =>
      [...row.children].map((part) => part.textContent),
    );
    expect(effectRows).toEqual([
      [oathName(nativeOathConstants.DETECTION), detectionBadge.hero, detectionBadge.unit],
      [oathName(nativeOathConstants.POWER), powerBadge.hero, powerBadge.unit],
    ]);
    expect(host.querySelector('[role="status"]')).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>("button.oath-socket")!.click());
    expect(host.querySelector('[role="status"]')?.textContent).toBe(RESEARCH_TREE.oathEarn);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
