import { Vector3, Scene, Camera } from "three";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";

export class ActionInfo {
  private tooltipElement: HTMLElement;
  private isVisible: boolean = false;
  private camera: Camera;
  private lastPosition: Vector3 | null = null;

  constructor(camera: Camera) {
    this.camera = camera;
    this.tooltipElement = this.createTooltipElement();
    document.body.appendChild(this.tooltipElement);
  }

  private generateTooltipContent(
    isExplored: boolean,
    travelLength: number,
    wheatBalance: number,
    fishBalance: number,
  ): string {
    const title = isExplored ? "Travel" : "Explore";
    let content = `<div class="font-bold">${title}</div>`;

    if (!isExplored) {
      const wheatCost = -EternumGlobalConfig.exploration.wheatBurn;
      const fishCost = -EternumGlobalConfig.exploration.fishBurn;
      content += `
        <div class="resource-cost flex items-center">
          <span>${wheatCost} (${wheatBalance})</span>
        </div>
        <div class="resource-cost flex items-center">
          <span>${fishCost} (${fishBalance})</span>
        </div>
      `;
    }
    content += `
      <div class="resource-cost flex items-center">
        <span>-${travelLength}</span>
      </div>
    `;

    return content;
  }

  showTooltip(position: Vector3, isExplored: boolean, travelLength: number, wheatBalance: number, fishBalance: number) {
    if (this.lastPosition && this.lastPosition.equals(position)) {
      return;
    }

    this.hideTooltip();
    this.isVisible = true;

    this.tooltipElement.innerHTML = this.generateTooltipContent(isExplored, travelLength, wheatBalance, fishBalance);
    this.updateTooltipPosition(position);
    this.tooltipElement.style.display = "block";
    this.lastPosition = position.clone();
  }

  hideTooltip() {
    if (this.isVisible) {
      this.tooltipElement.style.display = "none";
      this.isVisible = false;
      this.lastPosition = null;
    }
  }

  private createTooltipElement(): HTMLElement {
    const element = document.createElement("div");
    element.className = "action-info-tooltip min-w-[150px] clip-angled relative p-2 bg-brown/90 text-gold";
    element.style.position = "absolute";
    element.style.display = "none";
    element.style.pointerEvents = "none";
    element.style.transform = "translate(-50%, -130%)"; // Center horizontally and position above the point

    // Add the arrow
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("class", "absolute bottom-[1px] translate-y-full left-1/2 -translate-x-1/2");
    arrow.setAttribute("width", "30");
    arrow.setAttribute("height", "13");
    arrow.setAttribute("viewBox", "0 0 30 13");
    arrow.setAttribute("fill", "none");
    arrow.innerHTML =
      '<path d="M15.0003 12.75L0.751603 -3.445e-06L29.249 9.53674e-07L15.0003 12.75Z" fill="fill-dark-brown" />';
    element.appendChild(arrow);

    return element;
  }
  private updateTooltipPosition(position: Vector3) {
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
    const pos = position.clone().project(this.camera);
    const x = pos.x * widthHalf + widthHalf;
    const y = -(pos.y * heightHalf) + heightHalf;

    this.tooltipElement.style.left = `${x}px`;
    this.tooltipElement.style.top = `${y}px`;
  }
}
