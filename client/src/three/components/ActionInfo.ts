import { Vector3, Camera } from "three";
import { EternumGlobalConfig, ResourcesIds, findResourceById } from "@bibliothecadao/eternum";
import { SetupResult } from "@/dojo/setup";
import { ArmyMovementManager } from "@/dojo/modelManager/ArmyMovementManager";
import { divideByPrecision, formatNumber } from "@/ui/utils/utils";

export class ActionInfo {
  private tooltipElement: HTMLElement;
  private isVisible: boolean = false;
  private camera: Camera;
  private lastPosition: Vector3 | null = null;
  private dojo: SetupResult;
  private armyMovementManager: ArmyMovementManager;

  constructor(entityId: number, camera: Camera, dojo: SetupResult) {
    this.dojo = dojo;
    this.camera = camera;
    this.tooltipElement = this.createTooltipElement();
    document.body.appendChild(this.tooltipElement);

    this.armyMovementManager = new ArmyMovementManager(this.dojo, entityId);
  }

  private generateTooltipContent(isExplored: boolean, travelLength: number): string {
    const title = isExplored ? "Travel" : "Explore";
    let content = `<div class="font-bold">${this.createHeadline(title)}</div>`;

    const stamina = this.armyMovementManager.getStamina();
    const food = this.armyMovementManager.getFood();

    if (!isExplored) {
      content += this.createResourceCostElement(
        ResourcesIds.Wheat,
        -EternumGlobalConfig.exploration.wheatBurn,
        food.wheat,
      );
      content += this.createResourceCostElement(
        ResourcesIds.Fish,
        -EternumGlobalConfig.exploration.fishBurn,
        food.fish,
      );
    }

    const staminaCost =
      travelLength * (isExplored ? -EternumGlobalConfig.stamina.travelCost : -EternumGlobalConfig.stamina.exploreCost);
    content += this.createStaminaCostElement(staminaCost, stamina.amount);

    return content;
  }

  private createStaminaCostElement(staminaCost: number, staminaBalance: number): string {
    const balanceColor = staminaBalance < Math.abs(staminaCost) ? "text-red/90" : "text-green/90";

    return `
      <div class="flex flex-row p-1 text-xs">
        <div class="text-lg p-1 pr-3">⚡️</div>
        <div class="flex flex-col">
          <div>
            ${staminaCost} <span class="${balanceColor} font-normal">(${staminaBalance})</span>
          </div>
          <div>Stamina</div>
        </div>
      </div>
    `;
  }

  private getResourceIcon(trait: string): string {
    const resourceName = trait.replace(" ", "").replace("'", "");
    const iconPath = this.getIconPath(resourceName);

    return `<img src="${iconPath}" class="w-6 h-6" alt="${trait}" />`;
  }

  private getIconPath(resourceName: string): string {
    const iconMap: { [key: string]: string } = {
      Adamantine: "/images/resources/20.png",
      AlchemicalSilver: "/images/resources/19.png",
      Coal: "/images/resources/3.png",
      ColdIron: "/images/resources/8.png",
      Copper: "/images/resources/4.png",
      DeepCrystal: "/images/resources/14.png",
      Diamonds: "/images/resources/11.png",
      Dragonhide: "/images/resources/22.png",
      EtherealSilica: "/images/resources/16.png",
      Gold: "/images/resources/9.png",
      Hartwood: "/images/resources/10.png",
      Ignium: "/images/resources/15.png",
      Ironwood: "/images/resources/7.png",
      Mithral: "/images/resources/21.png",
      Obsidian: "/images/resources/5.png",
      Ruby: "/images/resources/13.png",
      Sapphire: "/images/resources/12.png",
      Silver: "/images/resources/6.png",
      Stone: "/images/resources/2.png",
      TrueIce: "/images/resources/17.png",
      TwilightQuartz: "/images/resources/18.png",
      Wood: "/images/resources/1.png",
      Lords: "/images/resources/coin.png",
      Fish: "/images/resources/255.png",
      Wheat: "/images/resources/254.png",
      Donkeys: "/images/buildings/thumb/trade.png",
      Knight: "/images/icons/250.png",
      Crossbowmen: "/images/icons/251.png",
      Paladin: "/images/icons/252.png",
      AncientFragment: "/images/resources/29.png",
    };

    return iconMap[resourceName] || `/images/resources/${ResourcesIds[resourceName as keyof typeof ResourcesIds]}.png`;
  }

