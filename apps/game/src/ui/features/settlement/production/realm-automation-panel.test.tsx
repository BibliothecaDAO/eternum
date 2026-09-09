import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: {
    complexSystemResourceInputs: {},
    simpleSystemResourceInputs: {},
    complexSystemResourceOutput: {},
    simpleSystemResourceOutput: {},
  },
  aggregateConsumptionPerSecond: () => new Map(),
}));
vi.mock("@/ui/features/infrastructure/automation/model/automation-processor", () => ({ PROCESS_INTERVAL_MS: 1000 }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));
import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { RealmAutomationPanel } from "./realm-automation-panel";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  useAutomationStore.setState({ realms: {}, hydrated: true });
  useAutomationStore.getState().upsertRealm("5", { presetId: "smart" });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
it("shows sliders only when Custom is selected and saves through the existing store", async () => {
  await act(async () =>
    root.render(<RealmAutomationPanel realmEntityId="5" producedResources={[ResourcesIds.Wood]} />),
  );
  expect(container.querySelector('input[type="range"]')).toBeNull();
  const custom = [...container.querySelectorAll("button")].find((button) => button.textContent === "Custom")!;
  await act(async () => custom.click());
  expect(container.querySelectorAll('input[type="range"]').length).toBeGreaterThan(0);
  const save = [...container.querySelectorAll("button")].find((button) => button.textContent === "Save Changes")!;
  await act(async () => save.click());
  expect(useAutomationStore.getState().realms["5"].presetId).toBe("custom");
});
