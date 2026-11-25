export const MODEL_LOAD_WARNING_MS = 60_000;

export function warnIfModelLoadStalls<T>(load: Promise<T>, modelName: string): Promise<T> {
  const warning = setTimeout(() => {
    console.warn(`[ModelLoad] ${modelName} has not loaded after ${MODEL_LOAD_WARNING_MS / 1000}s`);
  }, MODEL_LOAD_WARNING_MS);
  return load.finally(() => clearTimeout(warning));
}
