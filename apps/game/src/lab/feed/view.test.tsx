// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";

import { STILLS } from "./stills";
import { FeedLabView } from "./view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const open = async (at: string) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[at]}>
        <FeedLabView />
      </MemoryRouter>,
    ),
  );
};
const stills = () => [...host.querySelectorAll("img")].map((image) => image.dataset.still);

it("shows an option as stills beside today's, desktop and phone, and the rail closed: no live frame", async () => {
  await open("/lab/feed?option=b");
  expect(stills()).toEqual(["today-desktop", "b-desktop", "today-phone", "b-phone", "a-desktop-closed"]);
  expect(host.querySelectorAll("canvas, iframe")).toHaveLength(0);
});

it("shows only the phone's stills when the Device switch asks for a phone", async () => {
  await open("/lab/feed?option=c&device=phone");
  expect(stills()).toEqual(["today-phone", "c-phone"]);
});

it("has a captured still for every still the page and the capture name", () => {
  for (const still of STILLS)
    expect(existsSync(join(process.cwd(), "asset-sources/lab/feed", `${still.name}.png`)), still.name).toBe(true);
});
