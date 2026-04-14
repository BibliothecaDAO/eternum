// Test setup bootstrap for Vitest.
// Intentionally minimal; per-suite setup should live alongside tests.

if (typeof globalThis.ProgressEvent === "undefined") {
  class TestProgressEvent extends Event {
    public readonly lengthComputable: boolean;
    public readonly loaded: number;
    public readonly total: number;

    constructor(type: string, init: ProgressEventInit = {}) {
      super(type);
      this.lengthComputable = init.lengthComputable ?? false;
      this.loaded = init.loaded ?? 0;
      this.total = init.total ?? 0;
    }
  }

  Object.defineProperty(globalThis, "ProgressEvent", {
    configurable: true,
    value: TestProgressEvent,
  });
}
