// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";

import { LOOKS, stillName, STEPS } from "./stills";
import { BuildPanelLabView } from "./view";

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
        <BuildPanelLabView />
      </MemoryRouter>,
    ),
  );
};
const stills = () => [...host.querySelectorAll("img")].map((image) => image.dataset.still);

it("shows a draft beside today's, before and after Build, desktop and phone, as stills: no live frame", async () => {
  await open("/lab/build-panel?draft=a");
  expect(stills()).toEqual([
    "today-desktop-entry",
    "a-desktop-entry",
    "today-desktop-open",
    "a-desktop-open",
    "today-phone-entry",
    "a-phone-entry",
    "today-phone-open",
    "a-phone-open",
  ]);
  expect(host.querySelectorAll("canvas, iframe")).toHaveLength(0);
});

it("opens on B, and shows only the phone's stills when the Device switch asks for a phone", async () => {
  await open("/lab/build-panel?device=phone");
  expect(stills()).toEqual(["today-phone-entry", "b-phone-entry", "today-phone-open", "b-phone-open"]);
});

it("has every still it can show on disk", () => {
  const missing = LOOKS.flatMap((look) =>
    (["desktop", "phone"] as const).flatMap((device) =>
      STEPS.map((step) => stillName(look, device, step)).filter(
        (name) => !existsSync(join(__dirname, "../../../asset-sources/lab/build-panel", `${name}.webp`)),
      ),
    ),
  );
  expect(missing).toEqual([]);
});
