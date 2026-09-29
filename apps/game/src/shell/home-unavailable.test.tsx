import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const directory = vi.hoisted(() => ({ games: [] as unknown[] }));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: "anonymous" }) }));
vi.mock("./herald", () => ({ useDirectory: () => ({ data: directory }) }));
vi.mock("./mode-cards", () => ({ BlitzCard: () => null, EternumCard: () => null, FrontierCard: () => null }));
vi.mock("./realm-card", () => ({ RealmCard: () => null }));
vi.mock("./season-podium", () => ({ SeasonPodium: () => null }));

import { entryHref } from "./game-links";
import type { DirectoryGame } from "./herald";
import { HomePage } from "./home";

it.each([true, false])(
  "keeps the first-visit entry for a healthy season with ready=%s, then removes it during an outage",
  async (ready) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const season = {
      chainId: "0x1",
      game_id: 1,
      mode: "frontier",
      status: "Live",
      ready,
      clock: { start_main_at: 0 },
    } as DirectoryGame;
    directory.games = [season];
    const container = document.createElement("div");
    const root = createRoot(container);
    const render = () =>
      act(async () =>
        root.render(
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>,
        ),
      );
    await render();
    try {
      expect(container.querySelector("a")?.getAttribute("href")).toBe(entryHref(season, "play"));
      expect(container.querySelector("a")?.textContent).toBe("Play free");
      directory.games = [{ ...season, error: "unavailable" }];
      await render();
      expect(container.textContent).toContain("Unavailable");
      expect(container.querySelector("a,button")).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  },
);
