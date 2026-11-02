import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, expect, it } from "vitest";

import { AppButton } from "@/ui/design-system/kit/app-elements";

import { useDesktopKeys } from "./desktop-keys";

const Page = () => {
  useDesktopKeys();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="where">{pathname}</p>
      <input aria-label="field" />
      <button type="button">Other</button>
      <AppButton kind="primary" step onClick={() => navigate("/g/step")}>
        Resume
      </AppButton>
    </>
  );
};

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  document.body.replaceChildren();
});

const mount = async (path: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<Page />} />
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

it("leads nowhere with Esc on a page, which has no Back, nor with a number (no key is shown beside a place)", async () => {
  const page = await mount("/blitz/x");
  await page.press("2");
  await page.press("Escape");
  expect(page.where()).toBe("/blitz/x");
});

it("leaves Enter to an open sheet and keys typed in a field to the field", async () => {
  const page = await mount("/");
  const sheet = document.createElement("div");
  sheet.setAttribute("role", "dialog");
  document.body.append(sheet);
  await page.press("Enter");
  expect(page.where()).toBe("/");
  sheet.remove();
  await page.press("Enter", page.field());
  expect(page.where()).toBe("/");
});

it("takes the screen's step with Enter, unless another control holds the focus", async () => {
  const page = await mount("/");
  await page.press("Enter", page.other());
  expect(page.where()).toBe("/");
  await page.press("Enter");
  expect(page.where()).toBe("/g/step");
});
