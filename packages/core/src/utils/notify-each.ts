/** Each reader on its own: one that throws is reported under its owner, and every other reader still hears the change. */
export function notifyEach<T>(owner: string, listeners: Iterable<(value: T) => void>, value: T): void {
  for (const listener of listeners) {
    try {
      listener(value);
    } catch (error) {
      console.error(`[${owner}] reader failed:`, error);
    }
  }
}
