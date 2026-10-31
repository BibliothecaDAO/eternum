import { REALM_SKIN_MODELS, REALM_SKINS, realmSkinIcon } from "@/three/structures/realm-skins";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The Feed's unread count, as the game's important stories make it; two arrived since it was last read.
vi.mock("@/ui/features/event-feed/quick-feed", async (original) => ({
  ...(await original<typeof import("@/ui/features/event-feed/quick-feed")>()),
  useUnreadImportantCount: (open: boolean) => (open ? 0 : 2),
}));

import { dayClock } from "./day-clock";
import { DayPill } from "./day-pill";
import { FrontierPlaces } from "./frontier-desktop";
import { RealmPanel } from "./realm-panel";
import type { StoreReading } from "./status-strip";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const store = (kind: StoreReading["kind"], amount: number, limit?: number): StoreReading => ({
  kind,
  amount,
  limit,
  perHour: limit === undefined ? undefined : 600,
  fullIn: limit === undefined ? undefined : 2 * 3_600,
  tone: "calm",
  flyTarget: `test-${kind}`,
});

const STORES = [
  store("essence", 18_250),
  store("labor", 9_640, 18_000),
  store("wheat", 4_410, 6_000),
  store("troops", 1_200, 6_000),
];

const named = () => [...host.querySelectorAll("[aria-label]")].map((element) => element.getAttribute("aria-label"));

it("reads the player's realm as Blitz's card reads a holding: name, rank, a ring per store and its LORDS", () => {
  const onWithdraw = vi.fn();
  const onRealms = vi.fn();
  act(() =>
    root.render(
      <RealmPanel
        name="Duskbite"
        level={1}
        stores={STORES}
        lords={1_240}
        waiting={{ labor: 2_000, essence: 0 }}
        onWithdraw={onWithdraw}
        onRealms={onRealms}
      />,
    ),
  );
  const panel = host.querySelector('section[aria-label="Realm"]')!;
  expect(panel.textContent).toMatch(/^Duskbite.*City/);
  // Each store is one ring named by its line; the LORDS ring says its balance whole.
  expect(named()).toEqual(
    expect.arrayContaining([
      "Essence 18,250",
      "Labor 9,640 of 18,000 · +10/min · Full in 2h",
      "Wheat 4,410 of 6,000 · +10/min · Full in 2h",
      "Troops 1,200 of 6,000 · +10/min · Full in 2h",
      "LORDS 1,240",
    ]),
  );
  act(() => (host.querySelector('[aria-label="LORDS 1,240"]') as HTMLButtonElement).click());
  expect(onWithdraw).toHaveBeenCalledTimes(1);
  act(() => (host.querySelector('[aria-label="Realm Labor +2,000 Labor"]') as HTMLButtonElement).click());
  expect(onRealms).toHaveBeenCalledTimes(1);
});

it("marks the LORDS of an account with no linked wallet, its name and hover saying why, still opening Withdraw", () => {
  const onWithdraw = vi.fn();
  const line = "Link a wallet to receive your LORDS";
  act(() =>
    root.render(
      <RealmPanel
        name="Duskbite"
        level={1}
        stores={STORES}
        lords={1_240}
        linkWalletLine={line}
        onWithdraw={onWithdraw}
      />,
    ),
  );
  const ring = host.querySelector<HTMLButtonElement>(`[aria-label="LORDS 1,240. ${line}"]`)!;
  expect(ring.getAttribute("data-tip")).toBe(line);
  expect(ring.querySelector('[data-icon="warning"]')).not.toBeNull();
  act(() => ring.click());
  expect(onWithdraw).toHaveBeenCalledTimes(1);
  // With a linked wallet (no line) the ring is the plain balance.
  act(() =>
    root.render(<RealmPanel name="Duskbite" level={1} stores={STORES} lords={1_240} onWithdraw={onWithdraw} />),
  );
  expect(host.querySelector('[aria-label="LORDS 1,240"] [data-icon="warning"]')).toBeNull();
});

it("takes the map home from its whole header, which never folds, with the rank's steps beside the name", () => {
  const onHome = vi.fn();
  act(() => root.render(<RealmPanel name="Duskbite" level={1} highest={3} stores={STORES} onHome={onHome} />));
  const head = host.querySelector<HTMLButtonElement>('button[aria-label="Show my realm"]')!;
  expect(head.textContent).toContain("Duskbite");
  expect(host.querySelector('[aria-label="City, rank 2 of 4"]')).not.toBeNull();
  act(() => head.click());
  act(() => head.click());
  expect(onHome).toHaveBeenCalledTimes(2);
  // Pressing the header never folds the stores away.
  expect(named()).toContain("Essence 18,250");
});

