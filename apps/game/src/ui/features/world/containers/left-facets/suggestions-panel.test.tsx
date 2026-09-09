import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: () => true }));
vi.mock("@/hooks/store/use-popover-store", () => ({ usePopoverStore: { getState: () => ({ close: vi.fn() }) } }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true }));
vi.mock("./use-empire-suggestions", () => ({ useEmpireSuggestions: () => [{ id: "build", realmId: 1 }] }));
vi.mock("./use-suggestion-actions", () => ({
  useSuggestionActions: () => ({ handleSuggestionClick: vi.fn(), pendingSuggestionIds: [] }),
}));
vi.mock("./suggestion-chip", () => ({ SuggestionChip: () => <button>Build</button> }));
import { SuggestionsPanel } from "./suggestions-panel";

it("mounts and closes in StrictMode when smooth scrolling returns a promise", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const scroll = vi.fn(() => Promise.resolve());
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () =>
      root.render(
        <StrictMode>
          <SuggestionsPanel selectedId="build" />
        </StrictMode>,
      ),
    );
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
  } finally {
    await act(async () => root.unmount());
    if (original) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original);
    else delete (HTMLElement.prototype as any).scrollIntoView;
  }
});
