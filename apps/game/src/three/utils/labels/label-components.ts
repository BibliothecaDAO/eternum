import { CameraView } from "../../scenes/camera-view";
import { resolveCameraView } from "./label-view";

/**
 * Create content container with transition wrapper
 */
export const createContentContainer = (inputView: CameraView): HTMLElement & { wrapper: HTMLElement } => {
  const cameraView = resolveCameraView(inputView);
  const wrapperContainer = document.createElement("div");
  wrapperContainer.classList.add("transition-all", "duration-700", "ease-in-out", "overflow-hidden");
  wrapperContainer.setAttribute("data-component", "content-container-wrapper");

  const contentContainer = document.createElement("div");
  contentContainer.classList.add("flex", "flex-col", "w-max");
  contentContainer.setAttribute("data-component", "content-container");

  const spacerDiv = document.createElement("div");
  if (cameraView === CameraView.Medium) {
    spacerDiv.classList.add("w-1");
    contentContainer.classList.add("gap-1");
  } else if (cameraView === CameraView.Close) {
    spacerDiv.classList.add("w-2");
    contentContainer.classList.add("gap-1");
  } else {
    spacerDiv.classList.add("w-2");
  }

  if (cameraView !== CameraView.Far) {
    contentContainer.appendChild(spacerDiv);
  }

  wrapperContainer.appendChild(contentContainer);

  const expandedClasses =
    cameraView === CameraView.Medium
      ? ["max-w-[420px]", "ml-1.5", "opacity-100"]
      : ["max-w-[1000px]", "ml-2", "opacity-100"];
  const collapsedClasses = ["max-w-0", "max-h-0", "h-0", "ml-0", "opacity-0", "pointer-events-none"];

  if (cameraView === CameraView.Far) {
    wrapperContainer.classList.add(...collapsedClasses);
    wrapperContainer.style.setProperty("display", "none");
  } else {
    wrapperContainer.classList.add(...expandedClasses);
  }

  const result = contentContainer as unknown as HTMLElement & { wrapper: HTMLElement };
  result.wrapper = wrapperContainer;
  return result;
};
