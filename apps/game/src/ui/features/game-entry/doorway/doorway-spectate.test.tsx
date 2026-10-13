import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";

import { DoorwayScreen } from "./doorway-screen";
import { doorwayView } from "./doorway-view";

const text = (markup: string) => new DOMParser().parseFromString(markup, "text/html").body.textContent ?? "";

it.each([
  ["spectate", "Not on this game.", "Watch"],
  ["review", "This game has ended.", "Results"],
] as const)(
  "explains Blitz %s in one line with its one step, past a finished account step",
  (blitzEntry, line, step) => {
    const view = doorwayView({ source: "entry", phase: "spectate", audience: "player", signedIn: true, blitzEntry });
    expect(view.steps[0]).toEqual({ step: "account", state: "done" });
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <DoorwayScreen view={view} realm={null} onRetry={() => {}} onSignIn={() => {}} onSpectate={() => {}} />
      </MemoryRouter>,
    );
    expect(text(markup)).toContain(line);
    expect(text(markup)).toContain(step);
    // Back returns to the app at any step.
    expect(markup).toContain('data-role="back"');
  },
);

it("says the map could not be drawn and offers the realm beside Try again, in place of the world not answering", () => {
  const boot = { source: "boot", phase: "error", audience: "player", failedScene: "map" } as const;
  const render = (realmCanOpen: boolean) =>
    text(
      renderToStaticMarkup(
        <MemoryRouter>
          <DoorwayScreen
            view={doorwayView({ ...boot, realmCanOpen })}
            realm={null}
            onRetry={() => {}}
            onOpenRealm={() => {}}
            onSignIn={() => {}}
          />
        </MemoryRouter>,
      ),
    );
  const withRealm = render(true);
  expect(withRealm).toContain("The map could not be drawn.");
  expect(withRealm).toContain("Try again");
  expect(withRealm).toContain("Open realm");
  expect(withRealm).not.toContain("did not answer");
  // With no realm to open there is nothing to offer but the retry.
  expect(render(false)).not.toContain("Open realm");
});
