import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

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
        labor={2_000}
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
      "labor 9,640 of 18,000 · +10/min · Full in 2h",
      "wheat 4,410 of 6,000 · +10/min · Full in 2h",
      "troops 1,200 of 6,000 · +10/min · Full in 2h",
      "LORDS 1,240",
    ]),
  );
  act(() => (host.querySelector('[aria-label="LORDS 1,240"]') as HTMLButtonElement).click());
  expect(onWithdraw).toHaveBeenCalledTimes(1);
  act(() => (host.querySelector('[aria-label="Realms +2,000 Labor"]') as HTMLButtonElement).click());
  expect(onRealms).toHaveBeenCalledTimes(1);
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
  act(() => host.querySelector<HTMLButtonElement>('button[aria-label^="wheat 4,410"]')!.click());
  expect(onToggle).toHaveBeenCalledWith("wheat");
  render("wheat");
  expect(host.textContent).toContain("wheat card");
});

it("shows a realm watched or visited by its stores alone: no LORDS and no Realms", () => {
  act(() => root.render(<RealmPanel name="Duskbite" level={2} stores={STORES} />));
  expect(host.textContent).toContain("Kingdom");
  expect(named().filter((name) => name?.startsWith("LORDS") || name?.startsWith("Realms"))).toEqual([]);
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

it("offers a desktop's places, Research, the Feed and the Season, the Feed lit at the rail's home", () => {
  const onHome = vi.fn();
  act(() => root.render(<FrontierPlaces surface={null} home onSurface={vi.fn()} onHome={onHome} research={false} />));
  const places = [...host.querySelectorAll("nav button")];
  expect(places.map((button) => button.getAttribute("aria-label"))).toEqual(["Research", "Feed", "Season"]);
  expect(places[1].getAttribute("aria-pressed")).toBe("true");
  act(() => (places[1] as HTMLButtonElement).click());
  expect(onHome).toHaveBeenCalledTimes(1);
});
