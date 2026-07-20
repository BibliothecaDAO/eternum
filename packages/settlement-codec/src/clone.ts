export function cloneProtocolValue<T>(value: T): T {
  return structuredClone(value);
}

export function freezeProtocolValue<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;

  for (const nestedValue of Object.values(value)) freezeProtocolValue(nestedValue);
  return Object.freeze(value);
}
