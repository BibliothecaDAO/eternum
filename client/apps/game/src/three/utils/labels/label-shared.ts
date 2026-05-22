import { CameraView } from "../../scenes/camera-view";
import { getOwnershipStyle } from "./label-config";
import { resolveCameraView } from "./label-view";

/**
 * Create base label element with common properties
 */
export const createLabelBase = (isMine: boolean, inputView: CameraView, isDaydreamsAgent?: boolean): HTMLElement => {
  const cameraView = resolveCameraView(inputView);
  const labelDiv = document.createElement("div");

  labelDiv.dataset.component = "hover-detail-label";
  labelDiv.classList.add(
    "rounded-md",
    "px-2",
    "py-1.5",
    "-translate-x-1/2",
    "text-[12px]",
    "inline-flex",
    "items-center",
    "gap-2",
    "group",
    "backdrop-blur-md",
    "shadow-[0_10px_28px_rgba(0,0,0,0.38)]",
    "font-semibold",
    "leading-tight",
  );
  labelDiv.style.fontFamily = `"Space Grotesk", ui-sans-serif, system-ui, sans-serif`;

  if (cameraView === CameraView.Medium) {
    labelDiv.classList.add("min-w-[230px]", "max-w-[360px]");
  } else if (cameraView === CameraView.Close) {
    labelDiv.classList.add("min-w-[240px]", "max-w-[380px]");
  }

  if (cameraView === CameraView.Far) {
    labelDiv.classList.remove("inline-flex", "items-center");
    labelDiv.classList.add("flex", "flex-col", "items-center", "justify-center", "gap-1", "min-w-0");
  }

  // Get appropriate style
  const styles = getOwnershipStyle(isMine, isDaydreamsAgent);

  // Apply styles directly
  labelDiv.style.setProperty("background-color", styles.default.backgroundColor!, "important");
  labelDiv.style.setProperty("border", `1px solid ${styles.default.borderColor}`, "important");
  labelDiv.style.setProperty("color", styles.default.textColor!, "important");

  // Add hover effect
  labelDiv.addEventListener("mouseenter", () => {
    labelDiv.style.setProperty("background-color", styles.hover.backgroundColor!, "important");
  });

  labelDiv.addEventListener("mouseleave", () => {
    labelDiv.style.setProperty("background-color", styles.default.backgroundColor!, "important");
  });

  // Prevent right click
  labelDiv.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  return labelDiv;
};

export const attachDirectionIndicators = (
  labelElement: HTMLElement,
  directionIndicators: HTMLElement | null,
  cameraView: CameraView,
): void => {
  if (!directionIndicators) {
    return;
  }

  const existing = labelElement.querySelector('[data-component="direction-indicators"]');
  if (existing && existing !== directionIndicators) {
    existing.remove();
  }

  const offsetClass = cameraView === CameraView.Close ? "mt-1.5" : "mt-1";
  const textSizeClass = cameraView === CameraView.Close ? "text-[11px]" : "text-[10px]";

  directionIndicators.classList.remove("ml-2", "w-full", "mt-1", "px-2");
  directionIndicators.classList.add(
    "absolute",
    "left-1/2",
    "-translate-x-1/2",
    "top-full",
    offsetClass,
    "px-2.5",
    "py-0.5",
    "rounded-full",
    "bg-black/40",
    "border",
    "border-white/10",
    "shadow-sm",
    "backdrop-blur-sm",
    "flex",
    "items-center",
    "gap-1.5",
    textSizeClass,
  );

  labelElement.classList.add("relative", "overflow-visible");
  labelElement.appendChild(directionIndicators);
};
