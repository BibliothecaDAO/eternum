/**
 * An entity whose presentation cannot be built (a kind the client does not know, a keyed lookup that misses) is left
 * out of what is drawn, and only it: the rest of the world still renders and the entry carries on. The miss is loud:
 * one console error naming the model, the entity and why, and in development an uncaught error, thrown on its own turn
 * so the overlay shows it without breaking the loop that met it. Nothing renders a guess in its place.
 */
export const presentOrSkip = <T>(
  model: string,
  entityId: number,
  build: () => T | undefined,
  onMiss?: () => void,
): T | undefined => {
  try {
    return build();
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    console.error("presentation_miss", { model, entityId, error: error.message });
    onMiss?.();
    if (import.meta.env.DEV) {
      setTimeout(() => {
        throw new Error(`${model} ${entityId} is not drawn: ${error.message}`, { cause: error });
      });
    }
    return undefined;
  }
};
