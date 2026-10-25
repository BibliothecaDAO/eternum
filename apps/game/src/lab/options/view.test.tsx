// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it } from "vitest";

import { INVENTORY } from "./inventory";
import { LabOptionsView } from "./view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let host: HTMLDivElement;
const Address = () => {
  const location = useLocation();
  return <output data-address={`${location.pathname}${location.search}`} />;
};
const address = () => host.querySelector("output[data-address]")!.getAttribute("data-address");
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
        <Routes>
          <Route
            path="/lab/options"
            element={
              <>
                <LabOptionsView />
                <Address />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    ),
  );
};
const press = async (name: string, within: ParentNode = host) => {
  const button = [...within.querySelectorAll("button")].find((one) => one.textContent?.trim().startsWith(name));
  expect(button, name).toBeDefined();
  await act(async () => button!.click());
};
const rooms = () => [...host.querySelectorAll('nav[aria-label="Rooms"] button')].map((one) => one.textContent);

it("draws each structure's rooms, Decide first in B, with its open questions counted", async () => {
  await open("/lab/options");
  expect(rooms()).toEqual(["Decide4", "Kit", "HUD", "World", "Data", "Studio"]);
  await press("A · Six rooms");
  expect(rooms()).toEqual(["Kit", "HUD●", "Game●", "Art", "Data●", "Studio"]);
  await press("C · Three floors");
  expect(rooms()).toEqual(["Interface●", "World●", "Data●"]);
});

it("opens Balance & data in the chosen structure, for the game switched to, and keeps it all in the address", async () => {
  await open("/lab/options?option=b");
  await press("Data", host.querySelector('nav[aria-label="Rooms"]')!);
  expect(host.textContent).toContain("Balance & data · Frontier");
  expect(host.textContent).toContain("S1 · Cut storage research");
  await press("Blitz", host.querySelector('[aria-label="Game"]')!);
  expect(host.textContent).toContain("Balance & data · Blitz");
  expect(host.textContent).toContain("13 / 69");
  expect(host.textContent).not.toContain("S1 · Cut storage research");
  expect(address()).toBe("/lab/options?option=b&room=Data&page=Balance+%26+data&mode=blitz&device=both");
});

it("opens a page that draws Frontier on Frontier, the game being played", async () => {
  await open("/lab/options?option=b&room=Data");
  expect(host.textContent).toContain("Balance & data · Frontier");
});

it("opens a page that does not draw Frontier on its own game", async () => {
  await open("/lab/options?option=b&room=Studio&page=Footage");
  expect(host.textContent).toContain("Footage · Blitz");
});

it("offers only the games a page draws, and the device only where there is one", async () => {
  await open("/lab/options?option=b&room=World&page=Day+end&mode=blitz");
  expect([...host.querySelectorAll('[aria-label="Game"] button')].map((one) => one.textContent)).toEqual(["Frontier"]);
  expect(host.querySelector('[aria-label="Device"]')).toBeNull();
  await press("Kit", host.querySelector('nav[aria-label="Rooms"]')!);
  expect(host.querySelector('[aria-label="Device"]')).not.toBeNull();
});

it("lists today's lab page by page, and the pages it lost", async () => {
  await open("/lab/options?option=inventory");
  expect(host.querySelectorAll("tbody tr")).toHaveLength(INVENTORY.length);
  await press("Lost");
  expect([...host.querySelectorAll("tbody tr td:nth-child(2)")].map((cell) => cell.textContent)).toEqual([
    "Desktop options",
    "Phone options",
  ]);
});
