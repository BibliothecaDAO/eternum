import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlaytestSlots } from "./playtest-slots";

const mocks = vi.hoisted(() => ({
  status: "signed-in",
  owner: "0x1",
  signIn: vi.fn(),
  fetch: vi.fn(),
  register: vi.fn(),
}));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({
    status: mocks.status,
    session: mocks.status === "signed-in" ? { user: { id: mocks.owner } } : undefined,
  }),
  useIdentitySessionStore: (select: (state: { requestSignIn: typeof mocks.signIn }) => unknown) =>
    select({ requestSignIn: mocks.signIn }),
}));
vi.mock("../../factory-v2/api/factory-worker", () => ({
  fetchPlaytestSlots: mocks.fetch,
  registerPlaytestSlot: mocks.register,
}));
let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
const slot = (overrides = {}) => ({
  name: "evening",
  closesAt: "2099-01-01T12:00:00Z",
  frozenAt: null,
  closed: false,
  registrations: [],
  ...overrides,
});
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mocks.status = "signed-in";
  mocks.fetch.mockResolvedValue({ slots: [slot()] });
  host = document.createElement("div");
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
});
async function render() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <PlaytestSlots />
      </QueryClientProvider>,
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
it("offers sign-in before registering and never submits an anonymous registration", async () => {
  mocks.status = "signed-out";
  await render();
  expect(host.textContent).toContain("Sign in to register");
  await act(async () => host.querySelector("button")!.click());
  expect(mocks.signIn).toHaveBeenCalledOnce();
  expect(mocks.register).not.toHaveBeenCalled();
});
it("registers once and replaces the action with the identity's registration state", async () => {
  const registered = slot({ registrations: [{ owner: "0x0001", position: 1, gameNumber: null }] });
  mocks.register.mockImplementation(async () => {
    mocks.fetch.mockResolvedValue({ slots: [registered] });
    return registered;
  });
  await render();
  await act(async () => host.querySelector("button")!.click());
  await render();
  expect(mocks.register.mock.calls.map(([name]) => name)).toEqual(["evening"]);
  expect(host.textContent).toContain("Your game will be assigned");
  expect(host.querySelector("button")).toBeNull();
});
it("shows the frozen assignment only to its registrant and never offers a closed registration", async () => {
  mocks.fetch.mockResolvedValue({
    slots: [
      slot({
        frozenAt: "2026-01-01T12:00:00Z",
        closed: true,
        registrations: [{ owner: "0x1", position: 1, gameNumber: 2 }],
      }),
      slot({ name: "closed", closed: true, closesAt: "2026-01-01T12:00:00Z" }),
      slot({ name: "other", frozenAt: "2026-01-01T12:00:00Z" }),
    ],
  });
  await render();
  expect(host.textContent).toContain("Assigned to evening-2");
  expect(host.textContent).toContain("Registration closed");
  expect(host.textContent).not.toContain("other");
  expect(host.querySelector("button")).toBeNull();
});
it("reports registration failure and permits an explicit retry", async () => {
  mocks.register.mockRejectedValue(new Error("Registration already closed"));
  await render();
  await act(async () => host.querySelector("button")!.click());
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Registration already closed");
  expect(host.querySelector("button")?.disabled).toBe(false);
});
