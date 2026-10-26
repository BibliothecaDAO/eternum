// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { FeedDrawView } from "./draw";
import { RECORDED_FEED } from "./recorded-feed";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const NAMES = Object.values(RECORDED_FEED.names);

/** One still's frame at its address, once every player's name has come back (the capture's own wait). */
const draw = async (query: string) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[`/lab/feed/draw?${query}`]}>
        <Routes>
          <Route path="/lab/feed/draw" element={<FeedDrawView />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  await vi.waitFor(() => expect(host.querySelector('[data-still="ready"]')).not.toBeNull());
};

it("leads every row of option A's frame with the name of the player who acted", async () => {
  await draw("frame=a&device=desktop");
  const rows = [...host.querySelectorAll(".ui-event__text")];
  expect(rows.length).toBeGreaterThan(300);
  for (const row of rows) expect(NAMES).toContain(row.querySelector("strong")?.textContent);
});

it("opens every frame two stories before the first reward under one: today shows its 54 '+<1', an option none", async () => {
  await draw("frame=today&device=desktop");
  expect(host.textContent!.match(/\+<1/g)).toHaveLength(54);
  expect(host.querySelectorAll(".ui-event__text")[2]!.textContent).toMatch(/: \+<1 /);
  await act(async () => root.unmount());
  host.remove();
  await draw("frame=b&device=desktop");
  expect(host.textContent).not.toContain("<1");
});

it("draws an option's rail closed: Next up and chat, no Feed, its bubble unlit", async () => {
  await draw("frame=a&device=desktop&closed=1");
  expect(host.querySelector('[aria-label="Close the feed"]')).toBeNull();
  expect(host.textContent).toContain("Next up");
  expect(host.textContent).not.toContain("Krump");
  expect(host.querySelector('button[aria-label="Feed"]')!.getAttribute("aria-pressed")).toBe("false");
});

it("names the phone's place the Feed in every option, where today's says Log", async () => {
  await draw("frame=c&device=phone");
  expect(host.querySelector("[data-phone]")).not.toBeNull();
  expect(host.querySelector('[aria-label="Phone places"] button')!.getAttribute("aria-label")).toBe("Feed");
  expect(host.querySelectorAll("[data-feed-run]").length).toBeGreaterThan(40);
  await act(async () => root.unmount());
  host.remove();
  await draw("frame=today&device=phone");
  expect(host.querySelector('[aria-label="Phone places"] button')!.getAttribute("aria-label")).toBe("Log");
});
