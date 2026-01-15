class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const memoryStorage = new MemoryStorage();

const isCartridgeHostname = (hostname: string | null | undefined): boolean => {
  if (!hostname) return false;
  return hostname === "x.cartridge.gg" || hostname.endsWith(".cartridge.gg");
};

export const isCartridgeEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  return isCartridgeHostname(window.location.hostname);
};

export const getSafeLocalStorage = (): Storage => {
  if (typeof window === "undefined") return memoryStorage;
  try {
    if (isCartridgeEnvironment()) {
      return memoryStorage;
    }
    return window.localStorage;
  } catch {
    return memoryStorage;
  }
};

export const safeLocalStorage: Storage = {
  get length() {
    return getSafeLocalStorage().length;
  },
  clear() {
    getSafeLocalStorage().clear();
  },
  getItem(key: string) {
    return getSafeLocalStorage().getItem(key);
  },
  key(index: number) {
    return getSafeLocalStorage().key(index);
  },
  removeItem(key: string) {
    getSafeLocalStorage().removeItem(key);
  },
  setItem(key: string, value: string) {
    getSafeLocalStorage().setItem(key, value);
  },
};
