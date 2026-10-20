import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";

import { AppTopBar } from "./app-elements";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
});

const mount = async (player: Parameters<typeof AppTopBar>[0]["player"]) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <AppTopBar
          mark={<span>Realms</span>}
          places={[
            { to: "/", label: "Play", icon: "play", current: true },
            { to: "/season", label: "Season", icon: "leaderboard", current: false },
          ]}
          player={player}
        />
      </MemoryRouter>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return [...container.querySelectorAll<HTMLAnchorElement>('[data-role="tab"]')];
};

it("names the place that shows the player by its own word, with the player, and leads to it", async () => {
  const places = await mount({ to: "/profile", label: "Maelis", portrait: "/p.png", place: "You", current: false });
  const you = places.at(-1)!;
  expect(you.getAttribute("aria-label")).toBe("You: Maelis");
  expect(you.textContent).toBe("Maelis");
  expect(you.getAttribute("href")).toBe("/profile");
});

it("names a place by its word where it shows no player", async () => {
  const places = await mount({ to: "/profile", label: "You", icon: "person", current: false });
  expect(places.map((place) => place.getAttribute("aria-label") ?? place.textContent)).toEqual([
    "Play",
    "Season",
    "You",
  ]);
});
