import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ form: {} as any, close: vi.fn() }));
vi.mock("./use-plot-construction", () => ({ usePlotConstruction: () => mocks.form }));
vi.mock("@/hooks/store/use-popover-store", () => ({ usePopoverStore: { getState: () => ({ close: mocks.close }) } }));
import { PlotConstructionPicker } from "./plot-construction-picker";
let root: Root;
let container: HTMLDivElement;
const render = () =>
  act(async () =>
    root.render(
      <PlotConstructionPicker
        entityId={1}
        spot={{ col: 1, row: 1 }}
        tileManager={{} as any}
        isCurrentTarget={() => true}
      />,
    ),
  );
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.form = {
    visible: true,
    useSimpleCost: true,
    setUseSimpleCost: vi.fn(),
    build: vi.fn(),
    groups: [
      {
        label: "Economic",
        buildings: [
          { type: 1, label: "Farm", costs: [{ resource: 1, amount: 10 }], disabled: false },
          {
            type: 2,
            label: "Fishing Village",
            costs: [{ resource: 1, amount: 20 }],
            disabled: true,
            reason: "Insufficient resources to build.",
          },
        ],
      },
    ],
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
it("builds from one tile click and exposes blocked costs and reasons before clicking", async () => {
  await render();
  const buttons = container.querySelectorAll("button");
  expect(buttons[1].disabled).toBe(true);
  expect(buttons[1].textContent).toContain("20");
  expect(buttons[1].title).toBe("Insufficient resources to build.");
  expect(buttons[0].querySelectorAll("img")).toHaveLength(2);
  await act(async () => {
    buttons[1].click();
    buttons[0].click();
  });
  expect(mocks.form.build).toHaveBeenCalledTimes(1);
  expect(mocks.form.build).toHaveBeenCalledWith(1);
});
it("switches the shared cost preference", async () => {
  await render();
  await act(async () => (container.querySelector('[role="switch"]') as HTMLInputElement).click());
  expect(mocks.form.setUseSimpleCost).toHaveBeenCalledWith(false);
});
it("closes when order permission or ownership is lost", async () => {
  mocks.form.visible = false;
  await render();
  expect(container.textContent).toBe("");
  expect(mocks.close).toHaveBeenCalledWith("plot-construction");
});

it("sorts buildable tiles before blocked tiles within each group", async () => {
  mocks.form.groups[0].buildings.reverse();
  await render();
  expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Farm");
});
