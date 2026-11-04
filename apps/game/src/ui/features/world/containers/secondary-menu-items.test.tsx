import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: "blitz" }) }));
vi.mock("@/ui/modules/settings/settings", () => ({ SETTINGS_POPOVER_ID: "settings", SettingsPanel: () => null }));

const { SecondaryMenuItems } = await import("./secondary-menu-items");

it("puts How to play, the game's guide in a new tab, beside the header's Settings", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<SecondaryMenuItems />));
  const guide = host.querySelector<HTMLAnchorElement>('a[aria-label="How to play"]')!;
  expect(guide.href).toBe("https://docs.realms.party/blitz/");
  expect(guide.target).toBe("_blank");
  expect(guide.rel).toBe("noopener noreferrer");
  expect(guide.querySelector("img")?.getAttribute("src")).toBe("/icons/facets/64/guide.webp");
  const settings = host.querySelector('button[aria-label="Settings"]')!;
  expect(guide.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  act(() => root.unmount());
  host.remove();
});
