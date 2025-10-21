import { MissingClassHashError } from "../errors";
import type { ClassMetadata, ClassRegistry, NetworkClassRegistry, SupportedNetwork } from "../types";

type RegistryStore = Record<SupportedNetwork, Record<string, ClassMetadata>>;

const createEmptyStore = (): RegistryStore => ({
  local: {},
  sepolia: {},
  slot: {},
  slottest: {},
  mainnet: {},
});

export class InMemoryClassRegistry implements ClassRegistry {
  private readonly store: RegistryStore;

  constructor(initial?: RegistryStore | NetworkClassRegistry[]) {
    if (Array.isArray(initial)) {
      this.store = createEmptyStore();
      for (const entry of initial) {
        this.store[entry.network] = { ...this.store[entry.network], ...entry.entries };
      }
    } else {
      this.store = initial ? { ...createEmptyStore(), ...initial } : createEmptyStore();
    }
  }

  get(network: SupportedNetwork, id: string): ClassMetadata | undefined {
    return this.store[network]?.[id];
  }

  require(network: SupportedNetwork, id: string): ClassMetadata {
    const entry = this.get(network, id);
    if (!entry) {
      throw new MissingClassHashError(id, network);
    }
    return entry;
  }

  list(network: SupportedNetwork): ClassMetadata[] {
    return Object.values(this.store[network] ?? {});
  }

  set(network: SupportedNetwork, entry: ClassMetadata): void {
    if (!this.store[network]) {
      throw new MissingClassHashError(entry.id, network);
    }
    this.store[network] = {
      ...this.store[network],
      [entry.id]: entry,
    };
  }

  snapshot(): RegistryStore {
    return JSON.parse(JSON.stringify(this.store)) as RegistryStore;
  }
}

export const defaultClassRegistry = new InMemoryClassRegistry();

export const registerClassMetadata = (network: SupportedNetwork, entry: ClassMetadata) => {
  defaultClassRegistry.set(network, entry);
};

export const createClassRegistry = (initial?: RegistryStore | NetworkClassRegistry[]) =>
  new InMemoryClassRegistry(initial);
