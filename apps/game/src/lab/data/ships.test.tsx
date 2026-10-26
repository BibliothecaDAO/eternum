// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { SHIP_ADDRESS, ShipsView } from "./ships";

const PAGES = [
  {
    pr: 5094,
    title: "Frontier round 2",
    url: "https://github.com/x/pull/5094",
    page: "/ship/5094/",
    items: 18,
    joining: 6,
  },
  {
    pr: 5090,
    title: "Frontier round 1",
    url: "https://github.com/x/pull/5090",
    page: "/ship/5090/",
    items: 9,
    joining: 0,
  },
];

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const open = async (served: string) => {
  const fetched = vi.fn(async () => new Response(served, { status: 200 }));
  vi.stubGlobal("fetch", fetched);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<ShipsView />));
  return fetched;
};

it("links each PR's ship page from the server's list, with how many items join it later", async () => {
  const fetched = await open(JSON.stringify(PAGES));
  expect(fetched).toHaveBeenCalledWith(`${SHIP_ADDRESS}/index.json`);
  const links = [...host.querySelectorAll(".ship-list li")].map((row) => ({
    text: row.textContent,
    href: row.querySelector("a")!.getAttribute("href"),
  }));
  expect(links).toEqual([
    { text: "PR #5094: Frontier round 2 · 18 items, 6 joining", href: "/ship/5094/index.html" },
    { text: "PR #5090: Frontier round 1 · 9 items", href: "/ship/5090/index.html" },
  ]);
});

it("says how to serve the pages when the server has none (the dev server answers the app's page)", async () => {
  await open("<!doctype html><html></html>");
  expect(host.textContent).toContain("No ship pages on this server");
  expect(host.querySelector(".ship-list")).toBeNull();
});
