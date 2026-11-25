import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The Feed's unread count, as the game's important stories make it; two arrived since it was last read.
vi.mock("@/ui/features/event-feed/quick-feed", async (original) => ({
  ...(await original<typeof import("@/ui/features/event-feed/quick-feed")>()),
  useUnreadImportantCount: (open: boolean) => (open ? 0 : 2),
}));

import { dayClock } from "./day-clock";
import { DayMedallion } from "./day-pill";
import { FrontierPlaces } from "./frontier-desktop";
import { isTroopStore, STORE_KINDS } from "../stores";
import { RealmCard } from "./realm-card";
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

it("says the day and the time left in the top bar, and when the day ends and how long tomorrow lasts on hover", () => {
  const clock = dayClock(
    { dayUnitSeconds: 4 * 3_600, seed: 1n, startMainAt: 0, scheduledEndAt: 21 * 20 * 14_400, endAt: 21 * 20 * 14_400 },
    3_600,
  );
  act(() => root.render(<DayMedallion clock={clock} />));
  const pill = host.querySelector('[role="timer"]')!;
  expect(pill.getAttribute("aria-label")).toContain(`Day ${clock.day}`);
  expect(pill.querySelector(".frontier-day-dial__left")?.textContent).toBeTruthy();
  expect(pill.querySelector("img")?.getAttribute("src")).toBe("/images/hud/day-medallion-calm.webp");
  expect(pill.getAttribute("data-tip")).toMatch(/^Day ends \d\d:\d\d · .+ left · Tomorrow lasts /);
});

it("reads a 24-hour day in hours on the top bar and its hover, as Play does (live-qa-night-1 P3-8)", () => {
  const day = dayClock(
    { dayUnitSeconds: 4 * 3_600, seed: 1n, startMainAt: 0, scheduledEndAt: 21 * 20 * 14_400, endAt: 21 * 20 * 14_400 },
    3_600,
  );
  act(() => root.render(<DayMedallion clock={{ ...day, secondsLeft: 24 * 3_600, tomorrowSeconds: 24 * 3_600 }} />));
  const pill = host.querySelector('[role="timer"]')!;
  expect(pill.getAttribute("aria-label")).toContain(`Day ${day.day}`);
  expect(pill.textContent).toContain("24h");
  expect(pill.getAttribute("data-tip")).toMatch(/ · Tomorrow lasts 24h$/);
});

it("offers a desktop's four places in order, Settings named, each a panel its press opens and a second press closes", () => {
  const onSurface = vi.fn();
  const places = (surface: "research" | "feed" | "season" | "settings" | null, research = false) => {
    act(() => root.render(<FrontierPlaces surface={surface} onSurface={onSurface} research={research} />));
    return [...host.querySelectorAll("nav button")] as HTMLButtonElement[];
  };
  const closed = places(null, true);
  expect(
    closed.map((button) => [button.textContent?.replace(/\d/g, ""), button.getAttribute("aria-selected")]),
  ).toEqual([
    ["Research", "false"],
    ["Feed", "false"],
    ["Season", "false"],
    ["Settings", "false"],
  ]);
  expect(closed[0].querySelector('[data-shape="diamond"]')).not.toBeNull();
  expect(closed[1].textContent).toContain("2");
  act(() => closed[1].click());
  expect(onSurface).toHaveBeenLastCalledWith("feed");
  const feed = places("feed");
  expect(feed[1].getAttribute("aria-selected")).toBe("true");
  expect(feed[1].textContent).not.toContain("2");
  act(() => feed[1].click());
  expect(onSurface).toHaveBeenLastCalledWith(null);
  act(() => feed[3].click());
  expect(onSurface).toHaveBeenLastCalledWith("settings");
  expect(places("settings")[3].getAttribute("aria-selected")).toBe("true");
});

it("renders the Aspect medallion tinted in the Aspect color, and the rank and Order of Power beside the Realm name", () => {
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
      </>,
    ),
  );
  const card = host.querySelector<HTMLElement>(".frontier-realm-card")!;
  const identity = card.querySelector<HTMLButtonElement>(".frontier-realm-card__identity")!;
  expect(identity.querySelector('[data-aspect-mark="1"]')).not.toBeNull();
  expect(identity.querySelector(".frontier-aspect-medallion")?.getAttribute("style")).toContain("--hud-aspect");
  expect(identity.querySelector('img[src*="portraits"]')).toBeNull();
  expect(card.querySelector(".frontier-realm-card__sub")?.textContent).toBe("CityOrder of Power");
  expect(card.querySelector('[data-order-id="12"] img')).not.toBeNull();
  act(() => identity.click());
  expect(onHome).toHaveBeenCalledTimes(1);
});

