// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { RECORDED_FEED } from "./recorded-feed";
import { FeedLabView } from "./view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const NAMES = Object.values(RECORDED_FEED.names);

/** The page at an address, once the recorded players' names have come back from the identity answer. */
const open = async (at: string) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/lab/feed" element={<FeedLabView />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  await vi.waitFor(() => expect(host.textContent).toContain("Krump"));
};
const optionRail = () => host.querySelector<HTMLElement>('[data-rail="option"]')!;
const press = async (control: HTMLElement) => act(async () => control.click());

it("leads every row of option A with the name of the player who acted", async () => {
  await open("/lab/feed?option=a");
  const rows = [...optionRail().querySelectorAll(".ui-event__text")];
  expect(rows).toHaveLength(345);
  for (const row of rows) expect(NAMES).toContain(row.querySelector("strong")?.textContent);
});

it("shows no '<1' reward in any option, where today's Feed shows 54", async () => {
  await open("/lab/feed?option=b");
  const today = host.querySelector('[data-rail="today"]')!.textContent!;
  expect(today.match(/\+<1/g)).toHaveLength(54);
  expect(optionRail().textContent).not.toContain("<1");
  expect(optionRail().querySelectorAll("[data-feed-row]")).toHaveLength(345);
});

it("closes the option's Feed with its ×, leaves the rail empty, and opens it again from the Feed bubble", async () => {
  await open("/lab/feed?option=c");
  expect(optionRail().querySelectorAll("[data-feed-run]")).toHaveLength(53);
  await press(optionRail().querySelector<HTMLElement>('button[aria-label="Close the feed"]')!);
  expect(optionRail().dataset.feedOpen).toBe("false");
  expect(optionRail().textContent).not.toContain("Krump");
  await press(optionRail().parentElement!.querySelector<HTMLElement>('button[aria-label="Feed"]')!);
  expect(optionRail().dataset.feedOpen).toBe("true");
});

it("fills the rail with the option's Feed; today's keeps its cap and has no ×", async () => {
  await open("/lab/feed?option=a");
  const today = host.querySelector('[data-rail="today"]')!;
  expect(today.querySelector('button[aria-label="Close the feed"]')).toBeNull();
  expect(today.querySelector(".max-h-\\[405px\\]")).not.toBeNull();
  expect(optionRail().querySelector(".flex-1 .overflow-y-auto, .overflow-y-auto.flex-1")).not.toBeNull();
});

it("draws the phone alone when the Device switch asks for a phone", async () => {
  await open("/lab/feed?option=b&device=phone");
  expect(host.querySelectorAll("[data-rail]")).toHaveLength(0);
  expect(host.querySelectorAll("[data-phone]")).toHaveLength(1);
  expect(host.querySelector("[data-phone]")!.querySelectorAll("[data-feed-row]")).toHaveLength(345);
});
