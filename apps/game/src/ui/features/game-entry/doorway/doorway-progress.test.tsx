import { aspectName, layerName, orderAspect } from "@bibliothecadao/types";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: "anonymous" }) }));

import type { DirectoryGame } from "@/shell/herald";

import { DoorwayScreen } from "./doorway-screen";
import { doorwayView } from "./doorway-view";

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

it("gives the bar's place to a step that asks the player to choose", () => {
  const page = draw(doorwayView({ source: "entry", phase: "settlement", audience: "player", signedIn: true }), {
    asking: true,
  });
  expect(page.querySelector('[role="progressbar"]')).toBeNull();
});

it("keeps the first-minutes tip when entering a newly founded Realm even though the Realm is already known", () => {
  const aspect = orderAspect(2)!;
  const page = new DOMParser().parseFromString(
    renderToStaticMarkup(
      <MemoryRouter>
        <DoorwayScreen
          view={loadingMap()}
          realm={{ name: "Temtinos", emblem: null, aspect }}
          game={{ mode: "frontier", day_index: 0 }}
          firstEntry
          onRetry={() => {}}
          onSignIn={() => {}}
        />
      </MemoryRouter>,
    ),
    "text/html",
  ).body;
  expect(page.textContent).toContain("Entering Temtinos");
  expect(page.textContent).toContain("First: build a Barracks");
});

it("renders the Frontier lockup, Aspect Facet, Entering Realm heading, day subtitle and Deep tip for a returning Realm", () => {
  const aspect = orderAspect(2)!;
  const page = new DOMParser().parseFromString(
    renderToStaticMarkup(
      <MemoryRouter>
        <DoorwayScreen
          view={loadingMap()}
          realm={{ name: "Temtinos", emblem: null, aspect }}
          game={{ mode: "frontier", day_index: 5 }}
          firstEntry={false}
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
  expect(page.textContent).toContain(`Hold ${layerName(3)} sites before rollover`);
});
