import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { isExplicitSpectateSession, resolveSpectateIntent, useOutsidePlaySession } from "./spectator-session";

const Shell = () => {
  useOutsidePlaySession();
  return null;
};

describe("the spectate intent", () => {
  it("holds through a spectated game and ends when the player is back in the shell", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // In-app navigation strips the query; the latch keeps the intent while the game runs.
    expect(resolveSpectateIntent({ search: "?spectate=true" })).toBe(true);
    expect(isExplicitSpectateSession()).toBe(true);

    // Back to the shell's home, lobby or account: the signed-in player is no spectator there.
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Shell />));
    expect(isExplicitSpectateSession()).toBe(false);
    act(() => root.unmount());
  });
});