it("shows every stock with its rate, Fragments opening the shop, and the next rank's Upgrade when the realm can pay", () => {
  const onUpgrade = vi.fn();
  const onShop = vi.fn();
  act(() =>
    root.render(
      <RealmCard
        name="Duskbite"
        kind="realm"
        level={0}
        rankUp={{ name: "City", gives: "+1 army slot", sending: false, onUpgrade }}
        aspect={1}
        orderId={12}
        stores={STORE_KINDS.map((kind) => store(kind, 0, 6_000))}
        fragments={250}
        lords={320}
        onShop={onShop}
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
  expect(card.textContent).not.toContain("Pop");
  expect(card.querySelector('[data-store="labor"]')?.textContent).toBe("0+10/min");
  expect(card.querySelector('[data-store="lords"]')?.textContent).toBe("320LORDS");
  expect(card.querySelector('[data-store="fragments"]')?.textContent).toBe("250Shop");
  act(() => card.querySelector<HTMLButtonElement>('[aria-label="Fragments 250"]')!.click());
  expect(onShop).toHaveBeenCalledTimes(1);
  expect(card.querySelector(".frontier-realm-card__next")?.textContent).toBe("Next rank City · +1 army slotUpgrade");
  act(() => card.querySelector<HTMLButtonElement>("[data-realm-castle]")!.click());
  expect(onUpgrade).toHaveBeenCalledTimes(1);

  act(() =>
    root.render(<RealmCard name="Duskbite" kind="realm" level={3} stores={STORES} fragments={null} lords={null} />),
  );
  expect(host.querySelector("[data-realm-castle]")).toBeNull();
  expect(host.querySelector('[data-store="fragments"] button')).toBeNull();
});

it("locks the next rank, with the price it needs, until the realm can pay it", () => {
  act(() =>
    root.render(
      <RealmCard
        name="Duskbite"
        kind="realm"
        level={2}
        rankUp={{
          name: "Empire",
          need: { of: "labor", amount: 12_000 },
          refusal: "Needs 12,000 Labor, have 9,640",
          sending: false,
        }}
        stores={STORES}
        fragments={null}
        lords={null}
      />,
    ),
  );
  const rankUp = host.querySelector<HTMLElement>("[data-realm-castle]")!;
  expect(rankUp.tagName).toBe("SPAN");
  expect(rankUp.textContent).toBe("Needs 12K");
  expect(rankUp.getAttribute("aria-label")).toBe("Upgrade · Empire: Needs 12,000 Labor, have 9,640");
});

it("says Upgrading on the button while the rank-up is sent, and takes no second press", () => {
  const onUpgrade = vi.fn();
  act(() =>
    root.render(
      <RealmCard
        name="Duskbite"
        kind="realm"
        level={0}
        rankUp={{ name: "City", sending: true, onUpgrade }}
        stores={STORES}
        fragments={null}
        lords={null}
      />,
    ),
  );
  const rankUp = host.querySelector<HTMLButtonElement>("[data-realm-castle]")!;
  expect([rankUp.tagName, rankUp.textContent, rankUp.disabled]).toEqual(["BUTTON", "Upgrading…", true]);
  act(() => rankUp.click());
  expect(onUpgrade).not.toHaveBeenCalled();
});

it("says why the LORDS show a dash: still being read, or the wallet could not be read", () => {
  const lordsLabel = (lords: "reading" | "failed" | number) => {
    act(() =>
      root.render(<RealmCard name="Duskbite" kind="realm" level={1} stores={STORES} fragments={null} lords={lords} />),
    );
    const cell = host.querySelector('[data-store="lords"] [aria-label]')!;
    return [cell.textContent, cell.getAttribute("aria-label")];
  };
  expect(lordsLabel("reading")).toEqual(["—LORDS", "LORDS: reading your wallet…"]);
  expect(lordsLabel("failed")).toEqual(["—LORDS", "LORDS: your wallet could not be read"]);
  expect(lordsLabel(1_000)).toEqual(["1KLORDS", "LORDS 1K"]);
});
