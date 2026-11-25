import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: "frontier" }) }));
vi.mock("@/ui/modules/settings/settings", () => ({ SETTINGS_POPOVER_ID: "settings", SettingsPanel: () => null }));

const { SecondaryMenuItems } = await import("./secondary-menu-items");

it("draws Settings alone in the header's last slot without a separate guide button", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<SecondaryMenuItems />));
  expect(host.querySelector('a[aria-label="Guide"]')).toBeNull();
  const settings = host.querySelector('button[aria-label="Settings"]');
  expect(settings).not.toBeNull();
  act(() => root.unmount());
  host.remove();
});
