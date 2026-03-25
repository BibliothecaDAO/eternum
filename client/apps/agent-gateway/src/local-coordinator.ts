import { AgentCoordinatorDO } from "./coordinator/agent-coordinator";
import type {
  DurableObjectNamespaceLike,
  DurableObjectStateLike,
  DurableObjectStorageLike,
  DurableObjectStubLike,
} from "./types";

class InMemoryStorage implements DurableObjectStorageLike {
  private readonly values = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }
}

class InMemoryState implements DurableObjectStateLike {
  storage = new InMemoryStorage();
}

class LocalCoordinatorStub implements DurableObjectStubLike {
  constructor(private readonly coordinator: AgentCoordinatorDO) {}

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : new Request(String(input), init);
    return this.coordinator.fetch(request);
  }
}

class LocalCoordinatorNamespace implements DurableObjectNamespaceLike {
  private readonly coordinators = new Map<string, LocalCoordinatorStub>();

  idFromName(name: string) {
    return name;
  }

  get(id: unknown): DurableObjectStubLike {
    const key = String(id);
    let stub = this.coordinators.get(key);
    if (!stub) {
      stub = new LocalCoordinatorStub(new AgentCoordinatorDO(new InMemoryState()));
      this.coordinators.set(key, stub);
    }
    return stub;
  }
}

let localNamespace: DurableObjectNamespaceLike | null = null;

export function getLocalCoordinatorNamespace(): DurableObjectNamespaceLike {
  if (!localNamespace) {
    localNamespace = new LocalCoordinatorNamespace();
  }

  return localNamespace;
}
