const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads the numeric-key record emitted by starknet.js for a Cairo tuple. */
export const cairoTupleMembers = (value: unknown, memberCount: number): unknown[] => {
  if (!isRecord(value)) throw new Error(`Cairo tuple must contain ${memberCount} numeric-key members`);

  const keys = Object.keys(value);
  if (keys.length !== memberCount || keys.some((key, index) => key !== String(index))) {
    throw new Error(`Cairo tuple must contain ${memberCount} numeric-key members`);
  }
  return keys.map((key) => value[key]);
};
