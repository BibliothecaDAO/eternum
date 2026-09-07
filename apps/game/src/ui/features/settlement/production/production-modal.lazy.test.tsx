import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let finishLoading!: () => void;
  const pending = new Promise<void>((resolve) => {
    finishLoading = resolve;
  });
  return { pending, finishLoading, loaded: vi.fn(), close: vi.fn() };
});

vi.mock("./production-popup-shell", () => ({
  ProductionPopupShell: ({ children }: { children: ReactNode }) => (
    <section>
      <button onClick={mocks.close}>Close production</button>
      {children}
    </section>
  ),
}));

vi.mock("./production-modal-content", async () => {
  mocks.loaded();
  await mocks.pending;
  return {
    ProductionModal: ({
      preSelectedRealmId,
      preSelectedResource,
    }: {
      preSelectedRealmId?: number;
      preSelectedResource?: number;
    }) => (
      <output>
        {preSelectedRealmId}:{preSelectedResource}
      </output>
    ),
  };
});

import { ProductionModal } from "./production-modal";

it("loads production on opening, keeps the loading frame closable, and forwards selection", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  expect(mocks.loaded).not.toHaveBeenCalled();
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ProductionModal preSelectedRealmId={42} preSelectedResource={1} />));
    await vi.waitFor(() => expect(mocks.loaded).toHaveBeenCalledOnce());
    expect(container.querySelector("img")).not.toBeNull();
    await act(async () => container.querySelector("button")!.click());
    expect(mocks.close).toHaveBeenCalledOnce();
    await act(async () => mocks.finishLoading());
    await vi.waitFor(() => expect(container.querySelector("output")?.textContent).toBe("42:1"));
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
