import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const device = vi.hoisted(() => ({ state: "off" as "off" | "on" | "install", toggle: vi.fn() }));
const account = vi.hoisted(() => ({ level: "off" }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "0x7" } } }),
  notificationOwnerOf: () => "0x7",
}));
vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: () => ({ status: "ready", saved: { level: account.level, revision: 1 }, save: vi.fn() }),
}));
vi.mock("./this-device", () => ({ useThisDevice: () => device }));
vi.mock("@/pwa/install-state", () => ({ useInstall: () => ({ install: vi.fn() }) }));
vi.mock("@/runtime/world/store", () => ({ getActiveGame: () => ({ chainId: "0xa", gameId: 1 }) }));

import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { ALERTS_ASK } from "@/ui/design-system/kit/words";
import { AlertsAskCard } from "@/ui/features/frontier/alerts-ask-card";
import { useAskMemory, useDayAsk } from "./alerts-ask";

/** Both moments of one game day for one home, as the Realm sheet (A, after the claim) and the day's summary (B) ask. */
const Day = ({ hasClaim, today }: { hasClaim: boolean; today: number }) => {
  const afterClaim = useDayAsk("claim", { hasClaim, today });
  const summary = useDayAsk("summary", { hasClaim, today });
  return (
    <>
      {afterClaim && (
        <section data-ask="A">
          <HudSheet label="Realm Labor" onClose={() => undefined}>
            <AlertsAskCard
              dayAsk={afterClaim}
              says={{ remind: ALERTS_ASK.claim(`Day ${today + 1} opens in 7h`), install: ALERTS_ASK.install }}
              verb="turn-on"
            />
          </HudSheet>
        </section>
      )}
      {summary && (
        <section data-ask="B">
          <AlertsAskCard
            dayAsk={summary}
            says={{ remind: ALERTS_ASK.day(today + 1), install: ALERTS_ASK.install }}
            verb="remind"
          />
        </section>
      )}
    </>
  );
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useAskMemory.setState({ notNows: 0, lastNotNow: null });
  device.state = "off";
  account.level = "off";
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});

const show = async (home: { hasClaim: boolean; today: number }) => {
  await act(async () => root.render(<Day {...home} />));
  return [...container.querySelectorAll("[data-ask]")].map((ask) => ({
    ask: ask.getAttribute("data-ask"),
    line: ask.querySelector(".ui-notice")?.textContent,
    // The ask's row of buttons (a sheet's foot is one too), not the sheet's way out.
    buttons: [...ask.querySelectorAll(".ui-actions button")].map((button) => button.textContent),
  }));
};
const press = async (label: string) => {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
  await act(async () => button!.click());
};

it("asks a home with a claim after its claim, never on the day's summary, promising the next claim", async () => {
  expect(await show({ hasClaim: true, today: 12 })).toEqual([
    {
      ask: "A",
      line: "Day 13 opens in 7h. Get one push when your claim is ready.",
      buttons: ["Not now", "Turn on alerts"],
    },
  ]);
});

it("asks a home with no claim on the day's summary, promising no claim, under Continue's weight", async () => {
  expect(await show({ hasClaim: false, today: 12 })).toEqual([
    {
      ask: "B",
      line: "Get one push when Day 13 opens.",
      buttons: ["Remind me"],
    },
  ]);
});

it("holds both asks after a Not now until the next game day, and ends them after three", async () => {
  await show({ hasClaim: true, today: 12 });
  await press("Not now");
  expect(await show({ hasClaim: true, today: 12 })).toEqual([]);
  expect(await show({ hasClaim: false, today: 12 })).toEqual([]);
  expect((await show({ hasClaim: true, today: 13 })).map(({ ask }) => ask)).toEqual(["A"]);
  await press("Not now");
  // The day's summary passed by with Continue is the third Not now (DayDone calls notNow).
  await act(async () => useAskMemory.getState().notNow("0xa:1:14"));
  expect(await show({ hasClaim: true, today: 15 })).toEqual([]);
  expect(await show({ hasClaim: false, today: 16 })).toEqual([]);
});

it("asks an iPhone's browser to install first, and asks nothing once this device has alerts", async () => {
  device.state = "install";
  expect(await show({ hasClaim: true, today: 12 })).toEqual([
    {
      ask: "A",
      line: "On an iPhone, alerts need Realms on your Home Screen first.",
      buttons: ["Not now", "Add to Home Screen"],
    },
  ]);
  device.state = "on";
  account.level = "important";
  expect(await show({ hasClaim: true, today: 12 })).toEqual([]);
});
