import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const arrivals = [
  { structureEntityId: 42, arrivesAt: 160n, day: 1n, slot: 1n, resources: [] },
  { structureEntityId: 42, arrivesAt: 220n, day: 1n, slot: 2n, resources: [] },
  { structureEntityId: 42, arrivesAt: 90n, day: 1n, slot: 3n, resources: [] },
  { structureEntityId: 99, arrivesAt: 120n, day: 1n, slot: 4n, resources: [] },
];
vi.mock("@/hooks/store/use-world-slices-store", () => ({
  useWorldSlicesStore: (select: (state: unknown) => unknown) => select({ resourceArrivals: arrivals }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentBlockTimestamp: () => 100 }));
vi.mock("@bibliothecadao/eternum", () => ({ formatTime: (seconds: number) => `${seconds}s` }));
import { IncomingCaravans, summarizeIncomingCaravans } from "./incoming-caravans";
it("counts only future caravans for the selected structure and uses the next arrival", () => {
  expect(summarizeIncomingCaravans(arrivals, 42, 100)).toEqual({ count: 2, nextInSeconds: 60 });
  expect(renderToStaticMarkup(<IncomingCaravans structureId={42} isOwner />)).toContain(
    "Incoming · 2 caravans · next in 60s",
  );
});
it("hides the line for other owners, zero incoming, and after the final arrival", () => {
  expect(renderToStaticMarkup(<IncomingCaravans structureId={42} isOwner={false} />)).toBe("");
  expect(renderToStaticMarkup(<IncomingCaravans structureId={1} isOwner />)).toBe("");
  expect(summarizeIncomingCaravans(arrivals, 42, 220)).toBeNull();
});