  private createResourceCostElement(resourceId: number, amount: number, balance: number): string {
    const trait = findResourceById(resourceId)?.trait || "";
    const balanceValue = divideByPrecision(balance);
    const balanceColor =
      balanceValue !== undefined && balanceValue < Math.abs(amount) ? "text-red/90" : "text-green/90";

    return `
      <div class="relative flex items-center p-2 bg-gold/10 clip-angled-sm gap-1 border border-gold/10">
        <div class="self-center justify-center">${this.getResourceIcon(trait)}</div>
        <div class="relative flex flex-col shrink-0 self-center ml-1 text-left">
          <div class="relative text-xs font-bold">
            ${Intl.NumberFormat("en-US", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(amount || 0)}
            <span class="${balanceColor} font-normal">
              ${!isNaN(balanceValue) ? `(${formatNumber(balanceValue, 0)})` : ""}
            </span>
          </div>
          <div class="text-xs leading-[10px] self-start relative mt-1 font-normal">${trait}</div>
        </div>
      </div>
    `;
  }

  private createHeadline(title: string): string {
    return `
      <div class="flex items-center justify-center select-none w-full clip-angled bg-gold/5 p-2 h6 font-bold">
        <div class="flex flex-1 items-center">
          <svg width="28" height="11" viewBox="0 0 28 11" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M16.4904 0.0869133C16.6528 -0.0260537 16.8657 -0.02914 17.0312 0.0790727L21.5655 3.04357L27.6586 5.02363C27.8619 5.08971 28 5.28237 28 5.50003C28 5.71769 27.8619 5.91034 27.6586 5.97642L21.5655 7.95643L17.0312 10.9209C16.8657 11.0291 16.6528 11.0261 16.4904 10.9131L10.2378 6.56457C10.1474 6.60177 10.0348 6.64764 9.90422 6.69985C9.54862 6.84209 9.05874 7.03201 8.52268 7.22223C7.98763 7.41209 7.40094 7.60427 6.85296 7.74954C6.31492 7.89218 5.77689 8 5.35361 8C4.90802 8 4.35917 7.84984 3.82741 7.65921C3.28224 7.46377 2.70219 7.20587 2.17575 6.95204C1.64799 6.69756 1.16679 6.44361 0.817914 6.25353C0.643277 6.15839 0.501316 6.07898 0.402691 6.02317C0.353368 5.99527 0.314853 5.97324 0.288477 5.95808L0.258173 5.94061L0.250153 5.93596L0.247168 5.93423L0.490281 5.50003C0.24705 5.0659 0.247976 5.06536 0.247976 5.06536L0.250147 5.06409L0.258167 5.05945L0.288471 5.04197C0.314848 5.02681 0.353362 5.00479 0.402687 4.97688C0.501312 4.92107 0.643272 4.84167 0.817908 4.74652C1.16679 4.55643 1.64798 4.30247 2.17575 4.04799C2.70219 3.79415 3.28224 3.53625 3.82741 3.3408C4.35917 3.15016 4.90802 3 5.35361 3C5.77689 3 6.31492 3.10782 6.85296 3.25046C7.40094 3.39573 7.98763 3.58791 8.52268 3.77777C9.05874 3.96799 9.54861 4.15791 9.90422 4.30015C10.0347 4.35236 10.1474 4.39823 10.2378 4.43543L16.4904 0.0869133ZM18.1408 5.50001C18.1408 6.32844 17.4822 7.00001 16.6699 7.00001C15.8576 7.00001 15.1991 6.32844 15.1991 5.50001C15.1991 4.67158 15.8576 4.00001 16.6699 4.00001C17.4822 4.00001 18.1408 4.67158 18.1408 5.50001ZM5.39344 6.50001C5.93499 6.50001 6.374 6.05229 6.374 5.50001C6.374 4.94772 5.93499 4.50001 5.39344 4.50001C4.85189 4.50001 4.41288 4.94772 4.41288 5.50001C4.41288 6.05229 4.85189 6.50001 5.39344 6.50001Z"
              class="fill-gold/40"
            />
            <path
              d="M0.490281 5.50003L0.24705 5.0659C0.0942805 5.15492 -1.88563e-06 5.32059 0 5.50003C1.88569e-06 5.67947 0.0943984 5.84521 0.247168 5.93423C0.247168 5.93423 0.247054 5.93416 0.490281 5.50003Z"
              class="fill-gold/40"
            />
          </svg>
          <div class="h-[1px] flex-1 bg-gold/40"></div>
          <svg width="5" height="5" viewBox="0 0 5 5" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M2.463 2.55045e-07L5 2.5L2.463 5L-2.5828e-07 2.5L2.463 2.55045e-07Z"
              class="fill-gold/40"
            />
          </svg>
        </div>
        <div class="mx-6 whitespace-nowrap">${title}</div>
        <div class="flex flex-1 items-center">
          <svg width="5" height="5" viewBox="0 0 5 5" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M2.463 2.55045e-07L5 2.5L2.463 5L-2.5828e-07 2.5L2.463 2.55045e-07Z"
              class="fill-gold/40"
            />
          </svg>
          <div class="h-[1px] flex-1 bg-gold/40"></div>
          <svg
            class="-scale-x-100"
            width="28"
            height="11"
            viewBox="0 0 28 11"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M16.4904 0.0869133C16.6528 -0.0260537 16.8657 -0.02914 17.0312 0.0790727L21.5655 3.04357L27.6586 5.02363C27.8619 5.08971 28 5.28237 28 5.50003C28 5.71769 27.8619 5.91034 27.6586 5.97642L21.5655 7.95643L17.0312 10.9209C16.8657 11.0291 16.6528 11.0261 16.4904 10.9131L10.2378 6.56457C10.1474 6.60177 10.0348 6.64764 9.90422 6.69985C9.54862 6.84209 9.05874 7.03201 8.52268 7.22223C7.98763 7.41209 7.40094 7.60427 6.85296 7.74954C6.31492 7.89218 5.77689 8 5.35361 8C4.90802 8 4.35917 7.84984 3.82741 7.65921C3.28224 7.46377 2.70219 7.20587 2.17575 6.95204C1.64799 6.69756 1.16679 6.44361 0.817914 6.25353C0.643277 6.15839 0.501316 6.07898 0.402691 6.02317C0.353368 5.99527 0.314853 5.97324 0.288477 5.95808L0.258173 5.94061L0.250153 5.93596L0.247168 5.93423L0.490281 5.50003C0.24705 5.0659 0.247976 5.06536 0.247976 5.06536L0.250147 5.06409L0.258167 5.05945L0.288471 5.04197C0.314848 5.02681 0.353362 5.00479 0.402687 4.97688C0.501312 4.92107 0.643272 4.84167 0.817908 4.74652C1.16679 4.55643 1.64798 4.30247 2.17575 4.04799C2.70219 3.79415 3.28224 3.53625 3.82741 3.3408C4.35917 3.15016 4.90802 3 5.35361 3C5.77689 3 6.31492 3.10782 6.85296 3.25046C7.40094 3.39573 7.98763 3.58791 8.52268 3.77777C9.05874 3.96799 9.54861 4.15791 9.90422 4.30015C10.0347 4.35236 10.1474 4.39823 10.2378 4.43543L16.4904 0.0869133ZM18.1408 5.50001C18.1408 6.32844 17.4822 7.00001 16.6699 7.00001C15.8576 7.00001 15.1991 6.32844 15.1991 5.50001C15.1991 4.67158 15.8576 4.00001 16.6699 4.00001C17.4822 4.00001 18.1408 4.67158 18.1408 5.50001ZM5.39344 6.50001C5.93499 6.50001 6.374 6.05229 6.374 5.50001C6.374 4.94772 5.93499 4.50001 5.39344 4.50001C4.85189 4.50001 4.41288 4.94772 4.41288 5.50001C4.41288 6.05229 4.85189 6.50001 5.39344 6.50001Z"
              class="fill-gold/40"
            />
            <path
              d="M0.490281 5.50003L0.24705 5.0659C0.0942805 5.15492 -1.88563e-06 5.32059 0 5.50003C1.88569e-06 5.67947 0.0943984 5.84521 0.247168 5.93423C0.247168 5.93423 0.247054 5.93416 0.490281 5.50003Z"
              fill="#CAB1A6"
            />
          </svg>
        </div>
      </div>
    `;
  }

  showTooltip(position: Vector3, isExplored: boolean, travelLength: number, selectedEntity: number) {
    if (this.lastPosition && this.lastPosition.equals(position)) {
      return;
    }

    this.hideTooltip();
    this.isVisible = true;

    this.tooltipElement.innerHTML = this.generateTooltipContent(isExplored, travelLength, selectedEntity);
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
