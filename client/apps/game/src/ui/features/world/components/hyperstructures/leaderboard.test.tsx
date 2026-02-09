import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Leaderboard } from "./leaderboard";

let currentRegisteredPoints = 100;

const leaderboardManagerMock = {
  get playersByRank() {
    return [["0xabc", currentRegisteredPoints]] as Array<[string, number]>;
  },
  getPlayerRegisteredPoints: vi.fn(() => currentRegisteredPoints),
  getPlayerHyperstructureUnregisteredShareholderPoints: vi.fn(() => 0),
};

vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ children, onClick }: { children: string; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock("@/ui/design-system/atoms/sort-button", () => ({
  SortButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

vi.mock("@/ui/design-system/molecules/sort-panel", () => ({
  SortPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/ui/utils/utils", () => ({
  currencyIntlFormat: (value: number) => String(value),
  displayAddress: (value: string) => value,
  getEntityIdFromKeys: () => 1n,
  getRealmCountPerHyperstructure: () => 1,
}));

vi.mock("@/hooks/use-player-avatar", () => ({
  useAvatarProfiles: () => ({ data: [] }),
  getAvatarUrl: () => null,
  normalizeAvatarAddress: (address: string) => address.toLowerCase(),
}));

vi.mock(
  "@bibliothecadao/eternum",
  () => ({
    getAddressName: () => "Alice",
    toHexString: (value: string) => value,
    LeaderboardManager: {
      instance: vi.fn(() => leaderboardManagerMock),
    },
  }),
);

vi.mock(
  "@bibliothecadao/react",
  () => ({
    useDojo: () => ({
      account: { account: { address: "0xowner" } },
      setup: { components: { Structure: {} } },
    }),
    useHyperstructureUpdates: () => ({ id: "hyperstructure" }),
  }),
);

vi.mock(
  "@bibliothecadao/types",
  () => ({
    ContractAddress: (value: string) => value,
    ID: Number,
  }),
);

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: () => ({ owner: "0xowner" }),
}));

describe("In-game Leaderboard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    currentRegisteredPoints = 100;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();

    vi.clearAllMocks();
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("updates points without manual refresh", async () => {
    await act(async () => {
      root.render(<Leaderboard hyperstructureEntityId={1 as never} setSelectedTab={vi.fn()} />);
    });

    expect(container.textContent).toContain("100");

    currentRegisteredPoints = 250;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(container.textContent).toContain("250");
  });
});
