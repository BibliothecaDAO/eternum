import { TransactionType } from "@bibliothecadao/provider";
import { expect, it } from "vitest";
import type { Transaction } from "@/hooks/store/use-transaction-store";

import { sendOutcome } from "./row-outcomes";

const grants = () => ({
  exploreTile: 5,
  openRelicCrate: 250,
  claimCampFromBandits: 250,
  claimHyperstructureFromBandits: 1000,
});
const explore = (status: Transaction["status"]) =>
  ({ hash: "0x1", type: TransactionType.EXPLORE, status, submittedAt: 0, description: "Scouts sent" }) as Transaction;

it("tells a done explore its points, and leaves a pending or refused one to its status line", () => {
  expect(sendOutcome(explore("success"), grants)).toBe("Explored: +5 points");
  expect(sendOutcome(explore("pending"), grants)).toBeNull();
  expect(sendOutcome(explore("reverted"), grants)).toBeNull();
});
