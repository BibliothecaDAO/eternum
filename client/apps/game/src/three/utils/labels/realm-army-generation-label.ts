import { CameraView } from "../../scenes/hexagon-scene";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { StructureArmyProduction } from "../../types";
import { resolveCameraView } from "./label-view";

const MAX_VISIBLE_GENERATION_CHIPS = 3;
const SOFT_LABEL_COLOR = "#f6f1e5";
const DISPLAY_DECIMAL_SCALE = 100n;

export const formatArmyProductionPerTick = (outputPerTick: bigint): string => {
  if (outputPerTick <= 0n) {
    return "0";
  }

  const precision = BigInt(RESOURCE_PRECISION);
  const whole = outputPerTick / precision;
  const remainder = outputPerTick % precision;

  if (remainder === 0n) {
    return whole.toString();
  }

  const fractional = (remainder * DISPLAY_DECIMAL_SCALE) / precision;
  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractional.toString().padStart(2, "0").replace(/0+$/, "")}`;
};

const createGenerationChip = (entry: StructureArmyProduction, inputView: CameraView): HTMLElement => {
  const cameraView = resolveCameraView(inputView);
  const chip = document.createElement("div");
  chip.classList.add(
    "flex",
    "items-center",
    "gap-1",
    "rounded",
    "border",
    "border-gold/15",
    "bg-black/35",
    "px-1.5",
    "py-0.5",
  );
  chip.setAttribute("data-role", "realm-army-generation-chip");

  const iconContainer = document.createElement("div");
  iconContainer.classList.add("flex", "items-center", "justify-center", "flex-shrink-0");
  iconContainer.classList.add(...(cameraView === CameraView.Medium ? ["w-3.5", "h-3.5"] : ["w-4", "h-4"]));

  const icon = document.createElement("img");
  icon.src = `/images/resources/${entry.resourceId}.png`;
  icon.classList.add("w-full", "h-full", "object-contain");
  icon.alt = "";
  iconContainer.appendChild(icon);
  chip.appendChild(iconContainer);

  const count = document.createElement("span");
  count.classList.add(cameraView === CameraView.Medium ? "text-[10px]" : "text-xxs", "font-semibold");
  count.style.color = SOFT_LABEL_COLOR;
  count.textContent = `+${formatArmyProductionPerTick(entry.outputPerTick)}/tick`;
  chip.appendChild(count);

  const pending = document.createElement("span");
  pending.classList.add(cameraView === CameraView.Medium ? "text-[10px]" : "text-xxs", "font-medium", "opacity-70");
  pending.style.color = SOFT_LABEL_COLOR;
  pending.textContent = `· ${formatArmyProductionPerTick(entry.outputAmountLeft)}`;
  chip.appendChild(pending);

  return chip;
};

const createRealmArmyGenerationDisplay = (
  activeArmyProduction: StructureArmyProduction[] | undefined,
  inputView: CameraView,
): HTMLElement => {
  const cameraView = resolveCameraView(inputView);
  const container = document.createElement("div");
  container.setAttribute("data-component", "realm-army-generation");
  container.classList.add("flex", "items-center", "flex-wrap", "gap-1");

  const accent = document.createElement("span");
  accent.classList.add(
    "rounded",
    "border",
    "border-gold/20",
    "bg-black/45",
    "px-1.5",
    "py-0.5",
    "font-semibold",
    "uppercase",
    "tracking-[0.14em]",
  );
  accent.classList.add(cameraView === CameraView.Medium ? "text-[9px]" : "text-[10px]");
  accent.textContent = "ARMY GEN";
  accent.style.color = "rgba(251, 191, 36, 0.85)";
  container.appendChild(accent);

  const visibleEntries = (activeArmyProduction ?? []).slice(0, MAX_VISIBLE_GENERATION_CHIPS);
  visibleEntries.forEach((entry) => {
    container.appendChild(createGenerationChip(entry, cameraView));
  });

  const overflowCount = (activeArmyProduction?.length ?? 0) - visibleEntries.length;
  if (overflowCount > 0) {
    const overflow = document.createElement("span");
    overflow.classList.add(
      cameraView === CameraView.Medium ? "text-[10px]" : "text-xxs",
      "font-medium",
      "text-gold/70",
    );
    overflow.textContent = `+${overflowCount}`;
    container.appendChild(overflow);
  }

  return container;
};

const updateRealmArmyGenerationDisplay = (
  container: HTMLElement,
  activeArmyProduction: StructureArmyProduction[] | undefined,
  inputView: CameraView,
): void => {
  const next = createRealmArmyGenerationDisplay(activeArmyProduction, inputView);
  container.className = next.className;
  container.setAttribute("style", next.getAttribute("style") ?? "");
  container.replaceChildren(...Array.from(next.childNodes));
};

export const upsertRealmArmyGenerationDisplay = (input: {
  contentContainer: HTMLElement;
  activeArmyProduction: StructureArmyProduction[] | undefined;
  cameraView: CameraView;
}): void => {
  const existing = input.contentContainer.querySelector(
    '[data-component="realm-army-generation"]',
  ) as HTMLElement | null;
  const hasActiveProduction = Array.isArray(input.activeArmyProduction) && input.activeArmyProduction.length > 0;

  if (!hasActiveProduction) {
    existing?.remove();
    return;
  }

  if (existing) {
    updateRealmArmyGenerationDisplay(existing, input.activeArmyProduction, input.cameraView);
    return;
  }

  const next = createRealmArmyGenerationDisplay(input.activeArmyProduction, input.cameraView);
  const ownerNode = input.contentContainer.querySelector('[data-component="owner"]');

  if (ownerNode && ownerNode.parentElement === input.contentContainer) {
    input.contentContainer.insertBefore(next, ownerNode);
    return;
  }

  input.contentContainer.appendChild(next);
};
