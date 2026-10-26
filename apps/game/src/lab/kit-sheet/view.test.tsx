// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { FrontierSheetView, SHEET_ADDRESS } from "./view";

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
  await act(async () => root.render(<FrontierSheetView />));
  return fetched;
};

it("shows the sheet the server has, read from its kit.json", async () => {
  const fetched = await open(JSON.stringify({ commit: "abc", panels: [{ title: "Chat", shots: [] }] }));
  expect(fetched).toHaveBeenCalledWith(`${SHEET_ADDRESS}/kit.json`);
  expect(host.querySelector("iframe")?.getAttribute("src")).toBe("/kit-sheet/index.html");
});

it("says how to write the sheet when the server has none (the dev server answers the app's page)", async () => {
  await open("<!doctype html><html></html>");
  expect(host.textContent).toContain("No Frontier sheet on this server");
  expect(host.querySelector("iframe")).toBeNull();
});
