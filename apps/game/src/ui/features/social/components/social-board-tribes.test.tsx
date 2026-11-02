// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));

import { setViewportWidth } from "@/shell/frame/test-viewport";
import { useSocialStore } from "./use-social-store";
import { StandingsLab } from "@/ui/features/debug/kit-lab/standings-lab";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useSocialStore.setState({ selectedTab: 0, isExpanded: false, selectedPlayer: 0n, selectedGuild: 0n } as never);
});

const press = async (words: string) => {
  const control = [...host.querySelectorAll<HTMLElement>("button, [role=tab]")].find(
    (each) => each.textContent?.trim() === words || each.getAttribute("aria-label") === words,
  );
  if (!control) throw new Error(`No control “${words}”`);
  await act(async () => control.click());
};
/** The tribe's members, each a row that opens the member's card (their names wait on identity, which answers nothing here). */
const members = () => [...host.querySelectorAll<HTMLButtonElement>(".ui-pick > button")];
const membersShown = () => members().length === 3;
const openMember = (index: number) => act(async () => members()[index]!.click());
const cardShown = () => host.querySelector('[aria-label="Player details"]') !== null;

/** An Eternum game's standings, on the lab's game: one tribe, Ironwood, of Lord 0222 (its chief), 0333 and 0444. */
const open = async (width: number) => {
  setViewportWidth(width);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <StandingsLab />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  for (let tick = 0; tick < 20 && !host.querySelector("[role=tab]"); tick += 1)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
};

describe("a tribe member's card has no Back (review-no-back-2)", () => {
  it("on a phone stands in the list's place, and the lit Tribes tab steps back to the tribe's members", async () => {
    await open(390);
    await press("Tribes");
    await press("Ironwood: its members");
    expect(membersShown()).toBe(true);
    // The tribe's list gives the window to its members: nothing stands beside them on a phone.
    expect(host.querySelector('[aria-label="Ironwood: its members"]')).toBeNull();
    await openMember(1);
    expect(cardShown()).toBe(true);
    expect(host.querySelector('[aria-label="Back"]')).toBeNull();
    await press("Tribes");
    expect(cardShown()).toBe(false);
    expect(membersShown()).toBe(true);
    // Pressed once more, the lit tab steps back to the tribes' list.
    await press("Tribes");
    expect(host.querySelector('[aria-label="Ironwood: its members"]')).not.toBeNull();
  });

  it("on a desktop stands beside the list, and the chosen tribe pressed again shows its members", async () => {
    await open(1440);
    await press("Tribes");
    await press("Ironwood: its members");
    await openMember(1);
    expect(cardShown()).toBe(true);
    await press("Ironwood: its members");
    expect(cardShown()).toBe(false);
    expect(membersShown()).toBe(true);
  });
});
