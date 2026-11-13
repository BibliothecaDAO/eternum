// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager } from "@bibliothecadao/eternum";
import { ContractAddress } from "@bibliothecadao/types";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactView } from "@/hooks/use-fact-view";
import { HexMarker } from "@/ui/design-system/hex-marker";
import { campBeside } from "@/ui/features/frontier/sites/site-fixture";
import { minimapMarkersView } from "./minimap-markers";

const current = vi.hoisted(() => ({ store: null as NativeFactStore | null }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: current.store } }) }));

afterEach(() => useAccountStore.setState({ account: null }));

/** A Season 1 game seen by player 0x222 (home 8, in Chaos), with 0x111's army 201 out (home 7, no Aspect known yet). */
const seasonOneSeenBy0x222 = () => {
  const { store } = campBeside();
  current.store = store;
  configManager.setActiveGame(1, 7);
  useAccountStore.setState({ account: { address: "0x222" } as never });
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  store.applyFacts([
    { model: "Structure", key: "0x8", value: { ...realm, entity_id: 8, owner: ContractAddress("0x222") } },
    {
      model: "AspectRules",
      key: "0xa0",
      value: { game_id: 1, orders: [1, 2, 3, 4, 4, 3, 4, 4, 1, 2, 2, 1, 1, 3, 3, 2] },
    },
    { model: "HomeAspect", key: "0xa8", value: { game_id: 1, home: 8, aspect: 3 } },
  ] as never);
  return store;
};

it("turns a mounted mark blue when the other home's Aspect arrives after its army, with nothing else changing", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const store = seasonOneSeenBy0x222();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const Mark = () => {
    const marker = useFactView(minimapMarkersView).get("201")!;
    return (
      <svg>
        <HexMarker {...marker} />
      </svg>
    );
  };
  const owner = () => host.querySelector("[data-marker]")?.getAttribute("data-owner");
  try {
    await act(async () => root.render(<Mark />));
    expect(owner()).toBe("enemy");
    // The membership page arrives late, as in a snapshot's load or a recovery: the same Aspect makes an ally.
    await act(async () =>
      store.applyFacts([{ model: "HomeAspect", key: "0xa7", value: { game_id: 1, home: 7, aspect: 3 } }] as never),
    );
    expect(owner()).toBe("ally");
    expect((host.querySelector("polygon") as SVGElement).style.stroke).toBe("var(--hud-ally)");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
