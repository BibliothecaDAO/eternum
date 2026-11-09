// @vitest-environment jsdom
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The signed-in Realms account as the app holds it, and identity answering as the Worker does for that account. */
const identity = vi.hoisted(() => {
  const state = { session: null as { user: { realmsId: string } } | null };
  const owner = () => state.session?.user.realmsId ?? "signed-out";
  return {
    state,
    client: {
      // Each account's own link for the day.
      createShare: vi.fn(async () => (owner() === "0xa" ? "AAAA2222" : "BBBB2222")),
      sharePosted: vi.fn(async () => {}),
      uploadShareCard: vi.fn(async () => {}),
      shareTally: vi.fn(async () => ({ links: 0, posted: 0, visits: 0, joined: 0, activated: 0 })),
    },
  };
});
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => identity.state,
  identityClient: identity.client,
}));
/** Each player's public name, as their card says it. */
const NAMES: Record<string, string> = { "0x1": "Ashwalker", "0x2": "Briar" };
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerProfile: () => ({ name: null, portrait: null }),
  usePlayerDisplayName: (player: string) => NAMES[player],
  usePlayerName: (player: string) => ({ state: "named", text: NAMES[player], claimed: true }),
}));
/** The browser's images of a drawn card (jsdom has no canvas): each made afresh from what the card says. */
vi.mock("@/utils/card-image", async (original) => ({
  ...(await original<typeof import("@/utils/card-image")>()),
  cardJpeg: vi.fn(async (node: HTMLElement) => new Blob([node.textContent ?? ""], { type: "image/jpeg" })),
  cardFile: vi.fn(async (node: HTMLElement, _size: unknown, name: string) => new File([node.textContent ?? ""], name)),
}));

const { DayShareSheet } = await import("./day-share-sheet");
const { setViewportWidth } = await import("../frame/test-viewport");

const DAY = {
  day: 2,
  totals: { reveals: 35, cleared: 5, chests: 0, essence: 7_200, labor: 524, lords: 0 },
  rank: { from: 3, to: 1 },
  trail: ["Beasts", "Rift"] as const,
};
const sharedDay = (player: string, gameId = 1) => ({ ...DAY, player, game: { chainId: "0x1", gameId } });

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  notifyManager.setNotifyFunction((notify) => act(notify));
  for (const call of Object.values(identity.client)) call.mockClear();
  identity.state.session = null;
  // One app, one query client, for every sheet a test opens.
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  notifyManager.setNotifyFunction((notify) => notify());
});

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));
const signIn = (realmsId: string | null) => (identity.state.session = realmsId ? { user: { realmsId } } : null);
const openSheet = async (shared: ReturnType<typeof sharedDay>) => {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <DayShareSheet shared={shared} onClose={() => undefined} />
      </QueryClientProvider>,
    ),
  );
  await settle();
};
const closeSheet = () =>
  act(async () => root.render(<QueryClientProvider client={client}>{null}</QueryClientProvider>));
const button = (word: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find((each) => each.textContent?.endsWith(word))!;
/** Presses Post on X and reads the link the post carries. */
const postOnX = async () => {
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  await act(async () => button("Post on X").click());
  const url = new URL(String(open.mock.calls[0]![0])).searchParams.get("url");
  open.mockRestore();
  return url;
};

it("posts the signed-in player's own link, never one an earlier player's sheet made on the same app", async () => {
  setViewportWidth(1440);
  signIn("0xa");
  await openSheet(sharedDay("0x1"));
  expect(await postOnX()).toBe(`${window.location.origin}/s/AAAA2222?via=x`);
  await closeSheet();

  // A signs out; B signs in on the same app and opens the same game's day 2.
  signIn(null);
  signIn("0xb");
  await openSheet(sharedDay("0x2"));
  expect(await postOnX()).toBe(`${window.location.origin}/s/BBBB2222?via=x`);
  expect(identity.client.sharePosted.mock.calls).toEqual([["AAAA2222"], ["BBBB2222"]]);
  // A's link is no longer held anywhere the app can read it.
  expect(client.getQueryCache().findAll({ queryKey: ["own-shares", "0xa"] })).toEqual([]);
});

it("asks identity for no link while nobody is signed in, and posts the game's address instead", async () => {
  setViewportWidth(1440);
  await openSheet(sharedDay("0x1"));
  expect(identity.client.createShare).not.toHaveBeenCalled();
  expect(await postOnX()).toBe(`${window.location.origin}/`);
  expect(identity.client.uploadShareCard).not.toHaveBeenCalled();
});

it("publishes nothing when the sheet is opened and closed without a post, and the card on the press of Post on X", async () => {
  setViewportWidth(1440);
  signIn("0xa");
  await openSheet(sharedDay("0x1"));
  await closeSheet();
  expect(identity.client.uploadShareCard).not.toHaveBeenCalled();
  expect(identity.client.sharePosted).not.toHaveBeenCalled();

  await openSheet(sharedDay("0x1"));
  await postOnX();
  await settle();
  expect(identity.client.uploadShareCard).toHaveBeenCalledTimes(1);
  const [code, card] = identity.client.uploadShareCard.mock.calls[0]! as unknown as [string, Blob];
  expect(code).toBe("AAAA2222");
  expect(await card.text()).toContain("Ashwalker");
  // A second press publishes the same card again for nobody: once per sheet.
  await postOnX();
  await settle();
  expect(identity.client.uploadShareCard).toHaveBeenCalledTimes(1);
});

it("hands a phone's share sheet each sheet's own card: another game's day, another player's, without reloading", async () => {
  const share = vi.fn(async (_data: ShareData) => {});
  vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { canShare: () => true, share }));
  setViewportWidth(390);
  const shareNow = async () => {
    for (let tick = 0; tick < 50 && button("Share")?.disabled !== false; tick += 1) await settle();
    await act(async () => button("Share").click());
    return share.mock.lastCall![0];
  };

  signIn("0xa");
  await openSheet(sharedDay("0x1", 1));
  const first = await shareNow();
  await closeSheet();
  await openSheet(sharedDay("0x1", 2));
  const secondGame = await shareNow();
  expect(secondGame.files![0]).not.toBe(first.files![0]);
  await closeSheet();

  signIn("0xb");
  await openSheet(sharedDay("0x2", 1));
  const otherPlayer = await shareNow();
  expect(await otherPlayer.files![0]!.text()).toContain("Briar");
  expect(await otherPlayer.files![0]!.text()).not.toContain("Ashwalker");
  expect(otherPlayer.url).toBe(`${window.location.origin}/s/BBBB2222?via=system`);
});
