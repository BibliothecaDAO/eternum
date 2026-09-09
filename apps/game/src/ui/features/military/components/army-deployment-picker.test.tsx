import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TroopTier, TroopType } from "@bibliothecadao/types";

const mocks = vi.hoisted(() => ({
  isSpectating: false,
  explicit: false,
  close: vi.fn(),
  form: {} as any,
}));
vi.mock("@/ui/design-system/atoms/number-input", () => ({
  NumberInput: ({ value, onChange, arrows }: { value: number; onChange: (value: number) => void; arrows: boolean }) => (
    <input value={value} onChange={(event) => onChange(Number(event.target.value))} data-arrows={String(arrows)} />
  ),
}));
vi.mock("@/audio", () => ({ useUISound: () => () => {} }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (state: typeof mocks) => unknown) => selector(mocks),
}));
vi.mock("@/utils/spectator-session", () => ({ isExplicitSpectateSession: () => mocks.explicit }));
vi.mock("@/hooks/store/use-popover-store", () => ({ usePopoverStore: { getState: () => ({ close: mocks.close }) } }));
vi.mock("./unified-army-creation-modal/use-army-creation", () => ({ useArmyCreation: () => mocks.form }));
import { ArmyDeploymentPicker } from "./army-deployment-picker";

let root: Root;
let container: HTMLDivElement;
const renderPicker = () => act(async () => root.render(<ArmyDeploymentPicker structureId={42} isExplorer />));
const findButton = (label: string) =>
  [...container.querySelectorAll("button")].find((button) => button.textContent === label)!;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.isSpectating = false;
  mocks.explicit = false;
  vi.clearAllMocks();
  mocks.form = {
    troopOptions: [
      {
        type: TroopType.Knight,
        label: "Knight",
        tiers: [
          { tier: TroopTier.T1, available: 240, resourceTrait: "KNIGHT" },
          { tier: TroopTier.T2, available: 0, resourceTrait: "KNIGHT" },
          { tier: TroopTier.T3, available: 20, resourceTrait: "KNIGHT" },
        ],
      },
    ],
    selectedTroopCombo: { type: TroopType.Knight, tier: TroopTier.T1 },
    selectedAvailable: 240,
    troopCount: 100,
    maxAffordable: 150,
    isDefenseTroopLocked: false,
    blockedReason: null,
    isActionDisabled: false,
    isLoading: false,
    handleTroopSelect: vi.fn(),
    handleTroopCountChange: vi.fn(),
    handleCreate: vi.fn(),
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("shows troop tiles including blocked empty stock, an editable count and capped increments", async () => {
  await renderPicker();
  const chips = container.querySelectorAll('[role="group"] button');
  expect(chips).toHaveLength(3);
  expect(chips[1].getAttribute("title")).toBe("No troops in stock.");
  expect((chips[1] as HTMLButtonElement).disabled).toBe(true);
  expect(container.querySelectorAll("input")).toHaveLength(1);
  expect(container.querySelector("input")?.dataset.arrows).toBe("false");
  await act(async () => findButton("+100").click());
  expect(mocks.form.handleTroopCountChange).toHaveBeenLastCalledWith(150);
  await act(async () => findButton("+500").click());
  expect(mocks.form.handleTroopCountChange).toHaveBeenLastCalledWith(150);
  await act(async () => (chips[2] as HTMLButtonElement).click());
  expect(mocks.form.handleTroopSelect).toHaveBeenCalledWith(TroopType.Knight, TroopTier.T3);
  await act(async () => findButton("Max").click());
  expect(mocks.form.handleTroopCountChange).toHaveBeenCalledWith(150);
  expect(container.textContent).toContain("Uses 100 of 240 T1 Knight");
});

it("keeps an empty stockpile's blocker separate from usage and Deploy visible but disabled", async () => {
  mocks.form.troopOptions[0].tiers.forEach((tier: { available: number }) => (tier.available = 0));
  Object.assign(mocks.form, {
    selectedAvailable: 0,
    troopCount: 0,
    maxAffordable: 0,
    blockedReason: "Not enough of this troop.",
    isActionDisabled: true,
  });
  await renderPicker();
  expect(container.querySelectorAll('[role="group"] button:disabled')).toHaveLength(3);
  const reason = container.querySelector('[role="status"]');
  expect(reason?.textContent).toBe("Not enough of this troop.");
  expect(reason?.nextElementSibling?.textContent).toContain("Troop count");
  expect(container.textContent).toContain("Uses 0 of 0 T1 Knight");
  expect(findButton("Deploy").disabled).toBe(true);
});

describe("spectator gating", () => {
  it.each(["isSpectating", "explicit"] as const)("does not render for %s", async (key) => {
    mocks[key] = true;
    await renderPicker();
    expect(container.textContent).toBe("");
    expect(mocks.close).toHaveBeenCalledWith("army-deployment");
  });
});
