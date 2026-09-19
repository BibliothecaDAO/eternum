// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GuardDismissal } from "./guard-dismissal";

const state = vi.hoisted(() => ({
  owner: 1n,
  count: 10n,
  slots: 2,
  synced: true,
  remove: vi.fn(),
  dismissed: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@bibliothecadao/react", () => ({
  useGame: () => ({
    setup: { systemCalls: { guard_delete: state.remove } },
    account: { account: { address: "0x1" } },
  }),
  useNativeRow: (model: string) =>
    !state.synced
      ? undefined
      : model === "Structure"
        ? { owner: state.owner, base: { troop_max_guard_count: state.slots } }
        : { troops: { count: state.count } },
}));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 7 } }));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant: string }) => (
    <button {...props} />
  ),
}));

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const render = (disabled = false) =>
  act(async () => {
    root.render(<GuardDismissal structureId={42} slot={0} disabled={disabled} onDismissed={state.dismissed} />);
  });
const click = (label: string) =>
  act(async () => {
    [...container.querySelectorAll("button")].find((button) => button.textContent === label)!.click();
  });

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  Object.assign(state, { owner: 1n, count: 10n, slots: 2, synced: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("requires confirmation and submits the contract slot without changing the guard locally", async () => {
  await render();
  await click("Dismiss guard");
  expect(state.remove).not.toHaveBeenCalled();
  expect(container.textContent).toContain("slot 1");
  expect(container.textContent).toContain("permanently lost");
  await click("Cancel");
  expect(state.remove).not.toHaveBeenCalled();
  await click("Dismiss guard");
  await click("Confirm dismissal");
  expect(state.remove).toHaveBeenCalledOnce();
  expect(state.remove).toHaveBeenCalledWith({ signer: { address: "0x1" }, for_structure_id: 42, slot: 0 });
  expect(state.dismissed).toHaveBeenCalledOnce();
  expect(state.count).toBe(10n);
});

it.each(["foreign", "empty", "locked", "unsynced"])("has no dismissal for a %s guard", async (reason) => {
  if (reason === "foreign") state.owner = 2n;
  if (reason === "empty") state.count = 0n;
  if (reason === "locked") state.slots = 0;
  if (reason === "unsynced") state.synced = false;
  await render();
  expect(container.textContent).toBe("");
  expect(state.remove).not.toHaveBeenCalled();
});

it("disables dismissal while recruitment is pending", async () => {
  await render(true);
  expect(container.querySelector("button")?.disabled).toBe(true);
  await click("Dismiss guard");
  expect(container.textContent).not.toContain("Confirm dismissal");
});

it("reports rejection, keeps the picker open and permits an explicit retry", async () => {
  state.remove.mockRejectedValueOnce(new Error("guard is empty"));
  await render();
  await click("Dismiss guard");
  await click("Confirm dismissal");
  expect(state.error).toHaveBeenCalledWith("guard is empty");
  expect(state.dismissed).not.toHaveBeenCalled();
  await click("Confirm dismissal");
  expect(state.remove).toHaveBeenCalledTimes(2);
  expect(state.dismissed).toHaveBeenCalledOnce();
});

it("does not submit twice while the first dismissal is pending", async () => {
  let complete!: () => void;
  state.remove.mockReturnValue(
    new Promise<void>((resolve) => {
      complete = resolve;
    }),
  );
  await render();
  await click("Dismiss guard");
  await act(async () => {
    const confirm = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Confirm dismissal",
    )!;
    confirm.click();
    confirm.click();
  });
  expect(state.remove).toHaveBeenCalledOnce();
  expect(state.dismissed).not.toHaveBeenCalled();
  await act(async () => complete());
  expect(state.dismissed).toHaveBeenCalledOnce();
});
