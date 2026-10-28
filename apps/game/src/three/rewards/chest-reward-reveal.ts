import { iconUrl, resourceMeaning, type IconMeaning } from "@/ui/design-system/icon-meaning";
import { MathUtils } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { formatExact, getRelicInfo, ResourcesIds } from "@bibliothecadao/types";
import type { ChestReward } from "@bibliothecadao/eternum";

/** One thing a chest gives as it opens: its painting, and its figure under it ("+100 LORDS", "+136 XP", "−4"). */
export type ChestPrize = { icon?: IconMeaning; name: string; figure?: string };

/** A chest's actual awarded relics or LORDS, as its opening shows them. */
export const chestRewardPrizes = (reward: ChestReward): ChestPrize[] =>
  reward.kind === "relics"
    ? reward.relics.map((resourceId) => ({
        icon: resourceMeaning(resourceId),
        name: getRelicInfo(resourceId)?.name ?? `Relic ${resourceId}`,
      }))
    : reward.amount > 0
      ? [
          {
            icon: resourceMeaning(ResourcesIds.Lords),
            name: `${formatExact(reward.amount)} LORDS`,
            figure: `${formatExact(reward.amount)} LORDS`,
          },
        ]
      : [];

/** The prizes rise from the lid on the chest's animation clock, fan out, and fade as the chest is absorbed. */
export class ChestRewardReveal {
  readonly label: CSS2DObject;
  private readonly prizes: HTMLDivElement[] = [];

  constructor(prizes: readonly ChestPrize[]) {
    const anchor = document.createElement("div");
    anchor.dataset.chestRewards = "true";
    const container = document.createElement("div");
    anchor.append(container);
    container.style.cssText = "display:flex;gap:10px;align-items:flex-start;pointer-events:none;";
    for (const prize of prizes) {
      const element = document.createElement("div");
      element.dataset.chestPrize = prize.name;
      element.style.cssText = "display:flex;flex-direction:column;align-items:center;opacity:0;";
      if (prize.icon) {
        const ring = document.createElement("div");
        ring.style.cssText =
          "width:48px;height:48px;border:1px solid #be81ec;border-radius:50%;background:#22112ee8;box-shadow:0 0 18px #a535dda0;padding:4px;";
        const image = document.createElement("img");
        image.src = iconUrl(prize.icon);
        image.alt = prize.name;
        image.style.cssText = "width:100%;height:100%;object-fit:contain;";
        ring.append(image);
        element.append(ring);
      }
      if (prize.figure) {
        const figure = document.createElement("span");
        figure.textContent = prize.figure;
        figure.className = "text-hud-body text-hud-accent";
        // Outlined, so it reads over any ground the chest opens on.
        figure.style.cssText =
          "display:block;white-space:nowrap;text-align:center;margin-top:6px;font-weight:600;text-shadow:0 1px 2px #000,0 0 6px #000;";
        element.append(figure);
      }
      container.append(element);
      this.prizes.push(element);
    }
    this.label = new CSS2DObject(anchor);
    this.label.position.y = 1.65;
    this.label.visible = false;
  }

  update(openingElapsed: number): void {
    this.label.visible = openingElapsed > 0.25;
    this.prizes.forEach((prize, index) => {
      const progress = MathUtils.smoothstep(openingElapsed, 0.25 + index * 0.08, 0.6 + index * 0.08);
      const fade = 1 - MathUtils.smoothstep(openingElapsed, 2.1, 2.65);
      const spread = index - (this.prizes.length - 1) / 2;
      prize.style.opacity = String(progress * fade);
      prize.style.transform = `translate(${-spread * 46 * (1 - progress)}px, ${(1 - progress) * 55}px) scale(${0.35 + progress * 0.65 + Math.sin(progress * Math.PI) * 0.15})`;
    });
  }

  dispose(): void {
    this.label.removeFromParent();
    this.label.element.remove();
  }
}
