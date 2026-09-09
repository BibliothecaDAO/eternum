import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
const mocks = vi.hoisted(() => ({
  allowed: true,
  balance: 100,
  raw: vi.fn(),
  labor: vi.fn(),
  amount: 10,
  rawMode: true,
  setRaw: vi.fn(),
  setAmount: vi.fn(),
}));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: (select: any) => select({}) }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => mocks.allowed }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 1 }));
vi.mock("@/sync/game-scope", () => ({ gameEntityKey: () => "realm" }));
vi.mock("@dojoengine/react", () => ({ useComponentValue: () => undefined }));
vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    setup: {
      account: { account: { address: "0x1" } },
      components: {},
      systemCalls: {
        burn_resource_for_resource_production: mocks.raw,
        burn_labor_for_resource_production: mocks.labor,
      },
    },
  }),
  useResourceManager: () => ({ balanceWithProduction: () => ({ balance: mocks.balance }) }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    getLaborConfig: () => ({
      resourceOutputPerInputResources: 2,
      laborBurnPerResourceOutput: 1,
      inputResources: [{ resource: 1, amount: 2 }],
    }),
    complexSystemResourceOutput: { 1: { amount: 2 } },
    complexSystemResourceInputs: { 1: [{ resource: 2, amount: 2 }] },
  },
  divideByPrecision: (n: number) => n,
  getBuildingQuantity: () => 1,
  formatTime: () => "5s",
}));
vi.mock("@/ui/design-system/atoms", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  NumberInput: ({ value, onChange }: any) => (
    <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
  ),
  Tabs: () => null,
}));
vi.mock("@/ui/design-system/molecules", () => ({ ResourceIcon: () => null }));
vi.mock("./labor-resources-panel", () => ({ LaborResourcesPanel: () => null }));
vi.mock("./raw-resources-panel", () => ({ RawResourcesPanel: () => null }));
import { ResourceProductionControls } from "./resource-production-controls";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  Object.assign(mocks, { allowed: true, balance: 100, amount: 10, rawMode: true });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = () =>
  act(async () =>
    root.render(
      <ResourceProductionControls
        compact
        selectedResource={1}
        realm={{ entityId: 5 } as any}
        useRawResources={mocks.rawMode}
        setUseRawResources={mocks.setRaw}
        productionAmount={mocks.amount}
        setProductionAmount={mocks.setAmount}
        ticks={5}
        setTicks={() => {}}
        bonus={1}
      />,
    ),
  );
it("shows recipe choices and submits the existing production call", async () => {
  await render();
  const buttons = container.querySelectorAll("button");
  expect([...buttons].map((button) => button.textContent)).toEqual(["Resources", "Labor", "Start Production"]);
  await act(async () => buttons[1].click());
  expect(mocks.setRaw).toHaveBeenCalledWith(false);
  await act(async () => buttons[2].click());
  expect(mocks.raw).toHaveBeenCalledWith({
    from_entity_id: 5,
    produced_resource_types: [1],
    production_cycles: [5],
    signer: { address: "0x1" },
  });
});
it("shows an inline blocker before an unaffordable click", async () => {
  mocks.balance = 0;
  await render();
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Not enough resources.");
  expect(container.querySelectorAll("button")[2].disabled).toBe(true);
});
it("guards a submit when spectator intent changes after render", async () => {
  await render();
  mocks.allowed = false;
  await act(async () => container.querySelectorAll("button")[2].click());
  expect(mocks.raw).not.toHaveBeenCalled();
});
