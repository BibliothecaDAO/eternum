import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, expect, it } from "vitest";

import { useDesktopKeys } from "./desktop-keys";
import { StepVerb } from "./step-verb";

const PLACES = ["/", "/season", "/learn", "/profile"];

const Page = ({ back }: { back?: string }) => {
  useDesktopKeys({ places: PLACES, back });
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="where">{pathname}</p>
      <input aria-label="field" />
      <button type="button">Other</button>
      <StepVerb>
        <button type="button" onClick={() => navigate("/g/step")}>
          Resume
        </button>
      </StepVerb>
    </>
  );
};

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  document.body.replaceChildren();
});

const mount = async (path: string, back?: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<Page back={back} />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return {
    where: () => container.querySelector('[data-testid="where"]')!.textContent,
    press: (key: string, target: EventTarget = window) =>
      act(async () => void target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))),
    field: () => container.querySelector("input")!,
    other: () => container.querySelector("button")!,
  };
};

it("opens the places with 1 to 4 and leads Back with Esc", async () => {
  const page = await mount("/blitz/x", "/blitz");
  await page.press("2");
  expect(page.where()).toBe("/season");
  await page.press("Escape");
  expect(page.where()).toBe("/blitz");
});

it("leaves Esc to an open sheet and keys typed in a field to the field", async () => {
  const page = await mount("/blitz/x", "/blitz");
  const sheet = document.createElement("div");
  sheet.setAttribute("role", "dialog");
  document.body.append(sheet);
  await page.press("Escape");
  expect(page.where()).toBe("/blitz/x");
  sheet.remove();
  await page.press("3", page.field());
  expect(page.where()).toBe("/blitz/x");
});

it("takes the screen's step with Enter, unless another control holds the focus", async () => {
  const page = await mount("/");
  await page.press("Enter", page.other());
  expect(page.where()).toBe("/");
  await page.press("Enter");
  expect(page.where()).toBe("/g/step");
});
