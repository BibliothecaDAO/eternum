import { resourceMeaning, iconUrl } from "@/ui/design-system/icon-meaning";
import { MathUtils } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { formatExact, getRelicInfo, ResourcesIds } from "@bibliothecadao/types";
import type { ChestReward } from "@bibliothecadao/eternum";

/** Actual awarded relics or LORDS rise from the lid on the chest's animation clock. */
export class ChestRewardReveal {
  readonly label: CSS2DObject;
  private readonly icons: HTMLDivElement[] = [];

  constructor(reward: ChestReward) {
    const anchor = document.createElement("div");
    anchor.dataset.chestRewards = "true";
    const container = document.createElement("div");
    anchor.append(container);
    container.style.cssText = "display:flex;gap:10px;pointer-events:none;";
    const prizes =
      reward.kind === "relics"
        ? reward.relics.map((resourceId) => ({
            resourceId,
            name: getRelicInfo(resourceId)?.name ?? `Relic ${resourceId}`,
          }))
        : reward.amount > 0
          ? [{ resourceId: ResourcesIds.Lords, name: `${formatExact(reward.amount)} LORDS` }]
          : [];
    for (const { resourceId, name } of prizes) {
      const icon = document.createElement("div");
      icon.style.cssText =
        "width:48px;height:48px;border:1px solid #be81ec;border-radius:50%;background:#22112ee8;box-shadow:0 0 18px #a535dda0;padding:4px;opacity:0;";
      const image = document.createElement("img");
      image.src = iconUrl(resourceMeaning(resourceId));
      image.alt = name;
      image.style.cssText = "width:100%;height:100%;object-fit:contain;";
      icon.append(image);
      if (reward.kind === "lords") {
        const amount = document.createElement("span");
        amount.textContent = name;
        amount.className = "text-hud-body text-hud-accent";
        amount.style.cssText = "display:block;white-space:nowrap;text-align:center;margin-top:6px;";
        icon.append(amount);
      }
      container.append(icon);
      this.icons.push(icon);
    }
    this.label = new CSS2DObject(anchor);
    this.label.position.y = 1.65;
    this.label.visible = false;
  }

  update(openingElapsed: number): void {
    this.label.visible = openingElapsed > 0.25;
    this.icons.forEach((icon, index) => {
      const progress = MathUtils.smoothstep(openingElapsed, 0.25 + index * 0.08, 0.6 + index * 0.08);
      const fade = 1 - MathUtils.smoothstep(openingElapsed, 2.1, 2.65);
      const spread = index - (this.icons.length - 1) / 2;
      icon.style.opacity = String(progress * fade);
      icon.style.transform = `translate(${-spread * 46 * (1 - progress)}px, ${(1 - progress) * 55}px) scale(${0.35 + progress * 0.65 + Math.sin(progress * Math.PI) * 0.15})`;
    });
  }

  dispose(): void {
    this.label.removeFromParent();
    this.label.element.remove();
  }
}
