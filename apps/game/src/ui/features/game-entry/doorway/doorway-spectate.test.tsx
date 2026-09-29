import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { doorwayView } from "./doorway-view";
import { DoorwayScreen } from "./doorway-screen";

it.each(["spectate", "review"] as const)("explains Blitz %s with a finished account step", (blitzEntry) => {
  const view = doorwayView({ source: "entry", phase: "spectate", audience: "player", signedIn: true, blitzEntry });
  expect(view.steps[0]).toEqual({ step: "account", state: "done" });
  const html = renderToStaticMarkup(
    <DoorwayScreen view={view} realm={null} onRetry={() => {}} onSignIn={() => {}} onSpectate={() => {}} />,
  );
  expect(html).toContain(
    blitzEntry === "review"
      ? "This game has ended. Its results are final."
      : "You are not on this game’s roster. You can watch.",
  );
  expect(html).toContain(blitzEntry === "review" ? "Review" : "Watch");
});
