import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { patchNotes } from "../generated/patch-notes";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
// Signed out: What's new is read by anyone.
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

import { setViewportWidth } from "../frame/test-viewport";
import { WhatsNewPage } from "./news";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
});

/** A release as a player reads it: its name, then each section it changed, in order, its changes New, Balance, Fixes. */
const SECTIONS = [
  ["all", "All modes"],
  ["frontier", "Frontier"],
  ["blitz", "Blitz"],
  ["eternum", "Eternum"],
] as const;
const KINDS = ["new", "balance", "fix"];
const asRead = (note: (typeof patchNotes)[number]) => ({
  title: note.title,
  sections: SECTIONS.filter(([mode]) => note.modes[mode].length > 0).map(([mode, name]) => [
    name,
    [...note.modes[mode]]
      .sort((left, right) => KINDS.indexOf(left.kind) - KINDS.indexOf(right.kind))
      .map((change) => [change.title, change.line]),
  ]),
});

const Where = () => <output data-where>{useLocation().pathname}</output>;

const open = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/scroll"]}>
        <Routes>
          <Route path="/scroll" element={<WhatsNewPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return container;
};

const panel = (page: HTMLElement, title: string) =>
  [...page.querySelectorAll<HTMLElement>(".app-panel")].find(
    (each) => each.querySelector("h2")?.textContent === title,
  )!;

describe.each([390, 1440])("What's new at %i px", (width) => {
  it("is a place of its own: no Back, and its place in the bar is the current one", async () => {
    const page = await open(width);
    expect(page.querySelector('[data-role="back"]')).toBeNull();
    const places = [...page.querySelectorAll<HTMLAnchorElement>('[data-role="tab"]')];
    expect(places.map((place) => place.getAttribute("aria-label") ?? place.textContent)).toEqual([
      "Play",
      "Season",
      "What's new",
      "Market",
      "You",
    ]);
    const current = places.filter((place) => place.getAttribute("aria-current") === "page");
    expect(current.map((place) => [place.textContent, place.getAttribute("href")])).toEqual([
      ["What's new", "/scroll"],
    ]);
  });

  it("leads to Realms' marketplace in a new tab from the bar, and only from the bar", async () => {
    const page = await open(width);
    const market = [...page.querySelectorAll<HTMLAnchorElement>("a")].filter((link) =>
      link.href.startsWith("https://market.realms.world"),
    );
    expect(market.map((link) => [link.dataset.role, link.textContent, link.href, link.target, link.rel])).toEqual([
      ["tab", "Market", "https://market.realms.world/", "_blank", "noopener noreferrer"],
    ]);
  });

  it("shows a release under a tab per section it changed, in order, and any release picked from the list", async () => {
    const page = await open(width);
    const tabs = () => [...page.querySelectorAll<HTMLButtonElement>('[role="tablist"] [role="tab"]')];
    const shown = () => {
      const section = [...page.querySelectorAll<HTMLElement>(".app-panel")].find((each) =>
        each.querySelector("section[aria-label]"),
      )!;
      return [
        section.querySelector("h2")?.textContent,
        [...section.querySelectorAll(".app-row")].map((row) => [
          row.querySelector(".app-row__title")?.textContent,
          row.querySelector(".app-row__detail")?.textContent,
        ]),
      ];
    };
    const readAll = async () => {
      const sections = [];
      for (const tab of tabs()) {
        await act(async () => tab.click());
        sections.push(shown());
      }
      return { title: panel(page, "Patch notes").querySelector("h3")?.textContent, sections };
    };
    expect(tabs().map((tab) => tab.getAttribute("aria-selected"))[0]).toBe("true");
    expect(await readAll()).toEqual(asRead(patchNotes[0]));
    const releases = [...panel(page, "Releases").querySelectorAll<HTMLButtonElement>(".app-row button")];
    expect(releases.map((release) => release.querySelector(".app-row__title")?.textContent)).toEqual(
      patchNotes.map((note) => note.title),
    );
    await act(async () => releases.at(-1)!.click());
    expect(await readAll()).toEqual(asRead(patchNotes.at(-1)!));
  });

  it("leads from the patch notes to the full rules on the docs site, in a new tab", async () => {
    const page = await open(width);
    const rules = panel(page, "Patch notes").querySelector<HTMLAnchorElement>(".app-panel__cue a")!;
    expect([rules.textContent, rules.href, rules.target]).toEqual([
      "Full rules",
      "https://docs.realms.world/",
      "_blank",
    ]);
  });

  it("ends on the footer: the socials realms.world links, each with its official mark", async () => {
    const page = await open(width);
    const community = [
      ...page.querySelectorAll<HTMLAnchorElement>('[data-band="footer"] nav[aria-label="Community"] a'),
    ];
    expect(
      community.map((link) => [
        link.textContent,
        link.getAttribute("href"),
        link.target,
        link.querySelector("img")?.getAttribute("src"),
      ]),
    ).toEqual([
      ["X", "https://x.com/LootRealms", "_blank", "/tokens/brand-x.svg"],
      ["Discord", "https://discord.gg/realmsworld", "_blank", "/tokens/brand-discord.svg"],
      ["Telegram", "https://t.me/+UpfCtj7qEO9hZjU1", "_blank", "/tokens/brand-telegram.svg"],
      ["CoinGecko", "https://www.coingecko.com/en/coins/lords", "_blank", "/tokens/brand-coingecko.svg"],
      ["GitHub", "https://github.com/BibliothecaDAO", "_blank", "/tokens/brand-github.svg"],
    ]);
  });
});
