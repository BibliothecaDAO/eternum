// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { StructureEditPopup } from "./structure-edit-popup";

it("edits the structure's name and nothing else: no colour to pick", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const onConfirm = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <StructureEditPopup currentName="Egonal" originalName="Egonal" onConfirm={onConfirm} onCancel={() => {}} />,
    ),
  );
  expect(host.querySelector('input[aria-label="Structure name"]')).not.toBeNull();
  expect(host.textContent).not.toContain("Color");
  expect(host.querySelector('[aria-label="Structure color"]')).toBeNull();
  expect([...host.querySelectorAll("button")].map((button) => button.textContent?.trim())).toEqual(
    expect.arrayContaining(["Cancel", "Save Changes"]),
  );
  act(() => root.unmount());
  host.remove();
});
