import { ResourcesIds } from "@bibliothecadao/types";
import { Scene, Vector3 } from "three";
import { CSS2DObject } from "three-stdlib";

export type HexHoverLabelContent =
  | {
      kind: "resource";
      buildingName: string;
      resourceId: ResourcesIds;
      resourceName: string;
      isActive: boolean;
    }
  | {
      kind: "building";
      buildingName: string;
    };

export class HexHoverLabel {
  private label: CSS2DObject | null = null;
  private element: HTMLElement | null = null;

  constructor(private readonly scene: Scene) {}

  update(position: Vector3, content: HexHoverLabelContent): void {
    const labelPosition = position.clone();
    labelPosition.y += 1;

    if (!this.label || !this.element) {
      const element = this.createElement(content);
      this.label = new CSS2DObject(element);
      this.label.name = "hex-hover-label";
      this.element = element;
      this.scene.add(this.label);
    } else {
      this.populateElement(this.element, content);
    }

    this.label.position.copy(labelPosition);
  }

  clear(): void {
    if (!this.label) {
      return;
    }

    this.scene.remove(this.label);

    const element = this.label.element as HTMLElement | undefined;
    if (element?.parentElement) {
      element.parentElement.removeChild(element);
    }

    this.label = null;
    this.element = null;
  }

  public hasActiveLabel(): boolean {
    return this.label !== null;
  }

  private createElement(content: HexHoverLabelContent): HTMLElement {
    const container = document.createElement("div");
    container.classList.add(
      "inline-flex",
      "items-start",
      "gap-2",
      "px-2",
      "py-1",
      "rounded-md",
      "bg-brown/80",
      "border",
      "border-gold/40",
      "text-gold",
      "text-xs",
      "shadow-md",
      "backdrop-blur-sm",
      "-translate-x-1/2",
    );
    container.style.pointerEvents = "none";
    container.setAttribute("data-label-type", "hex-hover");

    this.populateElement(container, content);

    return container;
  }

  private populateElement(container: HTMLElement, content: HexHoverLabelContent): void {
    container.dataset.kind = content.kind;
    container.dataset.buildingName = content.buildingName;

    if (content.kind === "resource") {
      container.dataset.resourceId = content.resourceId.toString();
      container.dataset.status = content.isActive ? "active" : "paused";
    } else {
      delete container.dataset.resourceId;
      delete container.dataset.status;
    }

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (content.kind === "resource") {
      const icon = document.createElement("img");
      icon.src = `/images/resources/${content.resourceId}.png`;
      icon.alt = content.resourceName || "Resource";
      icon.classList.add("w-5", "h-5", "object-contain");
      container.appendChild(icon);
    }

    const textWrapper = document.createElement("div");
    textWrapper.classList.add("flex", "flex-col", "gap-0.5", "whitespace-nowrap");

    const title = document.createElement("span");
    title.textContent = content.buildingName;
    title.classList.add("font-semibold", "text-sm");
    textWrapper.appendChild(title);

    if (content.kind === "resource") {
      const statusRow = document.createElement("div");
      statusRow.classList.add("flex", "items-center", "gap-1");

      const productionText = document.createElement("span");
      productionText.textContent = content.resourceName ? `Producing ${content.resourceName}` : "Producing";
      statusRow.appendChild(productionText);

      const separator = document.createElement("span");
      separator.textContent = "—";
      statusRow.appendChild(separator);

      const status = document.createElement("span");
      status.textContent = content.isActive ? "Active" : "Paused";
      status.classList.add("font-semibold");
      status.classList.add(content.isActive ? "text-order-brilliance" : "text-order-giants");
      statusRow.appendChild(status);

      textWrapper.appendChild(statusRow);
    }

    container.appendChild(textWrapper);
  }
}
