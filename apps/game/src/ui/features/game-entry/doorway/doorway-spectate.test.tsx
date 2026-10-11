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