it("opens a store's card under the rings from the ring of a store that has one", () => {
  const onToggle = vi.fn();
  const render = (open: "wheat" | null) =>
    act(() =>
      root.render(
        <RealmPanel
          name="Duskbite"
          level={1}
          stores={STORES}
          storeCards={{ kinds: ["wheat", "labor", "troops"], open, onToggle, card: <p>wheat card</p> }}
        />,
      ),
    );
  render(null);
  expect(host.textContent).not.toContain("wheat card");
  // Essence has no card: its ring is not a button.
  expect(host.querySelector('button[aria-label="Essence 18,250"]')).toBeNull();
  // Pressed by the store it stands for, as the playtest's wheat-store step finds it (steps.mjs).
  expect(host.querySelector('[data-store="wheat"] button')?.getAttribute("aria-label")).toMatch(/^Wheat 4,410/);
  act(() => host.querySelector<HTMLButtonElement>('[data-store="wheat"] button')!.click());
  expect(onToggle).toHaveBeenCalledWith("wheat");
  render("wheat");
  expect(host.textContent).toContain("wheat card");
});

it("shows a realm watched or visited by its stores alone: no LORDS and no Realms", () => {
  act(() => root.render(<RealmPanel name="Duskbite" level={2} stores={STORES} />));
  expect(host.textContent).toContain("Kingdom");
  expect(named().filter((name) => name?.startsWith("LORDS") || name?.startsWith("Realm Labor"))).toEqual([]);
  expect(host.querySelectorAll("button.ui-ring")).toHaveLength(0);
});

it("says the day and the time left in the top bar, and when the day ends and how long tomorrow lasts on hover", () => {
  const clock = dayClock({ dayUnitSeconds: 4 * 3_600, seed: 1n, startMainAt: 0 }, 3_600);
  act(() => root.render(<DayPill clock={clock} />));
  const pill = host.querySelector('[aria-label="Day clock"]')!;
  expect(pill.textContent).toContain(`Day ${clock.day}`);
  expect(pill.textContent).toContain("left");
  expect(pill.getAttribute("data-tip")).toMatch(/^Day ends \d\d:\d\d · Tomorrow lasts /);
});

it("reads a 24-hour day in hours on the top bar and its hover, as Play does (live-qa-night-1 P3-8)", () => {
  const day = dayClock({ dayUnitSeconds: 4 * 3_600, seed: 1n, startMainAt: 0 }, 3_600);
  act(() => root.render(<DayPill clock={{ ...day, secondsLeft: 24 * 3_600, tomorrowSeconds: 24 * 3_600 }} />));
  const pill = host.querySelector('[aria-label="Day clock"]')!;
  expect(pill.textContent).toContain("24h left");
  expect(pill.getAttribute("data-tip")).toMatch(/ · Tomorrow lasts 24h$/);
});

it("offers a desktop's places, Research, the Feed and the Season, each a panel its press opens and a second press closes", () => {
  const onSurface = vi.fn();
  const places = (surface: "research" | "feed" | "season" | null) => {
    act(() => root.render(<FrontierPlaces surface={surface} onSurface={onSurface} research={false} />));
    return [...host.querySelectorAll("nav button")] as HTMLButtonElement[];
  };
  const closed = places(null);
  expect(closed.map((button) => [button.getAttribute("aria-label"), button.getAttribute("aria-pressed")])).toEqual([
    ["Research", "false"],
    ["Feed", "false"],
    ["Season", "false"],
  ]);
  // Closed, the Feed counts what is unread, as a phone's place bar does.
  expect(closed[1].textContent).toContain("2");
  act(() => closed[1].click());
  expect(onSurface).toHaveBeenLastCalledWith("feed");
  const feed = places("feed");
  expect(feed[1].getAttribute("aria-pressed")).toBe("true");
  expect(feed[1].textContent).not.toContain("2");
  act(() => feed[1].click());
  expect(onSurface).toHaveBeenLastCalledWith(null);
  act(() => feed[2].click());
  expect(onSurface).toHaveBeenLastCalledWith("season");
});

it.each(REALM_SKIN_MODELS)(
  "shows the $skin painting on the HUD at level $level, its name as a tip",
  ({ skin, level }) => {
    const icon = realmSkinIcon(skin);
    act(() =>
      root.render(
        <RealmPanel
          name="Duskbite"
          level={level}
          highest={3}
          stores={STORES}
          mark={{ line: REALM_SKINS[skin].label, golden: skin === "devcon-golden", icon }}
        />,
      ),
    );
    const panel = host.querySelector('section[aria-label="Realm"]')!;
    // The painting alone carries the campaign: no tag spells its name beside the rank, the tip names it.
    const paintings = [...panel.querySelectorAll(`img[src$="/${icon}.webp"]`)];
    expect(paintings.map((painting) => painting.getAttribute("data-tip"))).toEqual([REALM_SKINS[skin].label]);
    expect(paintings[0].getAttribute("alt")).toBe(REALM_SKINS[skin].label);
    expect(panel.textContent).not.toContain(REALM_SKINS[skin].label);
  },
);
