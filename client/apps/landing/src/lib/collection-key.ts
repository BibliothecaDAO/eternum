export function hasCollectionKey<T extends Record<string, unknown>>(
  collections: T,
  key: string,
): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(collections, key);
}
