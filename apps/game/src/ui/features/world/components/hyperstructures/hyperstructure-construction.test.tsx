// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { HyperstructureConstruction } from "./hyperstructure-construction";

const state = vi.hoisted(() => ({
  owner: 1n,
  stage: "Construction",
  access: "Private",
  inventory: true,
  captured: false,
  balance: 8_000_000_000n,
  contributed: 0n,
  guilds: new Map<bigint, bigint>(),
  calls: {
    initialize_hyperstructure: vi.fn(),
    contribute_to_construction: vi.fn(),
    set_access: vi.fn(),
  },
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@bibliothecadao/react", () => ({
  useGame: () => ({
    setup: {
      store: {
        structuresOwnedBy: () =>
          state.captured
            ? [{ entity_id: 3, owner: 1n }]
            : [
                { entity_id: 3, owner: 1n },
                { entity_id: 4, owner: 1n },
              ],
        get: (model: string, keys: { actor: bigint }) =>
          model === "GuildMember" ? { guild_id: state.guilds.get(keys.actor) } : { contributed: state.contributed },
      },
      systemCalls: state.calls,
    },
    account: { account: { address: "0x1" } },
  }),
  useNativeRevision: () => 0,
  useNativeRow: (model: string) => {
    if (model === "Structure") return { owner: state.owner };
    if (model === "Hyperstructure") return { stage: state.stage, access: state.access };
    if (model === "HyperstructureRules") return { initialize_shards: 2_000_000_000n };
  },
}));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: { getActiveGameId: () => 7 },
  getHyperstructureTotalContributableAmounts: () => [{ resource: 1, amount: 10 }],
  ResourceManager: class {
    current() {
      return state.inventory ? { balance: state.balance } : undefined;
    }
    balanceWithProduction() {
      return { amountProducedLimited: 1_000_000_000n };
    }
  },
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 10 }));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("@/ui/design-system/atoms/button", () => ({
  default: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}));

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  state.owner = 1n;
  state.stage = "Construction";
  state.access = "Private";
  state.inventory = true;
  state.captured = false;
  state.balance = 8_000_000_000n;
  state.contributed = 0n;
  state.guilds.clear();
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = () => act(async () => root.render(<HyperstructureConstruction entityId={9} />));
const button = (name: string) => [...container.querySelectorAll("button")].find((node) => node.textContent === name)!;
const input = () => container.querySelector<HTMLInputElement>(`[aria-label="${ResourcesIds[1]} contribution"]`)!;
const amount = (value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });

it("starts construction only for the synchronized owner", async () => {
  state.stage = "Foundation";
  await render();
  await act(async () => button("Start construction").click());
  expect(state.calls.initialize_hyperstructure).toHaveBeenCalledWith({
    signer: { address: "0x1" },
    hyperstructure_id: 9,
  });
  state.owner = 2n;
  await render();
  expect(container.querySelector("button")).toBeNull();
});

it("contributes exact fractional units from the selected owned source", async () => {
  await render();
  await act(async () => {
    const source = container.querySelector<HTMLSelectElement>('[aria-label="Construction source"]')!;
    source.value = "4";
    source.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await amount("1.000000001");
  await act(async () => button("Contribute resources").click());
  expect(state.calls.contribute_to_construction).toHaveBeenCalledWith({
    signer: { address: "0x1" },
    hyperstructure_entity_id: 9,
    contributor_entity_id: 4,
    contributions: [{ resource: 1, amount: BigInt(RESOURCE_PRECISION) + 1n }],
  });
});

it("blocks contributions above inventory, malformed amounts and unsynchronized inventory", async () => {
  await render();
  for (const value of ["9.000000001", "11", "-1", "1e3", "0", "1.0000000001"]) {
    await amount(value);
    expect(button("Contribute resources").disabled).toBe(true);
  }
  await amount("9");
  expect(button("Contribute resources").disabled).toBe(false);
  state.inventory = false;
  await render();
  expect(input().disabled).toBe(true);
  expect(button("Contribute resources").disabled).toBe(true);
  expect(state.calls.contribute_to_construction).not.toHaveBeenCalled();
});

it("honors public, private and same-guild contribution access", async () => {
  state.owner = 2n;
  await render();
  expect(container.querySelector("input")).toBeNull();
  state.access = "Public";
  await render();
  expect(input()).not.toBeNull();
  state.access = "GuildOnly";
  state.guilds.set(1n, 7n);
  state.guilds.set(2n, 8n);
  await render();
  expect(container.querySelector("input")).toBeNull();
  state.guilds.set(2n, 7n);
  await render();
  expect(input()).not.toBeNull();
  expect(container.querySelector('[aria-label="Construction access"]')).toBeNull();
});

it("limits contributions to the remaining requirement after another player's contribution", async () => {
  state.balance = 20_000_000_000n;
  state.contributed = 7_500_000_000n;
  await render();
  await amount("2.5");
  expect(button("Contribute resources").disabled).toBe(false);
  await amount("2.500000001");
  expect(button("Contribute resources").disabled).toBe(true);
});

it("does not silently spend from another structure when the selected source is captured", async () => {
  await render();
  await act(async () => {
    const source = container.querySelector<HTMLSelectElement>('[aria-label="Construction source"]')!;
    source.value = "4";
    source.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await amount("2");
  state.captured = true;
  await render();
  expect(container.querySelector('[aria-label="Construction source"]')?.textContent).toContain(
    "Select an owned structure",
  );
  expect(container.querySelector("input")).toBeNull();
  expect(button("Contribute resources")).toBeUndefined();
  expect(state.calls.contribute_to_construction).not.toHaveBeenCalled();
});

it("changes access through the authenticated command and keeps failed state authoritative", async () => {
  await render();
  state.calls.set_access.mockRejectedValueOnce(new Error("game ended"));
  await act(async () => {
    const access = container.querySelector<HTMLSelectElement>('[aria-label="Construction access"]')!;
    access.value = "0";
    access.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(state.calls.set_access).toHaveBeenCalledWith({
    signer: { address: "0x1" },
    hyperstructure_entity_id: 9,
    access: 0,
  });
  expect(state.error).toHaveBeenCalledWith("game ended");
  expect(state.success).not.toHaveBeenCalled();
  expect(container.querySelector<HTMLSelectElement>('[aria-label="Construction access"]')!.value).toBe("1");
});

it("removes construction controls once the synchronized stage is complete", async () => {
  state.stage = "Complete";
  await render();
  expect(container.innerHTML).toBe("");
});
