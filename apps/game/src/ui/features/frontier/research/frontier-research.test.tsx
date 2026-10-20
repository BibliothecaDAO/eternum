import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { GameProvider } from "@/hooks/context/game-context";
import { OpenedFromPanel } from "@/ui/design-system/kit/opened-from-panel";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { type GameClientSetup, nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { realmBoard } from "../build/build-fixture";
import { FrontierResearch } from "./frontier-research";

afterEach(() => setBlockTimestampSource(null));

describe("Research's page", () => {
  // As the HUD draws a nav page: what it opens goes back to it.
  it("opens a castle row's sheet in the tree's place, never over it, and goes back to the tree", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, realm } = realmBoard();
    // The Shrine's first tier on sale, for 2,000 Essence.
    store.applyFacts([
      {
        model: "ResearchPrice",
        key: "0x7e",
        value: { game_id: 1, row: research.ROW_SHRINE, tier: 1, essence: "2000000000000", labor: "0" },
      },
    ] as never);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <OpenedFromPanel.Provider value>
            <FrontierResearch rules={{} as never} realm={realm} />
          </OpenedFromPanel.Provider>
        </GameProvider>,
      ),
    );
    const panels = () =>
      [...host.querySelectorAll("section")].map((panel) => panel.getAttribute("aria-label")).filter(Boolean);
    expect(panels()).toEqual(["Research"]);

    act(() => host.querySelector<HTMLElement>('[aria-label="Shrine"]')!.click());
    expect(panels()).toEqual(["Shrine"]);

    act(() => host.querySelector<HTMLButtonElement>('section[aria-label="Shrine"] button[aria-label="Back"]')!.click());
    expect(panels()).toEqual(["Research"]);
    act(() => root.unmount());
    host.remove();
  });
});
