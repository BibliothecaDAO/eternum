import { aspectName } from "@bibliothecadao/types";
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
import { isTroopStore, STORE_KINDS } from "../stores";
import { RealmCard } from "./realm-card";
import { RealmHeaderChip } from "./realm-header-chip";
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

it("reads the player's realm as Blitz's card reads a holding: name, rank and a ring per store", () => {
  act(() => root.render(<RealmPanel name="Duskbite" level={1} stores={STORES} />));
  const panel = host.querySelector('section[aria-label="Realm"]')!;
  expect(panel.textContent).toMatch(/^Duskbite.*City/);
  expect(panel.querySelectorAll(".frontier-progress-ring")).toHaveLength(4);
  expect(panel.querySelector('[data-store="wheat"] .frontier-progress-ring__badge')?.textContent).toBe("2h");
  expect(panel.querySelector('[data-store="wheat"] .frontier-progress-ring__fill')).not.toBeNull();
  expect(panel.querySelector('[data-store="essence"] .frontier-progress-ring__fill')).toBeNull();
  expect(panel.querySelector('[data-store="wheat"]')?.textContent).not.toContain("Wheat");
  expect(named()).toEqual(
    expect.arrayContaining([
      "Essence 18,250",
      "Labor 9,640 of 18,000 · +10/min · Full in 2h",
      "Wheat 4,410 of 6,000 · +10/min · Full in 2h",
      "Knights 1,200 of 6,000 · +10/min · Full in 2h",
    ]),
  );
});

it("takes the map home from its whole header, which never folds", () => {
  const onHome = vi.fn();
  act(() => root.render(<RealmPanel name="Duskbite" level={1} stores={STORES} onHome={onHome} />));
  const head = host.querySelector<HTMLButtonElement>('button[aria-label="Show my realm"]')!;
  expect(head.textContent).toContain("Duskbite");
  act(() => head.click());
  act(() => head.click());
  expect(onHome).toHaveBeenCalledTimes(2);
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
  expect(named().filter((name) => name?.startsWith("LORDS"))).toEqual([]);
  expect(host.querySelectorAll("button.ui-ring")).toHaveLength(0);
});

it("says the day and the time left in the top bar, and when the day ends and how long tomorrow lasts on hover", () => {
  const clock = dayClock(
    { dayUnitSeconds: 4 * 3_600, seed: 1n, startMainAt: 0, scheduledEndAt: 21 * 20 * 14_400, endAt: 21 * 20 * 14_400 },
    3_600,
  );
  act(() => root.render(<DayPill clock={clock} />));
  const pill = host.querySelector('[aria-label="Day clock"]')!;
  expect(pill.textContent).toContain(`Day ${clock.day}`);
  expect(pill.querySelector(".frontier-day-readout__left")?.textContent).toBeTruthy();
  expect(pill.getAttribute("data-tip")).toMatch(/^Day ends \d\d:\d\d · .+ left · Tomorrow lasts /);
});

it("reads a 24-hour day in hours on the top bar and its hover, as Play does (live-qa-night-1 P3-8)", () => {
  const day = dayClock(
    { dayUnitSeconds: 4 * 3_600, seed: 1n, startMainAt: 0, scheduledEndAt: 21 * 20 * 14_400, endAt: 21 * 20 * 14_400 },
    3_600,
  );
  act(() => root.render(<DayPill clock={{ ...day, secondsLeft: 24 * 3_600, tomorrowSeconds: 24 * 3_600 }} />));
  const pill = host.querySelector('[aria-label="Day clock"]')!;
  expect(pill.textContent).toContain(`Day ${day.day}`);
  expect(pill.textContent).toContain("24h");
  expect(pill.getAttribute("data-tip")).toMatch(/ · Tomorrow lasts 24h$/);
});

it("offers a desktop's four cornice places in order, each a panel its press opens and a second press closes", () => {
  const onSurface = vi.fn();
  const places = (surface: "research" | "feed" | "season" | "chat" | null, research = false) => {
    act(() => root.render(<FrontierPlaces surface={surface} onSurface={onSurface} research={research} />));
    return [...host.querySelectorAll("nav button")] as HTMLButtonElement[];
  };
  const closed = places(null, true);
  expect(closed.map((button) => [button.getAttribute("aria-label"), button.getAttribute("aria-selected")])).toEqual([
    ["Research", "false"],
    ["Season", "false"],
    ["Feed", "false"],
    ["Chat", "false"],
  ]);
  expect(closed[0].querySelector('[data-shape="diamond"]')).not.toBeNull();
  expect(closed[2].textContent).toContain("2");
  act(() => closed[2].click());
  expect(onSurface).toHaveBeenLastCalledWith("feed");
  const feed = places("feed");
  expect(feed[2].getAttribute("aria-selected")).toBe("true");
  expect(feed[2].textContent).not.toContain("2");
  act(() => feed[2].click());
  expect(onSurface).toHaveBeenLastCalledWith(null);
  act(() => feed[1].click());
  expect(onSurface).toHaveBeenLastCalledWith("season");
});

