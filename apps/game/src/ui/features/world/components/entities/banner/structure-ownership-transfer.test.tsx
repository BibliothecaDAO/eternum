// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StructureOwnershipTransfer } from "./structure-ownership-transfer";

const state = vi.hoisted(() => ({
  mode: "eternum",
  owner: 1n,
  currentOwner: 1n,
  category: 1,
  synced: true,
  transfer: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@bibliothecadao/react", () => ({
  useGame: () => ({
    setup: {
      store: { require: () => ({ owner: state.currentOwner }) },
      systemCalls: { transfer_structure_ownership: state.transfer },
    },
    account: { account: { address: "0x1" } },
  }),
  useNativeRow: () => (state.synced ? { owner: state.owner, base: { category: state.category } } : undefined),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useResolvedWorldGameMode: () => state.mode }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 7 } }));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant: string }) => (
    <button {...props} />
  ),
}));

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const render = () =>
  act(async () => {
    root.render(<StructureOwnershipTransfer structureId={42} />);
  });
const button = (label: string) => [...container.querySelectorAll("button")].find((node) => node.textContent === label)!;
const click = (label: string) =>
  act(async () => {
    button(label).click();
  });
const recipient = (value: string) =>
  act(async () => {
    const input = container.querySelector("input")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  Object.assign(state, { mode: "eternum", owner: 1n, currentOwner: 1n, category: 1, synced: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("confirms the recipient before submitting ownership without changing the store", async () => {
  await render();
  await click("Transfer ownership");
  await recipient("0x2");
  expect(state.transfer).not.toHaveBeenCalled();
  expect(container.textContent).toContain("cannot be undone");
  await click("Cancel");
  expect(state.transfer).not.toHaveBeenCalled();
  await click("Transfer ownership");
  await click("Confirm transfer");
  expect(state.transfer).toHaveBeenCalledOnce();
  const request = state.transfer.mock.calls[0][0];
  expect(request.signer).toEqual({ address: "0x1" });
  expect(request.structure_id).toBe(42);
  expect(BigInt(request.new_owner)).toBe(2n);
  expect(state.owner).toBe(1n);
  expect(state.success).toHaveBeenCalledWith("Structure ownership transferred");
});

it.each(["blitz", "village", "foreign", "unowned", "unsynced"])("does not offer transfer for %s", async (reason) => {
  if (reason === "blitz") state.mode = "blitz";
  if (reason === "village") state.category = 5;
  if (reason === "foreign") state.owner = 2n;
  if (reason === "unowned") state.owner = 0n;
  if (reason === "unsynced") state.synced = false;
  await render();
  expect(container.textContent).toBe("");
});

it.each(["", "0x0", "0x1", "0xz", "2", `0x${"f".repeat(64)}`])("rejects recipient %s", async (value) => {
  await render();
  await click("Transfer ownership");
  await recipient(value);
  expect(button("Confirm transfer").disabled).toBe(true);
  await click("Confirm transfer");
  expect(state.transfer).not.toHaveBeenCalled();
});

it("rechecks authoritative ownership before submitting", async () => {
  await render();
  await click("Transfer ownership");
  await recipient("0x2");
  state.currentOwner = 3n;
  await click("Confirm transfer");
  expect(state.transfer).not.toHaveBeenCalled();
  expect(state.error).toHaveBeenCalledWith("You no longer own this structure");
});

it("keeps a rejected transfer available for explicit retry", async () => {
  state.transfer.mockRejectedValueOnce(new Error("game ended"));
  await render();
  await click("Transfer ownership");
  await recipient("0x2");
  await click("Confirm transfer");
  expect(state.error).toHaveBeenCalledWith("game ended");
  expect(state.success).not.toHaveBeenCalled();
  await click("Confirm transfer");
  expect(state.transfer).toHaveBeenCalledTimes(2);
});

it("submits only once while the first transfer is pending", async () => {
  let complete!: () => void;
  state.transfer.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  await render();
  await click("Transfer ownership");
  await recipient("0x2");
  await act(async () => {
    button("Confirm transfer").click();
    button("Confirm transfer").click();
  });
  expect(state.transfer).toHaveBeenCalledOnce();
  expect(container.querySelector("input")!.disabled).toBe(true);
  expect(button("Cancel").disabled).toBe(true);
  await act(async () => complete());
  expect(state.success).toHaveBeenCalledOnce();
});
