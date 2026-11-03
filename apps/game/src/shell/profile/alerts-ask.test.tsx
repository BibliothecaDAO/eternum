import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const device = vi.hoisted(() => ({ state: "off" as "off" | "on" | "install", toggle: vi.fn() }));
const account = vi.hoisted(() => ({ level: "off" }));
/** The game the page plays: switched between a test's steps as a player moves between games. */
const playing = vi.hoisted(() => ({ game: { chainId: "0xa", gameId: 1 } }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "0x7" } } }),
  notificationOwnerOf: () => "0x7",
}));
vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: () => ({ status: "ready", saved: { level: account.level, revision: 1 }, save: vi.fn() }),
}));
vi.mock("./this-device", () => ({ useThisDevice: () => device }));
vi.mock("@/pwa/install-state", () => ({ useInstall: () => ({ install: vi.fn() }) }));
vi.mock("@/runtime/world/store", () => ({ getActiveGame: () => playing.game }));

import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { ALERTS_ASK } from "@/ui/design-system/kit/words";
import { AlertsAskCard } from "@/ui/features/frontier/alerts-ask-card";
import { useAskMemory, useDayAsk } from "./alerts-ask";

/**
 * One home's game day as its pages draw it: the Realm sheet, which draws A only once the day is claimed (`claimed`), and
 * the HUD's day end, which draws B only on a summary (`summary`), with Continue passing it by.
 */
type Home = { hasClaim: boolean; nextDay: number | null; claimed?: boolean; summary?: boolean };

const Moment = ({ hasClaim, nextDay, claimed = true, summary: summaryShown = true }: Home) => {
  const afterClaim = useDayAsk("claim", { hasClaim, nextDay });
  const summary = useDayAsk("summary", { hasClaim, nextDay });
  return (
    <>
      {afterClaim && claimed && (
        <section data-ask="A">
          <HudSheet label="Realm Labor" onClose={() => undefined}>
            <AlertsAskCard
              dayAsk={afterClaim}
              says={{ remind: ALERTS_ASK.claim(`Day ${afterClaim.nextDay} opens in 7h`), install: ALERTS_ASK.install }}
              verb="turn-on"
            />
          </HudSheet>
        </section>
      )}
      {summary && summaryShown && (
        <section data-ask="B">
          <AlertsAskCard
            dayAsk={summary}
            says={{ remind: ALERTS_ASK.day(summary.nextDay), install: ALERTS_ASK.install }}
            verb="remind"
          />
          <button onClick={summary.notNow}>Continue</button>
        </section>
      )}
    </>
  );
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useAskMemory.setState({ notNows: 0, asked: {} });
  device.state = "off";
  account.level = "off";
  playing.game = { chainId: "0xa", gameId: 1 };
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});

const read = () =>
  [...container.querySelectorAll("[data-ask]")].map((ask) => ({
    ask: ask.getAttribute("data-ask"),
    line: ask.querySelector(".ui-notice")?.textContent,
    // The ask's row of buttons (a sheet's foot is one too), not the sheet's way out.
    buttons: [...ask.querySelectorAll(".ui-actions button")].map((button) => button.textContent),
  }));
/** The page as it stands, drawn again (the same sheet still open). */
const show = async (home: Home) => {
  await act(async () => root.render(<Moment {...home} />));
  return read();
};
/** The page closed and opened again: a sheet reopened, a summary on another visit. */
const reopen = async (home: Home) => {
  await act(async () => root.unmount());
  root = createRoot(container);
  return show(home);
};
const press = async (label: string) => {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
  await act(async () => button!.click());
};
const asks = (shown: ReturnType<typeof read>) => shown.map(({ ask }) => ask);

it("asks a home with a claim after its claim, never on the day's summary, promising the next claim", async () => {
  expect(await show({ hasClaim: true, nextDay: 13 })).toEqual([
    {
      ask: "A",
      line: "Day 13 opens in 7h. Get one push when your claim is ready.",
      buttons: ["Not now", "Turn on alerts"],
    },
  ]);
});

it("asks a home with no claim on the day's summary, promising no claim, under Continue's weight", async () => {
  expect(await show({ hasClaim: false, nextDay: 13 })).toEqual([
    { ask: "B", line: "Get one push when Day 13 opens.", buttons: ["Remind me"] },
  ]);
});

it("asks once a game day: the open ask stands until answered, and a reopened page or the other moment asks no more", async () => {
  expect(asks(await show({ hasClaim: true, nextDay: 13 }))).toEqual(["A"]);
  expect(asks(await show({ hasClaim: true, nextDay: 13 }))).toEqual(["A"]);
  // Closed unanswered and opened again the same day: offered once is asked once.
  expect(await reopen({ hasClaim: true, nextDay: 13 })).toEqual([]);
  // In another game a home that claims nothing yet is asked on the summary; given a claim the same day, it is not again.
  playing.game = { chainId: "0xa", gameId: 2 };
  expect(asks(await reopen({ hasClaim: false, nextDay: 6 }))).toEqual(["B"]);
  expect(await reopen({ hasClaim: true, nextDay: 6 })).toEqual([]);
  // That game's next day asks again, at its home's moment.
  expect(asks(await reopen({ hasClaim: true, nextDay: 7 }))).toEqual(["A"]);
});

