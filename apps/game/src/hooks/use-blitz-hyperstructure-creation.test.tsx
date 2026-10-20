import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

// Before play opens the game takes no action: the act-now gate says why ("Starts in 2m 33s").
const gate = vi.hoisted(() => ({ refusal: null as string | null }));
const submit = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true, useActNowRefusal: () => gate.refusal }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ account: { account: { address: "0x1" } }, setup: { systemCalls: {} } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentBlockTimestamp: () => 0 }));
vi.mock("@/services/blitz/blitz-hyperstructure-creation", () => ({
  isPendingReservedHyperstructureCreation: () => false,
  subscribeBlitzHyperstructureCreationPending: () => () => {},
  submitActiveWorldBlitzHyperstructureCreation: submit,
}));

import { useBlitzHyperstructureCreation } from "./use-blitz-hyperstructure-creation";

let seen: ReturnType<typeof useBlitzHyperstructureCreation>;
const Probe = () => {
  seen = useBlitzHyperstructureCreation({ contractHex: { col: 10, row: 12 } });
  return null;
};
const render = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe />));
  return root;
};

afterEach(() => {
  gate.refusal = null;
});

it("stays shut before play opens and says why before the click; opens with play", async () => {
  gate.refusal = "Starts in 2m 33s";
  const root = await render();
  expect([seen.canCreate, seen.refusal]).toEqual([false, "Starts in 2m 33s"]);

  gate.refusal = null;
  await act(async () => root.render(<Probe />));
  expect([seen.canCreate, seen.refusal]).toEqual([true, null]);
  await act(async () => seen.createHyperstructure());
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});
