import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: (select: any) => select({}) }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => mocks.allowed }));
vi.mock("@/utils/automation-presets", () => ({ inferRealmPreset: (realm: any) => realm?.presetId ?? "smart" }));
import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { AutomationPresetSwitch } from "./automation-preset-switch";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.allowed = true;
  useAutomationStore.setState({ realms: {}, hydrated: true });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = () => act(async () => root.render(<AutomationPresetSwitch entityId={5} entityType="village" />));
it("creates only the selected realm and writes the same preset the sliders use", async () => {
  await render();
  const buttons = container.querySelectorAll("button");
  expect([...buttons].map((button) => button.textContent)).toEqual(["Smart", "Idle", "Custom"]);
  await act(async () => buttons[1].click());
  expect(useAutomationStore.getState().realms["5"]).toMatchObject({ presetId: "idle", entityType: "village" });
  await act(async () => buttons[2].click());
  expect(useAutomationStore.getState().realms["5"].presetId).toBe("custom");
  expect(Object.keys(useAutomationStore.getState().realms)).toEqual(["5"]);
  expect(buttons[2].getAttribute("aria-pressed")).toBe("true");
});
it("disables writes in spectator mode", async () => {
  mocks.allowed = false;
  await render();
  expect([...container.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
});
