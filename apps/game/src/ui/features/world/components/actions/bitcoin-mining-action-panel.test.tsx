// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BitcoinMiningActionPanel } from "./bitcoin-mining-action-panel";

const state = vi.hoisted(() => ({
  owner: 1n,
  mine: undefined as undefined | { next_phase: bigint },
  phase: undefined as undefined | { state: string; total_labor: bigint },
  calls: {
    bitcoin_mine_contribute_labor: vi.fn(),
    bitcoin_mine_close_phase: vi.fn(),
    bitcoin_mine_bind_phase: vi.fn(),
    bitcoin_mine_claim_phase_reward: vi.fn(),
  },
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@bibliothecadao/react", () => ({
  useGame: () => ({
    setup: { store: { require: () => state.phase }, systemCalls: state.calls },
    account: { account: { address: "0x1" } },
  }),
  useNativeRevision: () => 0,
  useNativeRow: (model: string) => {
    if (model === "Structure") return { owner: state.owner };
    if (model === "SliceRules")
      return {
        bitcoin_mine_config: { enabled: true, min_labor_per_contribution: 1n },
        tick_config: { bitcoin_phase_in_seconds: 60n },
      };
    if (model === "BitcoinMine") return state.mine;
    if (model === "BitcoinPhase") return state.phase;
  },
}));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: { getActiveGameId: () => 7 },
  ResourceManager: class {
    current() {
      return { balance: 100_000000000n };
    }
    balanceWithProduction() {
      return { amountProducedLimited: 0n };
    }
  },
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentBlockTimestamp: () => 600,
  useCurrentDefaultTick: () => 10,
}));
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
  state.mine = undefined;
  state.phase = undefined;
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
});
const render = () => act(async () => root.render(<BitcoinMiningActionPanel structureEntityId={9} />));
const click = () => act(async () => container.querySelector("button")!.click());

it("contributes from an owned realm without owning a mine", async () => {
  await render();
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "12");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click();
  expect(state.calls.bitcoin_mine_contribute_labor).toHaveBeenCalledWith({
    signer: { address: "0x1" },
    structure_id: 9,
    labor_amount: 12_000000000n,
  });
  expect(state.calls.bitcoin_mine_bind_phase).not.toHaveBeenCalled();
});

it("allows a non-owner to close, bind and settle a mine in order", async () => {
  state.owner = 2n;
  state.mine = { next_phase: 9n };
  const steps: string[] = [];
  state.calls.bitcoin_mine_close_phase.mockImplementation(async () => {
    steps.push("close");
    state.phase = { state: "Closed", total_labor: 12n };
  });
  state.calls.bitcoin_mine_bind_phase.mockImplementation(async () => {
    steps.push("bind");
    state.phase = { state: "Bound", total_labor: 12n };
  });
  state.calls.bitcoin_mine_claim_phase_reward.mockImplementation(async () => {
    steps.push("claim");
  });
  await render();
  expect(container.querySelector("input")).toBeNull();
  await click();
  expect(steps).toEqual(["close", "bind", "claim"]);
  expect(state.calls.bitcoin_mine_claim_phase_reward).toHaveBeenCalledWith({
    signer: { address: "0x1" },
    phase_id: 9n,
    mine_ids: [9],
  });
});

it("reuses a bound root on a retry and reports the rejection", async () => {
  state.owner = 2n;
  state.mine = { next_phase: 9n };
  state.phase = { state: "Bound", total_labor: 12n };
  state.calls.bitcoin_mine_claim_phase_reward.mockRejectedValueOnce(new Error("Native action rejected"));
  await render();
  await click();
  expect(state.calls.bitcoin_mine_close_phase).not.toHaveBeenCalled();
  expect(state.calls.bitcoin_mine_bind_phase).not.toHaveBeenCalled();
  expect(state.success).not.toHaveBeenCalled();
  expect(state.error).toHaveBeenCalledWith("Native action rejected");
});
