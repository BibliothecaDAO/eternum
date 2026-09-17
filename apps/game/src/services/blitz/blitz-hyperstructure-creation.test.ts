// @vitest-environment node
import { configManager, Position } from "@bibliothecadao/eternum";
import type { AccountInterface } from "starknet";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ canIssueOrders: vi.fn(() => true) }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: mocks.canIssueOrders }));
import {
  clearPendingReservedHyperstructureCreation,
  createActiveWorldBlitzHyperstructure,
  isPendingReservedHyperstructureCreation,
  submitActiveWorldBlitzHyperstructureCreation,
} from "./blitz-hyperstructure-creation";

const account = { address: "0x123" } as AccountInterface;
const hexCoords = { col: 12, row: 34 };
const systemCalls = { create_hyperstructure: vi.fn() };
const input = { account, hexCoords, systemCalls };

describe("reserved hyperstructure creation", () => {
  beforeEach(() => {
    vi.spyOn(configManager, "getMapCenter").mockReturnValue(2010831280);
    mocks.canIssueOrders.mockReturnValue(true);
    systemCalls.create_hyperstructure.mockReset().mockResolvedValue({ transaction_hash: "0xabc" });
    clearPendingReservedHyperstructureCreation(hexCoords);
  });

  it("submits one action through the shared client with contract coordinates", async () => {
    await createActiveWorldBlitzHyperstructure(input);
    const coord = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    expect(systemCalls.create_hyperstructure).toHaveBeenCalledOnce();
    expect(systemCalls.create_hyperstructure).toHaveBeenCalledWith({
      signer: account,
      alt: false,
      x: coord.x,
      y: coord.y,
    });
  });

  it("blocks duplicate submissions until the reserved tile clears", async () => {
    await expect(submitActiveWorldBlitzHyperstructureCreation(input)).resolves.toBe(true);
    await expect(submitActiveWorldBlitzHyperstructureCreation(input)).resolves.toBe(false);
    expect(systemCalls.create_hyperstructure).toHaveBeenCalledOnce();
    expect(isPendingReservedHyperstructureCreation(hexCoords)).toBe(true);
    clearPendingReservedHyperstructureCreation(hexCoords);
    expect(isPendingReservedHyperstructureCreation(hexCoords)).toBe(false);
  });

  it("clears the local pending indicator when submission is rejected", async () => {
    systemCalls.create_hyperstructure.mockRejectedValueOnce(new Error("intent rejected"));
    await expect(submitActiveWorldBlitzHyperstructureCreation(input)).rejects.toThrow("intent rejected");
    expect(isPendingReservedHyperstructureCreation(hexCoords)).toBe(false);
  });

  it("blocks orders before marking a tile pending or submitting", async () => {
    mocks.canIssueOrders.mockReturnValue(false);
    await expect(submitActiveWorldBlitzHyperstructureCreation(input)).rejects.toThrow(
      "spectating or after the game ends",
    );
    await expect(createActiveWorldBlitzHyperstructure(input)).rejects.toThrow("spectating or after the game ends");
    expect(isPendingReservedHyperstructureCreation(hexCoords)).toBe(false);
    expect(systemCalls.create_hyperstructure).not.toHaveBeenCalled();
  });
});
