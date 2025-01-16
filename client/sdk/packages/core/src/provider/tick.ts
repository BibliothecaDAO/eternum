// Abstract interface for tick provider
export interface TickProvider {
  getCurrentTick(): number;
}

// Default no-op implementation
export class DefaultTickProvider implements TickProvider {
  getCurrentTick(): number {
    return 0; // Safe default
  }
}

// Singleton to manage tick provider
export class TickProviderManager {
  private static instance: TickProvider = new DefaultTickProvider();

  static setProvider(provider: TickProvider) {
    this.instance = provider;
  }

  static getProvider(): TickProvider {
    return this.instance;
  }
}
