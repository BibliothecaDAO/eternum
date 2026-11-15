// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The invite on the lab's game, signed in as the lab's player; identity's link-making and the browser's clipboard and
// new tab stand in.
const { identityClient, useIdentitySessionStore } = await import("@/hooks/context/identity-session");
const { LAB_SESSION } = await import("@/shell/lab/app-lab-fixtures");
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { getActiveGame } = await import("@/runtime/world");
const { AspectInvite } = await import("./aspect-invite");

let host: HTMLDivElement;
let root: Root;
const createShare = vi.fn();
const opened = vi.fn();
const written = vi.fn();
const original = identityClient.createShare;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  vi.stubGlobal("open", opened);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: written }, configurable: true });
  written.mockResolvedValue(undefined);
  createShare.mockReset();
  identityClient.createShare = createShare;
  useIdentitySessionStore.getState().applySession(LAB_SESSION);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  identityClient.createShare = original;
});

/** The lab realm's invite; `aspect` the Aspect its home joined, none for a game without Aspects. */
const renderInvite = async (aspect?: number) => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LabGame
            preset={5}
            facts={() =>
              aspect === undefined
                ? []
                : [{ model: "HomeAspect", key: "0x9a1", value: { game_id: 1, home: 7n, aspect } }]
            }
          >
            {(store) => <AspectInvite realm={store.require("Structure", { game_id: 1, entity_id: 7 })} />}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
};
const panel = () => host.querySelector('[aria-label^="Invite a friend"]');
const button = (word: string) => [...host.querySelectorAll("button")].find((each) => each.textContent?.endsWith(word));

it("offers nothing to a home that joined no Aspect", async () => {
  await renderInvite();
  expect(panel()).toBeNull();
  expect(createShare).not.toHaveBeenCalled();
});

it("invites to the home's Aspect by its name and its Orders' crests, posting and copying the player's own link", async () => {
  createShare.mockResolvedValue("INVT2345");
  await renderInvite(2);
  expect(panel()!.textContent).toContain("Invite a friend to Harmony");
  expect(panel()!.querySelectorAll("[data-icon], img, svg").length).toBeGreaterThanOrEqual(4);
  expect(createShare).toHaveBeenCalledWith({ kind: "aspect", chainId: getActiveGame()!.chainId, gameId: 1, moment: 2 });

  await act(async () => button("Post on X")!.click());
  const post = new URL(opened.mock.calls[0]![0] as string);
  expect(post.searchParams.get("text")).toBe("Join me in Harmony in Frontier.");
  expect(post.searchParams.get("url")).toBe(`${window.location.origin}/s/INVT2345?via=x`);

  await act(async () => button("Copy link")!.click());
  expect(written).toHaveBeenCalledWith(`${window.location.origin}/s/INVT2345?via=system`);
  expect(button("Link copied")).toBeDefined();
});

it("says when identity refuses the invite, and asks again on Try again", async () => {
  createShare.mockRejectedValue(new Error("not_in_aspect"));
  await renderInvite(3);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 1_500)));
  expect(panel()!.textContent).toContain("Your invite link could not be made.");
  createShare.mockResolvedValue("INVT2346");
  await act(async () => button("Try again")!.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(panel()!.textContent).not.toContain("could not be made");
  expect(button("Post on X")).toBeDefined();
});
