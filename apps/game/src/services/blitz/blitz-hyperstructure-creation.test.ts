import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true }));

import { DEFAULT_COORD_ALT } from "@bibliothecadao/eternum";
import {
  clearPendingReservedHyperstructureCreation,
  submitActiveWorldBlitzHyperstructureCreation,
} from "./blitz-hyperstructure-creation";

// The reservation seen live (contracts-capture): the command named (2x, 2y) and the chain refused "missing reservation".
const RESERVATION = { col: 0x47994120, row: 0x47994120 };
const account = { address: "0x1" } as never;

afterEach(() => clearPendingReservedHyperstructureCreation(RESERVATION));

it("creates the reserved hyperstructure at the reservation's own contract coordinates", async () => {
  const create_hyperstructure = vi.fn(async () => ({ transaction_hash: "0xabc" }) as never);
  const sent = await submitActiveWorldBlitzHyperstructureCreation({
    account,
    contractHex: RESERVATION,
    systemCalls: { create_hyperstructure },
  });
  expect(sent).toBe(true);
  expect(create_hyperstructure).toHaveBeenCalledTimes(1);
  expect(create_hyperstructure).toHaveBeenCalledWith({
    signer: account,
    alt: DEFAULT_COORD_ALT,
    x: 0x47994120,
    y: 0x47994120,
  });
});
