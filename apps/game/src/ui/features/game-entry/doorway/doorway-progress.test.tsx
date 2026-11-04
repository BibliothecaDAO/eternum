import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: "anonymous" }) }));

import { DoorwayScreen } from "./doorway-screen";
import { doorwayView } from "./doorway-view";

const draw = (view: ReturnType<typeof doorwayView>, asking = false) =>
  new DOMParser().parseFromString(
    renderToStaticMarkup(
      <MemoryRouter>
        <DoorwayScreen view={view} realm={null} onRetry={() => {}} onSignIn={() => {}} asking={asking} />
      </MemoryRouter>,
    ),
    "text/html",
  ).body;

it("shows a player's map loading as one bar with its share and step, and what the first minutes hold", () => {
  const page = draw(doorwayView({ source: "boot", phase: "wait_worldmap_ready", audience: "player", modelShare: 0.5 }));
  const bar = page.querySelector('[role="progressbar"]')!;
  expect(bar.getAttribute("aria-valuenow")).toBe("71");
  expect(page.textContent).toContain("Loading the map");
  expect(page.textContent).toContain("71%");
  expect(page.textContent).toContain("Step 3 of 4");
  expect(page.textContent).toContain("First: build a Barracks");
  expect(page.textContent).toContain("Claim Labor every day");
  // A meter, not a control: nothing on the page but the places can be pressed while it loads.
  expect([...page.querySelectorAll("button")].filter((button) => !button.closest('[data-band="tabs"]'))).toEqual([]);
});

it("keeps the first minutes to a player: a spectator's doorway shows the bar alone", () => {
  const page = draw(doorwayView({ source: "boot", phase: "wait_worldmap_ready", audience: "spectator" }));
  expect(page.textContent).toContain("Step 1 of 2");
  expect(page.textContent).not.toContain("First: build a Barracks");
});

it("gives the bar's place to a step that asks the player to choose", () => {
  const page = draw(doorwayView({ source: "entry", phase: "settlement", audience: "player", signedIn: true }), true);
  expect(page.querySelector('[role="progressbar"]')).toBeNull();
});
