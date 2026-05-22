// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { CameraView } from "../../scenes/camera-view";
import { createContentContainer, createGuardArmyDisplay, createStaminaBar } from "./label-components";
import { createLabelBase } from "./label-shared";

describe("hover detail label components", () => {
  it("uses a stable readable card surface for hover labels", () => {
    const label = createLabelBase(true, CameraView.Medium);

    expect(label.dataset.component).toBe("hover-detail-label");
    expect(label.classList.contains("min-w-[240px]")).toBe(true);
    expect(label.classList.contains("backdrop-blur-md")).toBe(true);
    expect(label.style.backgroundColor).toContain("0.88");
  });

  it("keeps medium-view detail content on a readable width", () => {
    const content = createContentContainer(CameraView.Medium);

    expect(content.wrapper.classList.contains("min-w-[190px]")).toBe(true);
    expect(content.wrapper.classList.contains("max-w-[320px]")).toBe(true);
  });

  it("shows stamina as a numeric value with a compact meter in medium view", () => {
    const stamina = createStaminaBar(75, 100, CameraView.Medium);

    expect(stamina.textContent).toContain("Stamina");
    expect(stamina.querySelector("[data-role='stamina-text']")?.textContent).toBe("75/100");
    expect(stamina.querySelector("[data-role='progress-container']")).not.toBeNull();
  });

  it("shows guard stamina in medium-view guard troop pills", () => {
    const guards = createGuardArmyDisplay(
      [{ slot: 1, category: "Knight", tier: 2, count: 1500, stamina: 42 }],
      CameraView.Medium,
    );

    expect(guards.textContent).toContain("1.5k");
    expect(guards.querySelector("[data-role='guard-stamina-text']")?.textContent).toBe("42");
  });
});
