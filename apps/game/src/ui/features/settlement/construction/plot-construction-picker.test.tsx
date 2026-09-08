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
          { type: 1, label: "Farm", cost: "10 Labor", disabled: false },
          {
            type: 2,
            label: "Fishing Village",
            cost: "20 Labor",
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
it("builds from one chip click and shows blocked costs and reasons before clicking", async () => {
  await render();
  const buttons = container.querySelectorAll("button");
  expect(buttons[1].disabled).toBe(true);
  expect(buttons[1].textContent).toContain("20 LaborInsufficient resources to build.");
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
