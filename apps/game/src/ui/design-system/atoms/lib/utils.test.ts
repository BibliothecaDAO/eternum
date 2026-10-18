import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn with the token classes", () => {
  it("reads a type step as a size, so the element keeps its colour and a later size replaces it", () => {
    expect(cn("text-kit-cream", "text-title")).toBe("text-kit-cream text-title");
    expect(cn("text-caption", "text-[15px]")).toBe("text-[15px]");
  });

  it("lets a caller's radius, width and title shadow replace the token one", () => {
    expect(cn("rounded-plate border", "rounded-full")).toBe("border rounded-full");
    expect(cn("max-w-prose", "max-w-full")).toBe("max-w-full");
    expect(cn("w-column", "w-full")).toBe("w-full");
    expect(cn("px-gutter-desk", "px-4")).toBe("px-4");
    expect(cn("text-shadow-title text-kit-cream", "text-shadow-title-flat")).toBe(
      "text-kit-cream text-shadow-title-flat",
    );
  });

  it("keeps a HUD role (a size) beside a hud colour, and lets a later one of each replace the first", () => {
    expect(cn("text-hud-label", "text-hud-muted")).toBe("text-hud-label text-hud-muted");
    expect(cn("text-hud-label text-hud-muted", "text-hud-body text-hud-ink")).toBe("text-hud-body text-hud-ink");
    expect(cn("bg-hud-well border-hud-line", "bg-hud-hover border-hud-line-strong")).toBe(
      "bg-hud-hover border-hud-line-strong",
    );
  });
});
