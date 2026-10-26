// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";

import { LOOKS, PLACES, stillName } from "./stills";
import { TierIndicatorLabView } from "./view";

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
        <TierIndicatorLabView />
      </MemoryRouter>,
    ),
  );
};
const stills = () => [...host.querySelectorAll("img")].map((image) => image.dataset.still);

it("shows a draft beside today's pips at each place, desktop and phone, as stills: no live frame", async () => {
  await open("/lab/tier-indicator?draft=word");
  expect(stills()).toEqual([
    "research-pips-desktop",
    "research-word-desktop",
    "research-pips-phone",
    "research-word-phone",
    "build-pips-desktop",
    "build-word-desktop",
    "build-pips-phone",
    "build-word-phone",
    "army-pips-desktop",
    "army-word-desktop",
    "army-pips-phone",
    "army-word-phone",
  ]);
  expect(host.querySelectorAll("canvas, iframe")).toHaveLength(0);
});

it("shows only the phone's stills when the Device switch asks for a phone", async () => {
  await open("/lab/tier-indicator?draft=frame&device=phone");
  expect(stills()).toEqual([
    "research-pips-phone",
    "research-frame-phone",
    "build-pips-phone",
    "build-frame-phone",
    "army-pips-phone",
    "army-frame-phone",
  ]);
});

it("has every still it can show on disk", () => {
  const missing = PLACES.flatMap((place) =>
    LOOKS.flatMap((look) =>
      (["desktop", "phone"] as const)
        .map((device) => stillName(place, look, device))
        .filter((name) => !existsSync(join(__dirname, "../../../asset-sources/lab/tier-indicator", `${name}.webp`))),
    ),
  );
  expect(missing).toEqual([]);
});
