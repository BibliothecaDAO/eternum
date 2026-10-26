// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The account's build orders as the identity service answers them: each save comes back at the next revision. */
const service = vi.hoisted(() => ({
  saveBuildOrders: vi.fn(async (saved: { owner: string; revision: number; book: unknown }) => ({
    ...saved,
    revision: saved.revision + 1,
  })),
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  identityClient: service,
}));

import { useActiveBuildOrder, useBuildOrderStore } from "@/hooks/use-build-orders";
import { BUILD_ORDER_GOALS, readBuildOrderText, type BuildOrderBook } from "@bibliothecadao/eternum/automation";

import { BuildOrderMaker } from "./build-order-maker";

const COAL_RUSH = {
  name: "Coal rush",
  steps: [
    { rank: 0, goal: "farm" as const, count: 2 },
    { rank: 1, goal: "coal" as const, count: 2 },
  ],
};

let host: HTMLDivElement;
let root: Root;
const clipboard = { writeText: vi.fn(async (_text: string) => undefined) };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(navigator, { clipboard });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  service.saveBuildOrders.mockClear();
  clipboard.writeText.mockClear();
});

/** The account signed in, holding `book`, or signed out. */
const account = (book: BuildOrderBook | null) =>
  useBuildOrderStore.setState(
    book
      ? { owner: "0xa1", status: "ready", book, revision: 3, error: null }
      : { owner: null, status: "signed-out", book: null, revision: 0, error: null },
  );

/** The panel's order, read where the panel reads it. */
let followed = "";
const Followed = () => {
  followed = useActiveBuildOrder().name;
  return null;
};

const open = () =>
  act(() =>
    root.render(
      <>
        <BuildOrderMaker />
        <Followed />
      </>,
    ),
  );
const button = (name: string) =>
  [...host.querySelectorAll("button")].find(
    (candidate) => candidate.getAttribute("aria-label") === name || candidate.textContent?.trim() === name,
  );
const press = async (name: string) => {
  const found = button(name);
  if (!found) throw new Error(`No button “${name}”`);
  await act(async () => found.click());
};
const type = (label: string, text: string) => {
  const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const rows = () => [...host.querySelectorAll(".ui-row")].map((row) => row.textContent ?? "");
const notices = () => [...host.querySelectorAll(".ui-notice")].map((notice) => notice.textContent ?? "");

describe("the build order maker", () => {
  it("makes an order from step cards and saves it on the account, where it becomes the one the panel follows", async () => {
    account({ orders: [], active: null });
    open();
    expect(followed).toBe("Default");
    await press("New order");
    type("Name", "Farm rush");
    await press("Farm");
    await press("Farm");
    await press("Level up");
    // A rank holds one level up: its card is offered no more.
    expect(button("Level up")?.disabled).toBe(true);
    await press("Save");

    const [[saved]] = service.saveBuildOrders.mock.calls;
    expect(saved).toMatchObject({ owner: "0xa1", revision: 3 });
    expect(saved.book).toMatchObject({
      orders: [
        {
          order: {
            name: "Farm rush",
            steps: [
              { rank: "Settlement", goal: "farm", count: 1 },
              { rank: "Settlement", goal: "farm", count: 2 },
              { rank: "Settlement", goal: "levelUp" },
            ],
          },
        },
      ],
    });
    expect(followed).toBe("Farm rush");
    expect(rows()[0]).toContain("Farm rush");
    expect(rows()[0]).toContain("Active");
  });

  it("follows another order with Use, the game's own included, and saves only which one", async () => {
    account({ orders: [{ id: "o1", order: COAL_RUSH }], active: "o1" });
    open();
    expect(followed).toBe("Coal rush");
    await press("Use");
    expect(service.saveBuildOrders.mock.calls[0][0].book).toMatchObject({ active: null });
    expect(followed).toBe("Default");
  });

  it("reads a pasted order with the language's own reader, saying in a player's words why one does not read", async () => {
    account({ orders: [], active: null });
    open();
    await press("Paste an order");
    type("Paste an order's JSON", '{"name":"Mine","steps":[{"rank":"City","goal":"mill","count":2}]}');
    await press("Read it");
    expect(notices()).toEqual([
      "Step 1: “mill” is not a goal: farm, wood, coal, copper, hut, barracks, army, levelUp.",
    ]);
    type("Paste an order's JSON", '{"name":"Mine","steps":[{"rank":"City","goal":"coal","count":2}]}');
    await press("Read it");
    // It opens as a new order on its first rank, to save.
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Name"]')?.value).toBe("Mine");
    expect(rows()).toEqual([expect.stringContaining("Coal mine")]);
  });

  it("copies an order as JSON that reads back, and a prompt for an AI with the language and the order", async () => {
    account({ orders: [{ id: "o1", order: COAL_RUSH }], active: "o1" });
    open();
    await press("Edit");
    await press("Copy JSON");
    expect(readBuildOrderText(clipboard.writeText.mock.calls[0][0])).toEqual({ ok: COAL_RUSH });
    await press("Get help from an AI");
    const prompt = clipboard.writeText.mock.calls[1][0];
    for (const goal of BUILD_ORDER_GOALS) expect(prompt).toContain(`- ${goal}: `);
    expect(prompt).toContain('"name": "Coal rush"');
    expect(notices()).toEqual([
      "Prompt copied: paste it into Claude or ChatGPT, then paste the JSON it answers with back here.",
    ]);
  });

  it("lets a signed-out player make and copy an order, but saves nothing: they follow the game's order", async () => {
    account(null);
    open();
    expect(notices()).toEqual(["Sign in to save your own orders; until then you follow the game's order."]);
    await press("New order");
    await press("Farm");
    expect(button("Save")?.disabled).toBe(true);
    expect(button("Copy JSON")?.disabled).toBe(false);
    expect(service.saveBuildOrders).not.toHaveBeenCalled();
  });
});