it("holds each game's day across games: game 1, then game 2, then game 1 again asks nothing more that day", async () => {
  expect(asks(await show({ hasClaim: true, nextDay: 13 }))).toEqual(["A"]);
  await press("Not now");
  expect(await show({ hasClaim: true, nextDay: 13 })).toEqual([]);
  playing.game = { chainId: "0xa", gameId: 2 };
  expect(asks(await reopen({ hasClaim: true, nextDay: 6 }))).toEqual(["A"]);
  await press("Not now");
  playing.game = { chainId: "0xa", gameId: 1 };
  expect(await reopen({ hasClaim: true, nextDay: 13 })).toEqual([]);
  expect(await reopen({ hasClaim: false, nextDay: 13 })).toEqual([]);
  // Game 1's next day asks again: two Not nows so far.
  expect(asks(await reopen({ hasClaim: true, nextDay: 14 }))).toEqual(["A"]);
});

it("ends both asks, in every game, after three Not nows", async () => {
  for (const [gameId, nextDay] of [
    [1, 13],
    [2, 6],
    [1, 14],
  ] as const) {
    playing.game = { chainId: "0xa", gameId };
    expect(asks(await reopen({ hasClaim: true, nextDay }))).toEqual(["A"]);
    await press("Not now");
  }
  expect(await reopen({ hasClaim: true, nextDay: 15 })).toEqual([]);
  playing.game = { chainId: "0xa", gameId: 3 };
  expect(await reopen({ hasClaim: false, nextDay: 2 })).toEqual([]);
});

it("spends the day only on an ask drawn: an unclaimed sheet opened and closed, then the claim, asks once", async () => {
  expect(await show({ hasClaim: true, nextDay: 13, claimed: false })).toEqual([]);
  expect(await reopen({ hasClaim: true, nextDay: 13, claimed: false })).toEqual([]);
  expect(useAskMemory.getState().asked).toEqual({});
  expect(asks(await reopen({ hasClaim: true, nextDay: 13 }))).toEqual(["A"]);
  expect(await reopen({ hasClaim: true, nextDay: 13 })).toEqual([]);
});

it("spends nothing on a HUD whose day end shows no summary", async () => {
  expect(await show({ hasClaim: false, nextDay: 13, summary: false })).toEqual([]);
  expect(useAskMemory.getState().asked).toEqual({});
  expect(asks(await show({ hasClaim: false, nextDay: 13 }))).toEqual(["B"]);
});

it("asks again on the next day in a page still open, unanswered or after Not now or Continue", async () => {
  // Unanswered, the sheet open through the day's turn: the new day asks.
  expect(asks(await show({ hasClaim: true, nextDay: 13 }))).toEqual(["A"]);
  expect(asks(await show({ hasClaim: true, nextDay: 14 }))).toEqual(["A"]);
  // The memory now holds the new game day (13, whose next is Day 14), drawn by this page.
  expect(useAskMemory.getState().asked).toEqual({ "0xa:1": { day: 13, host: expect.any(String) } });
  // Not now holds the day, and the next day asks again in the same page.
  await press("Not now");
  expect(await show({ hasClaim: true, nextDay: 14 })).toEqual([]);
  expect(asks(await show({ hasClaim: true, nextDay: 15 }))).toEqual(["A"]);
  // The HUD's day end stays mounted: Continue passes B by, and the next day's summary asks again.
  playing.game = { chainId: "0xa", gameId: 2 };
  expect(asks(await reopen({ hasClaim: false, nextDay: 4 }))).toEqual(["B"]);
  await press("Continue");
  expect(await show({ hasClaim: false, nextDay: 4 })).toEqual([]);
  expect(asks(await show({ hasClaim: false, nextDay: 5 }))).toEqual(["B"]);
});

it("asks nothing on the season's last day, which has no next day to tell of", async () => {
  expect(await show({ hasClaim: true, nextDay: null })).toEqual([]);
  expect(await reopen({ hasClaim: false, nextDay: null })).toEqual([]);
});

it("asks an iPhone's browser to install first, and asks nothing once this device has alerts", async () => {
  device.state = "install";
  expect(await show({ hasClaim: true, nextDay: 13 })).toEqual([
    {
      ask: "A",
      line: "On an iPhone, alerts need Realms on your Home Screen first.",
      buttons: ["Not now", "Add to Home Screen"],
    },
  ]);
  device.state = "on";
  account.level = "important";
  expect(await reopen({ hasClaim: true, nextDay: 14 })).toEqual([]);
});
