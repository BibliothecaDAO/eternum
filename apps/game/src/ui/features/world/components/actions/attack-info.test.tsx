import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";

import { AttackInfo } from "./attack-info";

const { getBlockTimestampMock, useStaminaManagerMock } = vi.hoisted(() => ({
  getBlockTimestampMock: vi.fn(() => ({
    currentBlockTimestamp: 0,
    currentDefaultTick: 0,
    currentArmiesTick: 0,
  })),
  useStaminaManagerMock: vi.fn(() => ({
    getStamina: (currentArmiesTick: number) => ({
      amount: currentArmiesTick >= 2 ? 60n : 40n,
      updated_tick: BigInt(currentArmiesTick),
    }),
  })),
}));

vi.mock("@bibliothecadao/react", () => ({
  useStaminaManager: useStaminaManagerMock,
}));

vi.mock("@bibliothecadao/eternum", () => ({
  getBlockTimestamp: getBlockTimestampMock,
  configManager: {
    getCombatConfig: () => ({
      stamina_attack_req: 50,
    }),
    getTick: () => 1,
  },
}));

describe("AttackInfo", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useBlockTimestampStore.setState({
      currentBlockTimestamp: 0,
      currentDefaultTick: 0,
      currentArmiesTick: 1,
      armiesTickTimeRemaining: 0,
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("reacts to armies tick updates from the timestamp store", async () => {
    await act(async () => {
      root.render(<AttackInfo selectedEntityId={1 as never} path={[]} />);
    });

    expect(container.textContent).toContain("Low stamina");

    await act(async () => {
      useBlockTimestampStore.setState({
        currentArmiesTick: 2,
      });
    });

    expect(container.textContent).not.toContain("Low stamina");
  });
});
