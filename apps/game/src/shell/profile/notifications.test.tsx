import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const save = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "0x7" } } }),
  notificationOwnerOf: () => "0x7",
  identityClient: { getPushConfiguration: async () => ({ enabled: false }) },
}));
vi.mock("@/hooks/use-notification-preferences", () => ({
  useNotificationPreferences: () => ({
    status: "ready",
    saved: { level: "standard", revision: 1 },
    save,
    reload: vi.fn(),
  }),
}));

import { NotificationsCard } from "./notifications";

it("offers three levels, lights none for a stored Standard, and saves the level tapped", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<NotificationsCard />));
  try {
    const levels = [...container.querySelectorAll('[role="radio"]')];
    expect(levels.map((level) => level.textContent)).toEqual(["Off", "Important", "All"]);
    expect(levels.filter((level) => level.getAttribute("aria-checked") === "true")).toEqual([]);
    await act(async () => (levels[1] as HTMLButtonElement).click());
    expect(save).toHaveBeenCalledWith("important");
    expect(container.textContent).toContain("This device");
  } finally {
    await act(async () => root.unmount());
  }
});
