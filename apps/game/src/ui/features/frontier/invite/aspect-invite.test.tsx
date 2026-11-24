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
const createInvite = vi.fn();
const opened = vi.fn();
const written = vi.fn();
const original = identityClient.createInvite;

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
  createInvite.mockReset();
  identityClient.createInvite = createInvite;
  useIdentitySessionStore.getState().applySession(LAB_SESSION);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  identityClient.createInvite = original;
});

/** The lab realm's invite; `aspect` the Aspect its home joined, none for a game without Aspects. */
const renderInvite = async (aspect?: number, queries = new QueryClient()) => {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={queries}>
          <LabGame
            mode="frontier"
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
  expect(createInvite).not.toHaveBeenCalled();
});

it("invites to the Aspect identity names by its name and its Orders' crests, posting and copying the player's own link", async () => {
  createInvite.mockResolvedValue({ code: "INVT2345", aspect: 2, chainId: getActiveGame()!.chainId, gameId: 1 });
  await renderInvite(2);
  await vi.waitFor(() => expect(panel()!.textContent).toContain("Invite a friend to Luminary"));
  expect(panel()!.querySelectorAll("[data-icon], img, svg").length).toBeGreaterThanOrEqual(4);
  expect(createInvite).toHaveBeenCalledOnce();

  await vi.waitFor(() => expect(button("Post on X")?.hasAttribute("disabled")).toBe(false));
  await act(async () => button("Post on X")!.click());
  const post = new URL(opened.mock.calls[0]![0] as string);
  expect(post.searchParams.get("text")).toBe("Join me in Luminary in Frontier.");
  expect(post.searchParams.get("url")).toBe(`${window.location.origin}/s/INVT2345?via=x`);

  await act(async () => button("Copy link")!.click());
  expect(written).toHaveBeenCalledWith(`${window.location.origin}/s/INVT2345?via=system`);
  expect(button("Link copied")).toBeDefined();
});

it("names the Aspect the link lands in, the season's, when the home in this game joined another", async () => {
  createInvite.mockResolvedValue({ code: "INVT2347", aspect: 1, chainId: null, gameId: null });
  await renderInvite(2);
  await vi.waitFor(() => expect(panel()!.textContent).toContain("Invite a friend to Prowess"));
  expect(panel()!.textContent).not.toContain("Luminary");
});

it("offers nothing and reports no failure when identity has no invite for the player, asking once", async () => {
  createInvite.mockResolvedValue(null);
  await renderInvite(2);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 1_500)));
  expect(createInvite).toHaveBeenCalledOnce();
  expect(panel()).toBeNull();
  expect(host.textContent).not.toContain("could not be made");
});

it("asks identity again for an invite it had none for once the panel opens again", async () => {
  const queries = new QueryClient();
  createInvite.mockResolvedValue(null);
  await renderInvite(2, queries);
  await vi.waitFor(() => expect(createInvite).toHaveBeenCalledOnce());
  await act(async () => root.render(<></>));
  createInvite.mockResolvedValue({ code: "INVT2348", aspect: 2, chainId: getActiveGame()!.chainId, gameId: 1 });
  await renderInvite(2, queries);
  await vi.waitFor(() => expect(panel()!.textContent).toContain("Invite a friend to Luminary"));
  expect(createInvite).toHaveBeenCalledTimes(2);
});

it("says when identity refuses the invite, and asks again on Try again", async () => {
  createInvite.mockRejectedValue(new Error("aspect_unavailable"));
  await renderInvite(3);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 1_500)));
  expect(host.textContent).toContain("Your invite link could not be made.");
  createInvite.mockResolvedValue({ code: "INVT2346", aspect: 3, chainId: getActiveGame()!.chainId, gameId: 1 });
  await act(async () => button("Try again")!.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(host.textContent).not.toContain("could not be made");
  expect(button("Post on X")).toBeDefined();
});
