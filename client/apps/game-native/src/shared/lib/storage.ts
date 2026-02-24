import AsyncStorage from '@react-native-async-storage/async-storage';

class StorageAdapter {
  private cache: Map<string, string> = new Map();
  private _initialized = false;

  get initialized() {
    return this._initialized;
  }

  async init(): Promise<void> {
    if (this._initialized) {
      return;
    }
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [key, value] of pairs) {
        if (value !== null) {
          this.cache.set(key, value);
        }
      }
    }
    this._initialized = true;
  }

  getItem(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.cache.set(key, value);
    AsyncStorage.setItem(key, value).catch(console.warn);
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    AsyncStorage.removeItem(key).catch(console.warn);
  }

  clear(): void {
    this.cache.clear();
    AsyncStorage.clear().catch(console.warn);
  }

  get length(): number {
    return this.cache.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.cache.keys());
    return keys[index] ?? null;
  }
}

export const storage = new StorageAdapter();
