import type { WorldSelectionInput } from "@/runtime/world";

export type WorldSelection = WorldSelectionInput;

/**
 * Redirects to the landing page for world selection.
 * The landing page now handles all world selection and registration.
 */
export const openWorldSelectorModal = (): Promise<WorldSelection> => {
  // Redirect to landing page instead of opening a modal
  window.location.href = "/";
  // Return a never-resolving promise since we're navigating away
  return new Promise(() => {});
};
