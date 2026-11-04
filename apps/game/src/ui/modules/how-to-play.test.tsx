import { existsSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const mode = vi.hoisted(() => ({ id: "frontier" }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => mode }));

const { DOCS_ADDRESS } = await import("@/config/app-address");
const { HOW_TO_PLAY_BY_MODE } = await import("@/shell/community");
const { HowToPlayRow, useHowToPlay } = await import("./how-to-play");

const DOCS_PAGES = join(__dirname, "../../../../game-docs/docs/pages/");

/** The page file the docs site serves at a guide's address: a section's index, or a page of its own. */
const pageOf = (guide: string) => {
  const path = guide.slice(DOCS_ADDRESS.length + 1);
  return join(DOCS_PAGES, `${path === "" || path.endsWith("/") ? `${path}index` : path}.mdx`);
};

it.each(Object.entries(HOW_TO_PLAY_BY_MODE))("opens %s's guide, a page the docs site serves", (_, guide) => {
  expect(guide.startsWith(`${DOCS_ADDRESS}/`)).toBe(true);
  expect(existsSync(pageOf(guide))).toBe(true);
});

const GameHowToPlay = () => <HowToPlayRow guide={useHowToPlay()} />;

it.each([
  ["frontier", "https://docs.realms.party/frontier/"],
  ["blitz", "https://docs.realms.party/blitz/"],
])("links a %s game's How to play to its own guide, in a new tab", (id, guide) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mode.id = id;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<GameHowToPlay />));
  const link = host.querySelector("a")!;
  expect(link.href).toBe(guide);
  expect(link.target).toBe("_blank");
  expect(link.textContent).toBe("How to playdocs.realms.party");
  act(() => root.unmount());
  host.remove();
});
