import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const registration = vi.hoisted(() => ({
  ready: null as null | ((apply: () => Promise<void>) => void),
  cleanup: vi.fn(),
}));
vi.mock("./register-service-worker", () => ({
  registerGameServiceWorker: (ready: typeof registration.ready) => {
    registration.ready = ready;
    return registration.cleanup;
  },
}));
import { PwaUpdatePrompt } from "./pwa-update-prompt";
import { useTransactionStore } from "@/hooks/store/use-transaction-store";

afterEach(() => {
  vi.unstubAllEnvs();
  useTransactionStore.setState({ transactions: [] });
  registration.ready = null;
  vi.clearAllMocks();
});

it("keeps the update action disabled until pending transactions finish and surfaces activation failure", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubEnv("PROD", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  const apply = vi.fn().mockRejectedValue(new Error("offline"));
  try {
    await act(async () => root.render(<PwaUpdatePrompt />));
    expect(container.textContent).toBe("");
    await act(async () => {
      useTransactionStore.setState({ transactions: [{ hash: "0x1", status: "pending", submittedAt: 0 } as never] });
      registration.ready!(apply);
    });
    const button = container.querySelector("button")!;
    expect(button.disabled).toBe(true);
    expect(container.textContent).toContain("Waiting for your transaction");
    expect(apply).not.toHaveBeenCalled();
    await act(async () => useTransactionStore.setState({ transactions: [] }));
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(apply).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Please try again");
    expect(button.disabled).toBe(false);
    await act(async () => container.querySelectorAll("button")[1].click());
    expect(container.textContent).toBe("");
  } finally {
    await act(async () => root.unmount());
  }
  expect(registration.cleanup).toHaveBeenCalledOnce();
});
