import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
const mocks = vi.hoisted(() => ({ allowed: true, owner: 1n, labor: true }));
vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({ setup: { components: {} }, account: { account: { address: "0x1" } } }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  getRealmInfo: () => ({ owner: mocks.owner, entityId: 5 }),
  configManager: { isLaborProductionEnabled: () => mocks.labor },
}));
vi.mock("@dojoengine/react", () => ({ useComponentValue: () => undefined }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: (select: any) => select({}) }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => mocks.allowed }));
vi.mock("@/sync/game-scope", () => ({ gameEntityKey: () => "realm" }));
vi.mock("./production-controls", () => ({
  ProductionControls: ({ selectedResource, compact, realm }: any) => (
    <div data-resource={selectedResource} data-compact={compact} data-realm={realm.entityId} />
  ),
}));
import { InlineProduction } from "./inline-production";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(mocks, { allowed: true, owner: 1n, labor: true });
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = (resource: ResourcesIds) =>
  act(async () => root.render(<InlineProduction entityId={5} resource={resource} />));
it.each([ResourcesIds.Wood, ResourcesIds.Labor])(
  "renders resource %s through compact existing controls",
  async (resource) => {
    await render(resource);
    expect(container.firstElementChild?.getAttribute("data-resource")).toBe(String(resource));
    expect(container.firstElementChild?.getAttribute("data-compact")).toBe("true");
  },
);
it("explains unavailable labor", async () => {
  mocks.labor = false;
  await render(ResourcesIds.Labor);
  expect(container.textContent).toContain("Labor production is not available");
});
it.each(["spectator", "other owner"])("omits controls for %s", async (reason) => {
  if (reason === "spectator") mocks.allowed = false;
  else mocks.owner = 2n;
  await render(ResourcesIds.Wood);
  expect(container.childElementCount).toBe(0);
});
