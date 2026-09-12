import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const metadata = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@bibliothecadao/eternum", () => ({ getCanonicalRealmMetadata: metadata.load }));
import { RealmNumberPicker } from "./realm-number-picker";

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  metadata.load.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  client.clear();
  container.remove();
});

async function showRealm(value: string) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <RealmNumberPicker value={value} onChange={() => {}} disabled={false} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

it("replaces the preview when the selected realm changes", async () => {
  metadata.load.mockResolvedValueOnce({ name: "Stolsli", resources: ["Stone", "Coal"] });
  await showRealm("1");
  await vi.waitFor(() => expect(container.textContent).toContain("Stolsli"));
  expect(container.textContent).toContain("Stone, Coal");
  metadata.load.mockResolvedValueOnce({ name: "Gislegob", resources: ["Coal"] });
  await showRealm("87");
  await vi.waitFor(() => expect(container.textContent).toContain("Gislegob"));
  expect(container.textContent).not.toContain("Stolsli");
  expect(metadata.load).toHaveBeenLastCalledWith(87);
});

it("clears stale metadata and skips the lookup for an invalid number", async () => {
  metadata.load.mockResolvedValue({ name: "Stolsli", resources: ["Stone", "Coal"] });
  await showRealm("1");
  await vi.waitFor(() => expect(container.textContent).toContain("Stolsli"));
  await showRealm("");
  expect(container.textContent).toContain("Choose a realm number from 1 to 8000");
  expect(container.textContent).not.toContain("Stolsli");
  expect(metadata.load).toHaveBeenCalledTimes(1);
});
