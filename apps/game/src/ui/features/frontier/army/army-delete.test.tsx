import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/sync/action-outcome", async (original) => ({
  ...(await original<typeof import("@/sync/action-outcome")>()),
  untilApplied: async (sent: Promise<unknown>) => {
    await sent;
    return "0x1";
  },
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { DockArmy } from "../hud/dock-armies";
import { ArmyDeleteButton, ArmyDeleteConfirm } from "./army-delete";
import { transferArmies } from "./transfer-fixture";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  useUIStore.setState({ isSpectating: false });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

/** The trash and its confirm as the army's panel holds them: the trash beside the cross, the confirm in the body. */
const PanelDelete = ({ army, onDeleted }: { army: DockArmy; onDeleted: () => void }) => {
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <ArmyDeleteButton army={army} onPress={() => setDeleting(true)} />
      {deleting && <ArmyDeleteConfirm army={army} onCancel={() => setDeleting(false)} onDeleted={onDeleted} />}
    </>
  );
};

const render = () => {
  const store = transferArmies();
  const remove = vi.fn().mockResolvedValue({ transaction_hash: "0x2" });
  const deleted = vi.fn();
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: { explorer_delete: remove } } as never}
        account={{ address: "0x111" } as never}
      >
        <PanelDelete army={{ explorerId: 201 } as DockArmy} onDeleted={deleted} />
      </GameProvider>,
    ),
  );
  return { remove, deleted };
};
const press = async (find: (button: HTMLButtonElement) => boolean) =>
  act(async () => {
    const button = [...host.querySelectorAll("button")].find(find);
    expect(button).toBeDefined();
    button!.click();
  });
const trash = () => press((button) => button.getAttribute("aria-label") === "Delete");
const verb = (name: string) => press((button) => button.textContent === name);

it("deletes from the trash only after confirming every loss, then closes the army panel", async () => {
  const { remove, deleted } = render();
  expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  await trash();
  expect(remove).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain(
    "troops, skills, XP and carried resources are lost",
  );
  await verb("Cancel");
  expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  expect(remove).not.toHaveBeenCalled();
  await trash();
  await verb("Delete");
  expect(remove).toHaveBeenCalledOnce();
  expect(remove.mock.calls[0][0]).toMatchObject({ explorer_id: 201 });
  expect(deleted).toHaveBeenCalledOnce();
});

it("offers no trash to spectators", () => {
  const { remove } = render();
  act(() => useUIStore.setState({ isSpectating: true }));
  expect(host.querySelectorAll("button")).toHaveLength(0);
  expect(remove).not.toHaveBeenCalled();
});
