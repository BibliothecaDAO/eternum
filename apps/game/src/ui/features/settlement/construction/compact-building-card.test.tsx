import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CompactBuildingCard } from "./compact-building-card";

vi.mock("@/ui/design-system/molecules/requirement-chips", () => ({
  RequirementChips: () => <span>100 owned / 200 needed</span>,
}));

let root: Root;
let container: HTMLDivElement;
const build = vi.fn();
const destroy = vi.fn();
const pause = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const render = async (props: Partial<ComponentProps<typeof CompactBuildingCard>> = {}) => {
  await act(async () =>
    root.render(
      <CompactBuildingCard
        name="Farm"
        image="farm.png"
        count={2}
        requirements={[]}
        details={<p>Produces wheat</p>}
        active={false}
        build={{ onClick: build }}
        production={{ onClick: pause }}
        destroy={{ onClick: destroy }}
        {...props}
      />,
    ),
  );
};
const button = (label: string) => [...container.querySelectorAll("button")].find((item) => item.textContent === label)!;

it("shows costs and a disabled reason without hiding existing-building management", async () => {
  await render({ build: { onClick: build, disabled: true }, disabledReason: "Not enough wood" });
  expect(container.textContent).toContain("100 owned / 200 needed");
  expect(container.textContent).toContain("Not enough wood");
  expect(button("Build").disabled).toBe(true);
  expect(button("Pause all").disabled).toBe(false);
  await act(async () => button("Pause all").click());
  expect(pause).toHaveBeenCalledOnce();
  expect(build).not.toHaveBeenCalled();
});

it("requires a deliberate second action to destroy and supports cancelling", async () => {
  await render();
  await act(async () => button("Destroy one").click());
  expect(destroy).not.toHaveBeenCalled();
  await act(async () => button("Cancel").click());
  expect(button("Destroy one")).toBeDefined();
  await act(async () => button("Destroy one").click());
  await act(async () => button("Confirm destroy one").click());
  expect(destroy).toHaveBeenCalledOnce();
});

it("disables a pending build and only offers map placement when available", async () => {
  await render({ build: { onClick: build, pending: true } });
  expect(button("Building…").disabled).toBe(true);
  expect(button("Place on map")).toBeUndefined();
  await act(async () => button("Building…").click());
  expect(build).not.toHaveBeenCalled();
});
