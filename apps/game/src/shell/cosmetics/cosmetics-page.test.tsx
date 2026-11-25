import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HeraldPlayerStructure } from "@bibliothecadao/eternum/game-sync";
import { seasonGameName, StructureType } from "@bibliothecadao/types";

const directory = vi.hoisted(() => ({ games: [] as unknown[] }));
vi.mock("../herald", async (original) => ({
  ...(await original<typeof import("../herald")>()),
  useDirectory: () => ({ data: { games: directory.games }, isPending: false, isError: false }),
}));

import { REALM_SKINS } from "@/three/cosmetics/realm-skins";
import { COSMETICS_WORDS } from "@/ui/design-system/kit/words";

import { setViewportWidth } from "../frame/test-viewport";
import { PROFILE_PATH } from "../profile/settings-route";
import { FRAGMENTS_PATH } from "../shop/fragments-route";
import { CosmeticsPage } from "./cosmetics-page";
import { COSMETICS_HASH, COSMETICS_PATH } from "./cosmetics-route";

const NOW = Math.floor(Date.now() / 1000);

const realm = (over: Partial<HeraldPlayerStructure>): HeraldPlayerStructure => ({
  entity_id: 1,
  category: StructureType.Realm,
  level: 2,
  realm_id: 7,
  coord_x: 0,
  coord_y: 0,
  resources_packed: "0",
  aspect: null,
  has_wonder: false,
  ...over,
});

const season = (structures: HeraldPlayerStructure[], ancient_seal: boolean) => ({
  chainId: "0x52",
  game_id: 1,
  name: seasonGameName(NOW - 1_000),
  mode: "frontier",
  status: "Live",
  clock: { start_main_at: NOW - 1_000, end_at: NOW + 100_000 },
  player_state: { registered: true, settled: true, structures, fragments: null, ancient_seal },
});

const Where = () => {
  const { pathname, hash } = useLocation();
  return <output data-where>{`${pathname}${hash}`}</output>;
};

let root: Root | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

const open = async (width = 1440) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[COSMETICS_PATH]}>
          <Routes>
            <Route path={COSMETICS_PATH} element={<CosmeticsPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return container;
};

const standings = (container: HTMLElement) =>
  Object.fromEntries(
    [...container.querySelectorAll<HTMLElement>("[data-skin]")].map((card) => [
      card.dataset.skin,
      card.dataset.standing,
    ]),
  );

const buttonNamed = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === name);

const pick = async (container: HTMLElement, skin: string) =>
  act(async () => container.querySelector<HTMLElement>(`[data-skin="${skin}"]`)!.click());

describe("the Cosmetics page", () => {
  it("shows every realm skin of the catalog once, each in its family", async () => {
    directory.games = [];
    const container = await open();
    expect(Object.keys(standings(container)).sort()).toEqual(REALM_SKINS.map((skin) => skin.id).sort());
    for (const skin of REALM_SKINS)
      expect(
        container.querySelector(`[data-family="${skin.family}"] [data-skin="${skin.id}"]`),
        skin.id,
      ).not.toBeNull();
  });

  it("owns only the base skin for a player the season knows nothing of", async () => {
    directory.games = [];
    expect(standings(await open())).toEqual({
      "wonder-prowess": "wonder",
      "wonder-luminary": "wonder",
      "wonder-havoc": "wonder",
      "wonder-insight": "wonder",
      "season-1-prowess": "pass",
      "season-1-luminary": "pass",
      "season-1-havoc": "pass",
      "season-1-insight": "pass",
      devcon: "event",
      "devcon-golden": "event",
      base: "owned",
    });
  });

  it("owns the Season 1 skin of the player's Aspect once the Seal is held, and the Wonder skin of a Wonder realm", async () => {
    directory.games = [season([realm({ aspect: 3, has_wonder: true })], true)];
    const owned = Object.entries(standings(await open()))
      .filter(([, standing]) => standing === "owned")
      .map(([skin]) => skin);
    expect(owned.sort()).toEqual(["base", "season-1-havoc", "wonder-havoc"]);
  });

  it("leaves a Season 1 skin locked to the pass while the Seal is not held", async () => {
    directory.games = [season([realm({ aspect: 3 })], false)];
    expect(standings(await open())["season-1-havoc"]).toBe("pass");
  });

  it("opens on the player's first owned skin in the default order, seen at their rank", async () => {
    directory.games = [season([realm({ aspect: 1, has_wonder: true, level: 3 })], false)];
    const container = await open();
    const stage = container.querySelector<HTMLElement>("[data-preview]")!;
    expect(stage.dataset.preview).toBe("wonder-prowess");
    expect(stage.dataset.rank).toBe("3");
  });

  it("sends a skin locked to the pass to the Shop", async () => {
    directory.games = [];
    const container = await open();
    await pick(container, "season-1-insight");
    await act(async () => buttonNamed(container, COSMETICS_WORDS.unlockInPass)!.click());
    expect(container.querySelector("[data-where]")!.textContent).toBe(FRAGMENTS_PATH);
  });

  it("offers nothing to press for a skin only an event gave", async () => {
    directory.games = [];
    const container = await open();
    await pick(container, "devcon-golden");
    expect(buttonNamed(container, COSMETICS_WORDS.eventExclusive)!.disabled).toBe(true);
  });

  it("offers no Equip, and says the default order the game wears for an owned skin", async () => {
    directory.games = [];
    const container = await open();
    await pick(container, "base");
    expect(container.textContent).not.toContain("Equip");
    expect(container.querySelector(".cosmetics__note")!.textContent).toBe(
      COSMETICS_WORDS.defaultOrder(["Wonder", "Season 1", "Devcon", "Base"]),
    );
  });

  it("opens inside You on a phone", async () => {
    directory.games = [];
    const container = await open(390);
    expect(container.querySelector("[data-where]")!.textContent).toBe(`${PROFILE_PATH}${COSMETICS_HASH}`);
  });
});