it("renders the Aspect medallion tinted in the Aspect color and Order of Power below the Realm name on both the desktop card and panel", () => {
  const onHome = vi.fn();
  act(() =>
    root.render(
      <>
        <RealmCard
          name="Duskbite"
          kind="realm"
          level={1}
          aspect={1}
          orderId={12}
          stores={STORES}
          fragments={0}
          lords={0}
          onHome={onHome}
        />
        <RealmPanel name="Duskbite" level={1} aspect={1} orderId={12} stores={STORES} />
      </>,
    ),
  );
  const card = host.querySelector<HTMLElement>(".frontier-realm-card")!;
  const identity = card.querySelector<HTMLButtonElement>(".frontier-realm-card__identity")!;
  expect(identity.querySelector('[data-aspect-mark="1"]')).not.toBeNull();
  expect(identity.querySelector(".frontier-aspect-medallion")?.getAttribute("style")).toContain("--hud-aspect");
  expect(identity.querySelector('img[src*="portraits"]')).toBeNull();
  expect(card.querySelector(".frontier-realm-card__order")?.textContent).toBe("Order of Power");
  expect(card.querySelector('[data-order-id="12"] img')).not.toBeNull();
  act(() => identity.click());
  expect(onHome).toHaveBeenCalledTimes(1);

  const panel = host.querySelectorAll('section[aria-label="Realm"]')[1]!;
  expect(panel.querySelector('[data-aspect-mark="1"]')).not.toBeNull();
  expect(panel.querySelector(".frontier-aspect-medallion")?.getAttribute("data-tip")).toBe(aspectName(1));
  expect(panel.textContent).toContain("Order of Power");
  expect(panel.textContent).toContain(aspectName(1));

  act(() => root.render(<RealmHeaderChip name="Duskbite" level={1} aspect={1} orderId={12} onPress={onHome} />));
  expect(host.querySelector(".frontier-phone-realm-chip")?.getAttribute("aria-label")).toBe(
    `Duskbite, Order of Power, ${aspectName(1)}`,
  );

  act(() => root.render(<RealmPanel name="Duskbite" kind="wonder" level={1} stores={STORES} />));
  expect(host.querySelector(".frontier-aspect-medallion")?.getAttribute("data-tip")).toBe("Wonder");

  act(() => root.render(<RealmHeaderChip name="Duskbite" level={1} aspect={1} onPress={onHome} />));
  expect(host.querySelector(".frontier-phone-realm-chip__order")).toBeNull();
});

it("shows every stock on the desktop realm card, Fragments opening the shop and the next rank upgrading the castle", () => {
  const onUpgradeCastle = vi.fn();
  const onShop = vi.fn();
  act(() =>
    root.render(
      <RealmCard
        name="Duskbite"
        kind="realm"
        level={0}
        nextRank="City"
        aspect={1}
        orderId={12}
        population={{ used: 3, max: 12 }}
        stores={STORE_KINDS.map((kind) => store(kind, 0, 6_000))}
        fragments={250}
        lords={320}
        onShop={onShop}
        onUpgradeCastle={onUpgradeCastle}
        buildings={[
          { key: "farm", icon: "farm", name: "Farm", tier: 2, rateIcon: "wheat", rate: "+20/min", onUpgrade: vi.fn() },
          {
            key: "barracks",
            icon: "barracks",
            name: "Barracks",
            tier: 5,
            rateIcon: "troops",
            rate: "+3/min",
            maxed: true,
          },
        ]}
      />,
    ),
  );
  const card = host.querySelector<HTMLElement>(".frontier-realm-card")!;
  expect(
    [...card.querySelectorAll('[aria-label="Stores"] [data-store]')].map((tile) => tile.getAttribute("data-store")),
  ).toEqual([
    ...STORE_KINDS.filter((kind) => !isTroopStore(kind)),
    "fragments",
    "lords",
    ...STORE_KINDS.filter(isTroopStore),
  ]);
  expect(card.textContent).toContain("Pop 3/12");
  expect(card.querySelector('[data-store="lords"]')?.textContent).toBe("320LORDS");
  expect(card.querySelectorAll("[data-realm-buildings] li")).toHaveLength(2);
  expect(card.querySelectorAll(".realm-building__max")).toHaveLength(1);
  act(() => card.querySelector<HTMLButtonElement>('[aria-label="Fragments 250"]')!.click());
  expect(onShop).toHaveBeenCalledTimes(1);
  const rankUp = card.querySelector<HTMLButtonElement>("[data-realm-castle]")!;
  expect(rankUp.textContent).toBe("City");
  act(() => rankUp.click());
  expect(onUpgradeCastle).toHaveBeenCalledTimes(1);

  act(() =>
    root.render(
      <RealmCard
        name="Duskbite"
        kind="realm"
        level={3}
        stores={STORES}
        fragments={null}
        lords={null}
        onUpgradeCastle={onUpgradeCastle}
      />,
    ),
  );
  expect(host.querySelector("[data-realm-castle]")).toBeNull();
  expect(host.querySelector('[data-store="fragments"] button')).toBeNull();
});
