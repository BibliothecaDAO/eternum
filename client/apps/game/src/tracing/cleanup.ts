export const cleanupTracing = async () => {
  const module = await import("./index");
  await module.cleanupTracing();
};
