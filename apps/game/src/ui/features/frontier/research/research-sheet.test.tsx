import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { researchPlanFixture } from "@/ui/features/debug/motion-lab/research-fixtures";
import { ResearchSheet } from "./research-sheet";

const render = (learned: number, essence: number, research = vi.fn(() => Promise.resolve())) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(<ResearchSheet plan={researchPlanFixture(learned, essence)} research={research} onClose={() => {}} />),
  );
  const node = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label^="${label}"]`)!;
  const buy = () => host.querySelector<HTMLButtonElement>('button[aria-label="Research"]')!;
  return { host, root, node, buy, research };
};

describe("the research sheet", () => {
  it("opens on the first open node and buys it with enough Essence; a locked node cannot be bought", async () => {
    const { node, buy, research, root } = render(1 << 0, 1_250);
    // Farm II is learned, so Farm III is the first open node, and at 12,000 it is out of reach.
    expect(node("Farm, open").getAttribute("aria-pressed")).toBe("true");
    expect(buy().disabled).toBe(true);
    act(() => node("Hut, open").click());
    expect(buy().disabled).toBe(false);
    await act(async () => buy().click());
    expect(research).toHaveBeenCalledWith(expect.objectContaining({ node: 6 }));
    act(() => node("Hut, locked").click());
    expect(buy().disabled).toBe(true);
    act(() => root.unmount());
  });
});
