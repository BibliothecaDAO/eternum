// @vitest-environment node

import { DEFAULT_COORD_ALT, Position } from "@bibliothecadao/eternum";
import { CallData } from "starknet";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeObservedClientTransaction: vi.fn(),
  getActiveWorld: vi.fn(),
  getGameManifest: vi.fn(),
  getContractByName: vi.fn(),
  normalizeSelector: vi.fn(),
}));

vi.mock("@/observability/observed-client-transaction", () => ({
  executeObservedClientTransaction: mocks.executeObservedClientTransaction,
}));

vi.mock("@/runtime/world", () => ({
  getActiveWorld: mocks.getActiveWorld,
}));

vi.mock("@/runtime/world/normalize", () => ({
  normalizeSelector: mocks.normalizeSelector,
}));

vi.mock("@contracts", () => ({
  getGameManifest: mocks.getGameManifest,
}));

vi.mock("@dojoengine/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dojoengine/core")>();
  return {
    ...actual,
    getContractByName: mocks.getContractByName,
  };
});

import {
  clearPendingReservedHyperstructureCreation,
  createActiveWorldBlitzHyperstructure,
  isPendingReservedHyperstructureCreation,
  submitActiveWorldBlitzHyperstructureCreation,
} from "./blitz-hyperstructure-creation";

describe("createActiveWorldBlitzHyperstructure", () => {
  beforeEach(() => {
    mocks.executeObservedClientTransaction.mockReset();
    mocks.executeObservedClientTransaction.mockResolvedValue({ transaction_hash: "0xtx" });
    mocks.getActiveWorld.mockReset();
    mocks.getActiveWorld.mockReturnValue({
      name: "credence-new-flow-4",
      chain: "appchain",
      worldAddress: "0xworld",
      contractsBySelector: { "0xselector": "0xhyper" },
    });
    mocks.getGameManifest.mockReset();
    mocks.getGameManifest.mockReturnValue({ contracts: [{ selector: "0xselector", address: "0xhyper" }] });
    mocks.getContractByName.mockReset();
    mocks.getContractByName.mockReturnValue({ selector: "0xselector" });
    mocks.normalizeSelector.mockReset();
    mocks.normalizeSelector.mockImplementation((value: string) => value);
    clearPendingReservedHyperstructureCreation({ col: 12, row: 34 });
    clearPendingReservedHyperstructureCreation({ col: 1, row: 2 });
  });

  it("submits create_hyperstructure against the active world contract", async () => {
    const account = { address: "0xplayer", execute: vi.fn() };
    const hexCoords = { col: 12, row: 34 };
    const contractCoords = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();

    await createActiveWorldBlitzHyperstructure({ account, hexCoords });

    expect(mocks.getGameManifest).toHaveBeenCalledWith("appchain");
    // The namespace is the ambient game scope (set at bootstrap; module default here).
    expect(mocks.getContractByName).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      "hyperstructure_create_systems",
    );
    expect(mocks.normalizeSelector).toHaveBeenCalledWith("0xselector");
    expect(mocks.executeObservedClientTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        surface: "settlement",
        operation: "hyperstructure_create_systems.create_hyperstructure",
        chain: "appchain",
        worldName: "credence-new-flow-4",
        worldAddress: "0xworld",
        waitForConfirmation: false,
        calls: expect.objectContaining({
          contractAddress: "0xhyper",
          entrypoint: "create_hyperstructure",
          calldata: CallData.compile([{ alt: DEFAULT_COORD_ALT, x: contractCoords.x, y: contractCoords.y }]),
        }),
      }),
    );
  });

  it("keeps duplicate submissions blocked until the reserved tile clears", async () => {
    const account = { address: "0xplayer", execute: vi.fn() };
    const hexCoords = { col: 12, row: 34 };

    expect(isPendingReservedHyperstructureCreation(hexCoords)).toBe(false);

    await expect(submitActiveWorldBlitzHyperstructureCreation({ account, hexCoords })).resolves.toBe(true);
    await expect(submitActiveWorldBlitzHyperstructureCreation({ account, hexCoords })).resolves.toBe(false);

    expect(isPendingReservedHyperstructureCreation(hexCoords)).toBe(true);
    expect(mocks.executeObservedClientTransaction).toHaveBeenCalledOnce();

    clearPendingReservedHyperstructureCreation(hexCoords);
    expect(isPendingReservedHyperstructureCreation(hexCoords)).toBe(false);
  });

  it("fails clearly when the active world profile is missing", async () => {
    mocks.getActiveWorld.mockReturnValue(null);

    await expect(
      createActiveWorldBlitzHyperstructure({
        account: { address: "0xplayer", execute: vi.fn() },
        hexCoords: { col: 1, row: 2 },
      }),
    ).rejects.toThrow("Active world profile is unavailable for hyperstructure creation.");
  });
});
