import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RailFrame } from "@/ui/features/world/hud/guided-rail";
import { afterEach, expect, it, vi } from "vitest";
import { Position } from "@bibliothecadao/eternum";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { campBeside } from "@/ui/features/frontier/sites/site-fixture";
import { stageFrontierChest } from "../../../scripts/relic-chest-route-fixture.mjs";

const active = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => active.client,
  startRealmVisit: () => undefined,
}));
afterEach(() => vi.restoreAllMocks());
it("frames the exact fixture hex through the minimap's real Position contract before any map click", () => {
  const { store } = campBeside();
  useChainTimeStore.getState().anchor({ timestamp: 350000 });
  active.client = { setup: { store, systemCalls: {} }, connect: () => undefined };
  let requested: unknown;
  const hear = (event: Event) => {
    requested = (event as CustomEvent).detail;
  };
  window.addEventListener("minimapCameraMove", hear);
  try {
    const fixture = stageFrontierChest();
    expect(requested).toBeInstanceOf(Position);
    expect((requested as Position).getContract()).toEqual({ x: fixture.hex.col, y: fixture.hex.row });
    expect(useChainTimeStore.getState().getNowSeconds()).toBeLessThan(400);
  } finally {
    window.removeEventListener("minimapCameraMove", hear);
  }
});

import { frontierChestRouteReady } from "../../../scripts/frontier-chest-route-contract.mjs";
it("recognises the unified HUD without the retired Day ends words, only on its map", () => {
  window.history.replaceState({}, "", "/g/0x1/2/map");
  document.body.innerHTML =
    '<canvas id="main-canvas"></canvas>' +
    renderToStaticMarkup(createElement(RailFrame, { children: "Day 1 · 15h 46m left", chat: null, chatOpen: false }));
  try {
    expect(frontierChestRouteReady()).toBe(true);
    window.history.replaceState({}, "", "/g/0x1/2/hex");
    expect(frontierChestRouteReady()).toBe(false);
    window.history.replaceState({}, "", "/g/0x1/2/map");
    document.querySelector("aside")!.remove();
    expect(frontierChestRouteReady()).toBe(false);
  } finally {
    document.body.innerHTML = "";
  }
});
