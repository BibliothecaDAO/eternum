/**
 * Entity-like object that has a models property.
 */
export interface EntityWithModels {
  models: Record<string, unknown>;
}

/**
 * Checks if the given entity represents a Torii deletion notification.
 *
 * A deletion is detected when:
 * - The models object is missing or empty
 * - Every top-level model has an empty object as its value
 */
export function isToriiDeleteNotification(entity: EntityWithModels): boolean {
  if (!entity.models || Object.keys(entity.models).length === 0) {
    return true;
  }
  // Deletion if every top-level model has empty object as its value.
  return Object.values(entity.models).every(
    (model) => model && typeof model === "object" && Object.keys(model).length === 0,
  );
}
