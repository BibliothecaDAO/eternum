import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: "anonymous" }) }));

import { DoorwayScreen } from "./doorway-screen";
import { doorwayView, type GameRefusal } from "./doorway-view";
import { DOORWAY_WORDS } from "@/ui/design-system/kit/words";

const text = (markup: string) => new DOMParser().parseFromString(markup, "text/html").body.textContent ?? "";

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
  expect(withRealm).toContain(DOORWAY_WORDS.mapNotDrawn);
  expect(withRealm).toContain("Try again");
  expect(withRealm).toContain("Open Realm");
  expect(withRealm).not.toContain("World unavailable.");
  // With no realm to open there is nothing to offer but the retry.
  expect(render(false)).not.toContain("Open Realm");
});

it("leads a finalized game's boot to its Results, in place of the world not answering", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const ResultsProbe = () => <p data-testid="results">{useParams().id}</p>;
  const container = document.createElement("div");
  const root = createRoot(container);
  const doorway = (ended: boolean) => (
    <DoorwayScreen
      view={doorwayView({ source: "boot", phase: "error", audience: "player", ended })}
      realm={null}
      onRetry={() => {}}
      onSignIn={() => {}}
      results="/results/0xa-5"
    />
  );
  expect(text(renderToStaticMarkup(<MemoryRouter>{doorway(false)}</MemoryRouter>))).toContain("World unavailable.");
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/g/0xa/5/map"]}>
        <Routes>
          <Route path="/g/:chain/:game/map" element={doorway(true)} />
          <Route path="/results/:id" element={<ResultsProbe />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  try {
    expect(container.textContent).toContain(DOORWAY_WORDS.ended);
    expect(container.textContent).not.toContain("World unavailable.");
    const results = [...container.querySelectorAll("button")].find((button) => button.textContent === "Results");
    await act(async () => results?.click());
    expect(container.querySelector('[data-testid="results"]')?.textContent).toBe("0xa-5");
  } finally {
    await act(async () => root.unmount());
  }
});

it("tells a refused game's boot plainly and offers no retry, where any other failure offers one", () => {
  const doorway = (refused: GameRefusal | undefined) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <DoorwayScreen
          view={doorwayView({ source: "boot", phase: "error", audience: "player", refused })}
          realm={null}
          onRetry={() => {}}
          onSignIn={() => {}}
          results="/results/0xa-5"
        />
      </MemoryRouter>,
    );
  const refused = text(doorway("release"));
  expect(refused).toContain(DOORWAY_WORDS.gameRefused);
  const older = text(doorway("older-numbers"));
  expect(older).toContain(DOORWAY_WORDS.gameOnOlderNumbers);
  expect(older).not.toContain("Try again");
  expect(refused).not.toContain("World unavailable.");
  expect(refused).not.toContain("Try again");
  const failed = text(doorway(undefined));
  expect(failed).toContain("World unavailable.");
  expect(failed).toContain("Try again");
});
