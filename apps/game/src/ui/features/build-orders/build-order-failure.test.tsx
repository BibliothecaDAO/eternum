// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// A phone in a Blitz: no realm needs attention and the order has no step, so only the account's orders can speak.
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => [] }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: {} }) }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useGoToStructure: () => vi.fn() }));
vi.mock("@/ui/features/world/containers/top-header/use-structure-attention", () => ({
  useStructureAttention: () => ({ targets: [] }),
}));
vi.mock("@/ui/features/world/containers/left-facets/use-empire-suggestions", () => ({
  useEmpireSuggestions: () => [],
}));
vi.mock("@/ui/features/world/containers/left-facets/use-suggestion-actions", () => ({
  isOrderSuggestion: () => true,
  useSuggestionActions: () => ({ handleSuggestionClick: vi.fn(), pendingSuggestionIds: [] }),
}));
vi.mock("@/utils/can-issue-orders", () => ({
  canIssueOrders: () => true,
  useActNowRefusal: () => null,
  refusedBeforePlay: () => false,
}));
const service = vi.hoisted(() => ({ getBuildOrders: vi.fn(), saveBuildOrders: vi.fn() }));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  identityClient: service,
}));

import { useBuildOrderStore } from "@/hooks/use-build-orders";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { AttentionPill } from "@/ui/features/world/containers/top-header/attention-pill";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  service.getBuildOrders.mockReset();
  usePopoverStore.setState({ openId: null, surface: null });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useBuildOrderStore.setState({ owner: null, status: "signed-out", book: null, revision: 0, notice: null });
});

const draw = (node: ReactNode) => act(async () => root.render(node));
const pill = () => host.querySelector<HTMLButtonElement>('button[aria-label^="Attention"]')!;

it("counts the account's orders failing to be read on a phone's Attention, and says it with Try again where it opens", async () => {
  useBuildOrderStore.setState({
    owner: "0xa1",
    status: "error",
    book: null,
    revision: 0,
    notice: "Your build orders could not be reached.",
  });
  await draw(<AttentionPill />);
  expect([pill().disabled, pill().getAttribute("aria-label")]).toEqual([false, "Attention: 1. Go to next item"]);

  await act(async () => pill().click());
  const surface = usePopoverStore.getState().surface;
  expect(surface?.id).toBe("suggestions");
  await draw(surface!.content);
  const notice = host.querySelector(".ui-notice");
  expect(notice?.textContent).toBe("Your build orders could not be reached.Try again");
  expect(host.textContent).not.toContain("No suggested actions right now.");

  // Read again: the account answers, the line goes and nothing is left to see.
  service.getBuildOrders.mockResolvedValue({ owner: "0xa1", revision: 1, book: { orders: [], active: null } });
  await act(async () => notice!.querySelector("button")!.click());
  expect(host.querySelector(".ui-notice")).toBeNull();
  await draw(<AttentionPill />);
  expect(pill().disabled).toBe(true);
});
