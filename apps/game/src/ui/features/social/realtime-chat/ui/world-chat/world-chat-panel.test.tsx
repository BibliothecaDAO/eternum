// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The game's players: four named, one who claimed no name, and the signed-in player, Maelis. */
const PLAYERS = vi.hoisted(() =>
  [
    [0xa1n, "Aldric"],
    [0xa2n, "Ada"],
    [0xa3n, "Corwin"],
    [0xa4n, "Maelis"],
    [0xa5n, null],
  ].map(([address, name]) => ({ address, entity: String(address), name, portrait: null })),
);
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayers: () => PLAYERS,
  playerAvatarUrl: (address: bigint) => `/portrait/${address}.png`,
  usePlayerNames: () => ({}),
  resolveChatSenderName: (_names: unknown, _id: string, displayName: string) => displayName,
}));
vi.mock("@/play/navigation/open-place", () => ({ openOnMap: vi.fn() }));

import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useRealtimeChatStore } from "../../model/store";
import type { WorldChatMessage } from "../../model/types";
import { WorldChatPanel } from "./world-chat-panel";

const ZONE = "game:0x1:1";
const message = (id: string, from: string, content: string) =>
  ({
    id,
    zoneId: ZONE,
    sender: { playerId: `0x${id}`, displayName: from },
    content,
    createdAt: "2026-10-28T08:00:00.000Z",
  }) as WorldChatMessage;

let host: HTMLDivElement;
let root: Root;
const send = vi.fn(() => Promise.resolve());

const drawRoom = (messages: WorldChatMessage[]) => {
  const { actions } = useRealtimeChatStore.getState();
  useRealtimeChatStore.setState({
    connectionStatus: "connected",
    joinedZoneIds: [ZONE],
    activeZoneId: ZONE,
    worldZones: {
      [ZONE]: {
        zoneId: ZONE,
        messages,
        unreadCount: 0,
        hasMoreHistory: false,
        lastFetchedCursor: null,
        isFetchingHistory: false,
        pendingMessages: [],
      },
    },
    actions: { ...actions, joinZone: () => undefined, sendWorldMessage: send },
  });
  act(() => root.render(<WorldChatPanel zoneId={ZONE} />));
};

const field = () => host.querySelector<HTMLInputElement>('input[aria-label="Message"]')!;
const listed = () => [...host.querySelectorAll('[aria-label="Mention a player"] [role="menuitem"]')];
const names = () => listed().map((item) => item.textContent);

/** Types as a keyboard does: the field's whole new text, the caret at its end. */
const type = (text: string) =>
  act(() => {
    const input = field();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.setSelectionRange(text.length, text.length);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const press = (key: string) =>
  act(() => {
    field().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  useIdentitySessionStore.setState({ session: { user: { id: "u-7", name: "Maelis", image: null } } } as never);
  send.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("lists the game's named players as an @ is typed, never the player themselves", () => {
  drawRoom([]);
  expect(field().getAttribute("aria-expanded")).toBe("false");
  type("@");
  expect(field().getAttribute("aria-expanded")).toBe("true");
  expect(names()).toEqual(["Ada", "Aldric", "Corwin"]);
  type("hello @al");
  expect(names()).toEqual(["Aldric"]);
  type("hello @x");
  expect(listed()).toEqual([]);
  // An address is no mention.
  type("ada@realms.test");
  expect(listed()).toEqual([]);
});

it("writes the picked name into the message, and sends it as the plain text typed", async () => {
  drawRoom([]);
  type("hold the ridge @a");
  press("ArrowDown");
  // Enter picks the name: it does not send the message.
  press("Enter");
  expect(field().value).toBe("hold the ridge @Aldric ");
  expect(listed()).toEqual([]);
  expect(send).not.toHaveBeenCalled();
  type("hold the ridge @Aldric at dusk");
  expect(listed()).toEqual([]);
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click());
  expect(send).toHaveBeenCalledWith(ZONE, { zoneId: ZONE, content: "hold the ridge @Aldric at dusk" });
});

it("picks a name with a press, the keyboard staying in the field, and Escape puts the list away", () => {
  drawRoom([]);
  type("@co");
  const corwin = listed()[0]!;
  const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  corwin.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  act(() => (corwin as HTMLButtonElement).click());
  expect(field().value).toBe("@Corwin ");
  type("@Corwin and @a");
  expect(names()).toEqual(["Ada", "Aldric"]);
  press("Escape");
  expect(listed()).toEqual([]);
  expect(field().getAttribute("aria-expanded")).toBe("false");
});

it("draws a mention of a player as their name, and marks a message that mentions the player for them", () => {
  drawRoom([
    message("1", "Corwin", "@Aldric hold the ridge"),
    message("2", "Ada", "@maelis your army is at the gate"),
    message("3", "Aldric", "write to ada@realms.test, Maelis"),
  ]);
  // Each message's row: its words follow the date's separator.
  const rows = [...host.querySelectorAll("li")].filter((row) => row.querySelector("p"));
  const mention = (row: Element) => [...row.querySelectorAll("[data-mention]")].map((m) => m.textContent);
  expect(mention(rows[0]!)).toEqual(["@Aldric"]);
  expect(rows[0]!.hasAttribute("data-mentions-me")).toBe(false);
  expect(mention(rows[1]!)).toEqual(["@maelis"]);
  expect(rows[1]!.hasAttribute("data-mentions-me")).toBe(true);
  expect(rows[1]!.querySelector('[data-mention="Maelis"]')!.className).toContain("text-hud-gold");
  expect(mention(rows[2]!)).toEqual([]);
  expect(rows[2]!.hasAttribute("data-mentions-me")).toBe(false);
  // The words stay as typed; the time before them is the reader's clock.
  expect(rows.map((row) => row.textContent?.replace(/^\[[^\]]+\] /, ""))).toEqual([
    "<Corwin> @Aldric hold the ridge",
    "<Ada> @maelis your army is at the gate",
    "<Aldric> write to ada@realms.test, Maelis",
  ]);
});
