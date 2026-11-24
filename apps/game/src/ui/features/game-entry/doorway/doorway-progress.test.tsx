import { aspectName, orderAspect } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: "anonymous" }) }));

import { advanceLoadingProgress, resetLoadingProgress } from "@/game-entry/loading-progress";
import { FirstFrame } from "@/shell/first-frame";
import type { DirectoryGame } from "@/shell/herald";
import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";

import { DoorwayScreen } from "./doorway-screen";
import { doorwayView } from "./doorway-view";

afterEach(() => {
  resetLoadingProgress();
});

type Mode = NonNullable<DirectoryGame["mode"]>;

const draw = (view: ReturnType<typeof doorwayView>, { asking = false, mode = "frontier" as Mode } = {}) =>
  new DOMParser().parseFromString(
    renderToStaticMarkup(
      <MemoryRouter>
        <DoorwayScreen
          view={view}
          realm={null}
          game={{ mode }}
          onRetry={() => {}}
          onSignIn={() => {}}
          asking={asking}
        />
      </MemoryRouter>,
    ),
    "text/html",
  ).body;

const loadingMap = () =>
  doorwayView({ source: "boot", phase: "wait_worldmap_ready", audience: "player", modelShare: 0.5 });

it("shows a Frontier player's map loading as one bar with its share and step, and what the first minutes hold", () => {
  const page = draw(loadingMap());
  const bar = page.querySelector('[role="progressbar"]')!;
  expect(bar.getAttribute("aria-valuenow")).toBe("71");
  expect(page.textContent).toContain("Loading the map");
  expect(page.textContent).toContain("71%");
  expect(page.textContent).toContain("Step 3 of 4");
  expect(page.textContent).toContain("First: build a Barracks");
  // A meter, not a control: nothing on the page but the places can be pressed while it loads.
  expect([...page.querySelectorAll("button")].filter((button) => !button.closest('[data-band="tabs"]'))).toEqual([]);
});

it.each(["blitz", "eternum"] as const)("keeps Frontier's first minutes out of a %s entry: the bar alone", (mode) => {
  const page = draw(loadingMap(), { mode });
  expect(page.textContent).toContain("Loading the map");
  expect(page.textContent).not.toContain("First: build a Barracks");
});

it("keeps the first minutes to a player: a spectator's doorway shows the bar alone", () => {
  const page = draw(doorwayView({ source: "boot", phase: "wait_worldmap_ready", audience: "spectator" }));
  expect(page.textContent).toContain("Step 1 of 2");
  expect(page.textContent).not.toContain("First: build a Barracks");
});

it("gives the bar's place to a step that asks the player to choose, with no redundant mode title", () => {
  const page = draw(doorwayView({ source: "entry", phase: "settlement", audience: "player", signedIn: true }), {
    asking: true,
  });
  expect(page.querySelector('[role="progressbar"]')).toBeNull();
  expect(page.querySelector('[data-band="title"]')).toBeNull();
});

it("renders the Frontier lockup, Aspect Facet, Entering Realm heading, day subtitle and first-minutes tip when the realm is known", () => {
  const aspect = orderAspect(2)!;
  const page = new DOMParser().parseFromString(
    renderToStaticMarkup(
      <MemoryRouter>
        <DoorwayScreen
          view={loadingMap()}
          realm={{ name: "Temtinos", emblem: null, aspect }}
          game={{ mode: "frontier", day_index: 5 }}
          onRetry={() => {}}
          onSignIn={() => {}}
        />
      </MemoryRouter>,
    ),
    "text/html",
  ).body;
  expect(page.querySelector("[data-doorway-loading]")).not.toBeNull();
  expect(page.querySelector(`[data-aspect-mark="${aspect}"]`)).not.toBeNull();
  expect(page.textContent).toContain("Entering Temtinos");
  expect(page.textContent).toContain(aspectName(aspect));
  expect(page.textContent).toContain("Day 6");
  expect(page.textContent).toContain("First: build a Barracks");
});

it("never shows progress or a redundant mode title on Sign in, Retry, Devices, Refused, or Ended blocker screens", () => {
  const blockers = [
    doorwayView({ source: "entry", phase: "account", audience: "player", signedIn: false }),
    doorwayView({ source: "entry", phase: "settlement-waiting", audience: "player", signedIn: true }),
    doorwayView({ source: "boot", phase: "select_world", audience: "player", waiting: true }),
    doorwayView({ source: "boot", phase: "error", audience: "player" }),
    doorwayView({ source: "boot", phase: "error", audience: "player", accountError: "device_limit_reached" }),
    doorwayView({ source: "boot", phase: "error", audience: "player", refused: "release" }),
    doorwayView({ source: "boot", phase: "error", audience: "player", ended: true }),
  ];
  for (const view of blockers) {
    const page = draw(view);
    expect(page.querySelector('[role="progressbar"]')).toBeNull();
    expect(page.textContent).not.toContain("Step 1 of");
    expect(page.textContent).not.toContain("Step 2 of");
    expect(page.querySelector('[data-band="title"]')).toBeNull();
  }
});

it("uses the Frontier lockup while game metadata is still loading and shares monotonic progress with FirstFrame", () => {
  const page = new DOMParser().parseFromString(
    renderToStaticMarkup(
      <MemoryRouter>
        <DoorwayScreen view={loadingMap()} realm={null} onRetry={() => {}} onSignIn={() => {}} />
      </MemoryRouter>,
    ),
    "text/html",
  ).body;
  expect(page.querySelector<HTMLImageElement>(".doorway-stage__lockup")?.getAttribute("src")).toBe(AGE_LOCKUP.frontier);

  advanceLoadingProgress(58);
  const handoff = new DOMParser().parseFromString(renderToStaticMarkup(<FirstFrame />), "text/html").body;
  expect(handoff.querySelector("[data-doorway-loading]")).not.toBeNull();
  expect(handoff.querySelector<HTMLImageElement>(".doorway-stage__lockup")?.getAttribute("src")).toBe(
    AGE_LOCKUP.frontier,
  );
  expect(handoff.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("58");
});

it("never traps on a not-started game: shows the start time and Back to Play with no loading bar", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const startsAt = Math.floor(Date.now() / 1000) + 3 * 3600;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/enter/0xa/4"]}>
        <Routes>
          <Route
            path="/enter/:chain/:game"
            element={
              <DoorwayScreen
                view={doorwayView({ source: "entry", phase: "settlement-waiting", audience: "player", signedIn: true })}
                realm={null}
                game={{ mode: "frontier", clock: { start_main_at: startsAt } }}
                onRetry={() => {}}
                onSignIn={() => {}}
              />
            }
          />
          <Route path="/" element={<p data-play-home>Play home</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  try {
    expect(container.textContent).toContain("This game has not started yet.");
    expect(container.textContent).toContain("Starts ");
    expect(container.textContent).not.toContain("Preparing your realm");
    expect(container.textContent).not.toContain("Step 2 of 4");
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    const back = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Back to Play",
    )!;
    expect(back).toBeDefined();
    await act(async () => back.click());
    expect(container.querySelector("[data-play-home]")?.textContent).toBe("Play home");
  } finally {
    await act(async () => root.unmount());
  }
});
