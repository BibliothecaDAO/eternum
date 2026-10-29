import { REALMS_X_URL } from "@realms-world/chain";
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
  document.body.append(container);
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
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return container;
};

const panel = (page: HTMLElement, title: string) =>
  [...page.querySelectorAll<HTMLElement>(".app-panel")].find(
    (each) => each.querySelector("h2")?.textContent === title,
  )!;

describe.each([390, 1440])("What's new at %i px", (width) => {
  it("is read from You: Back leads to You, the bar holds the four places and You is lit; signed out, You is Connect", async () => {
    const page = await open(width);
    expect(page.querySelector<HTMLAnchorElement>('[data-role="back"]')!.getAttribute("href")).toBe("/profile");
    const places = [...page.querySelectorAll<HTMLElement>('[data-role="tab"]')];
    expect(places.map((place) => place.getAttribute("aria-label") ?? place.textContent)).toEqual([
      "Play",
      "Season",
      "Chat",
      "Connect",
    ]);
    const current = places.filter((place) => place.getAttribute("aria-current") === "page");
    expect(current.map((place) => place.textContent)).toEqual(["Connect"]);
  });

  it("leads to Realms' marketplace from its footer, in a new tab, never from the bar", async () => {
    const page = await open(width);
    const market = [...page.querySelectorAll<HTMLAnchorElement>("a")].filter((link) =>
      link.href.startsWith("https://realms.market"),
    );
    expect(
      market.map((link) => [link.closest('[data-band="footer"]') !== null, link.textContent, link.href, link.target]),
    ).toEqual([[true, "Market", "https://realms.market/", "_blank"]]);
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
    const releases = [...panel(page, "Releases").querySelectorAll<HTMLButtonElement>("button.app-row")];
    expect(releases.map((release) => release.querySelector(".app-row__title")?.textContent)).toEqual(
      patchNotes.map((note) => note.title),
    );
    // Picked from the list below, the release is shown from its head: scrolled to and focused (qa-app-1 P3-1).
    const scrolled: Element[] = [];
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (this: Element) {
      scrolled.push(this);
    });
    await act(async () => releases.at(-1)!.click());
    scrollIntoView.mockRestore();
    const head = panel(page, "Patch notes");
    expect(scrolled).toHaveLength(1);
    expect(scrolled[0].contains(head)).toBe(true);
    expect(document.activeElement).toBe(scrolled[0]);
    expect(await readAll()).toEqual(asRead(patchNotes.at(-1)!));
  });

  it("leads from the patch notes to the full rules on the docs site, in a new tab", async () => {
    const page = await open(width);
    const rules = panel(page, "Patch notes").querySelector<HTMLAnchorElement>(".app-panel__cue a")!;
    expect([rules.textContent, rules.href, rules.target]).toEqual([
      "Full rules",
      "https://docs.realms.party/",
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
      ["X", REALMS_X_URL, "_blank", "/tokens/brand-x.svg"],
      ["Discord", "https://discord.gg/realmsworld", "_blank", "/tokens/brand-discord.svg"],
      ["Telegram", "https://t.me/+UpfCtj7qEO9hZjU1", "_blank", "/tokens/brand-telegram.svg"],
      ["CoinGecko", "https://www.coingecko.com/en/coins/lords", "_blank", "/tokens/brand-coingecko.svg"],
      ["GitHub", "https://github.com/BibliothecaDAO", "_blank", "/tokens/brand-github.svg"],
    ]);
  });
});
