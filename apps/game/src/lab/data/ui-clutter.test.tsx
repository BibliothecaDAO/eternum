// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { CLUTTER_ADDRESS, UiClutterView } from "./ui-clutter";

const counts = (texts: number) => ({ texts, numbers: texts - 3, buttons: 4, icons: 5 });
const surface = (rank: number, id: string, mode: "frontier" | "blitz", sizes: string[]) => ({
  rank,
  id,
  mode,
  name: `${id} name`,
  where: `${id} where`,
  job: `${id} job.`,
  before: counts(19),
  after: counts(10),
  cuts: [{ what: `${id} figure`, action: "hover", why: `${id} why.` }],
  stills: sizes.map((size) => ({
    size,
    before: `mocks/${id}--${size}--before.png`,
    after: `mocks/${id}--${size}--after.png`,
  })),
});
const AUDIT = {
  title: "What a player sees, and what can go",
  captured: "PR #5094's tree.",
  method: "Count, then cut.",
  patterns: ["The same fact twice."],
  noted: ["Season panel: being reworked."],
  alsoFound: ["The castle writes labor per hour."],
  surfaces: [
    surface(1, "armies", "frontier", ["desktop"]),
    surface(2, "site-card", "frontier", ["desktop", "phone"]),
    surface(1, "automation", "blitz", ["desktop"]),
  ],
};

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const open = async (at: string, served: string) => {
  const fetched = vi.fn(async () => new Response(served, { status: 200 }));
  vi.stubGlobal("fetch", fetched);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[at]}>
        <UiClutterView />
      </MemoryRouter>,
    ),
  );
  return fetched;
};
const names = () => [...host.querySelectorAll(".ui-clutter-row h2")].map((row) => row.textContent);
const stills = () => [...host.querySelectorAll("img")].map((img) => img.getAttribute("src"));

it("lists Frontier's surfaces in rank, each with its job, its counts before and after, its cuts and its stills", async () => {
  const fetched = await open("/lab/data/clutter", JSON.stringify(AUDIT));
  expect(fetched).toHaveBeenCalledWith(`${CLUTTER_ADDRESS}/clutter.json`);
  expect(names()).toEqual(["1 armies namearmies where", "2 site-card namesite-card where"]);
  expect(host.textContent).toContain("Job: armies job.");
  expect(host.textContent).toContain("19 → 10 text runs · 16 → 7 figures · 4 → 4 buttons · 5 → 5 icons");
  expect(host.textContent).toContain("To hover or a held tap armies figure. armies why.");
  expect(stills()).toEqual([
    `${CLUTTER_ADDRESS}/mocks/armies--desktop--before.png`,
    `${CLUTTER_ADDRESS}/mocks/armies--desktop--after.png`,
    `${CLUTTER_ADDRESS}/mocks/site-card--desktop--before.png`,
    `${CLUTTER_ADDRESS}/mocks/site-card--desktop--after.png`,
    `${CLUTTER_ADDRESS}/mocks/site-card--phone--before.png`,
    `${CLUTTER_ADDRESS}/mocks/site-card--phone--after.png`,
  ]);
  expect(host.textContent).toContain("The castle writes labor per hour.");
  expect(host.textContent).toContain("Season panel: being reworked.");
});

it("shows Blitz's surfaces when Blitz is the game, and no live frame: stills only", async () => {
  await open("/lab/data/clutter?mode=blitz", JSON.stringify(AUDIT));
  expect(names()).toEqual(["1 automation nameautomation where"]);
  expect(host.querySelectorAll("canvas, iframe, video")).toHaveLength(0);
});

it("says where to link the audit when the server has none", async () => {
  await open("/lab/data/clutter", "<!doctype html>");
  expect(host.textContent).toContain("No clutter audit on this server");
});
