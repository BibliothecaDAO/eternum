import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToriiAvailabilityService } from "../torii-availability";

const mockFetch = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  mockFetch.mockReset();
  vi.restoreAllMocks();
});

describe("ToriiAvailabilityService", () => {
  describe("probeWorld", () => {
    it("returns true when the torii endpoint responds with 200", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      const alive = await service.probeWorld("my-world");

      expect(alive).toBe(true);
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.cartridge.gg/x/my-world/torii/sql");
      expect((opts as RequestInit).method).toBe("HEAD");
    });

    it("returns false when the torii endpoint responds with 404", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      const alive = await service.probeWorld("dead-world");

      expect(alive).toBe(false);
    });

    it("returns false when the torii endpoint responds with 500", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      const alive = await service.probeWorld("error-world");

      expect(alive).toBe(false);
    });

    it("returns false when fetch throws a network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      const alive = await service.probeWorld("unreachable-world");

      expect(alive).toBe(false);
    });

    it("returns false when fetch throws an abort/timeout error", async () => {
      const abortError = new DOMException("signal timed out", "AbortError");
      mockFetch.mockRejectedValueOnce(abortError);

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      const alive = await service.probeWorld("slow-world");

      expect(alive).toBe(false);
    });
  });

  describe("getAvailability", () => {
    it("returns an empty map when no probes have run", () => {
      const service = new ToriiAvailabilityService({ factoryChains: [] });
      expect(service.getAvailability()).toEqual({});
    });

    it("returns cached availability after probes", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      await service.probeWorld("alive-world");
      await service.probeWorld("dead-world");

      const availability = service.getAvailability();
      expect(availability["alive-world"]).toBe(true);
      expect(availability["dead-world"]).toBe(false);
    });
  });

  describe("pollOnce", () => {
    it("fetches world names from factory and probes each", async () => {
      // Factory returns flat array of objects with name felts
      // The felt for "alpha" is 0x616c706861
      // The felt for "beta" is 0x62657461
      const factoryResponse = [
        { name: "0x616c706861", address: "0xabc" },
        { name: "0x62657461", address: "0xdef" },
      ];

      mockFetch.mockImplementation(async (url, _opts) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;

        if (urlStr.includes("eternum-factory")) {
          return new Response(JSON.stringify(factoryResponse), { status: 200 });
        }
        // Probe requests: alpha alive, beta dead
        if (urlStr.includes("/x/alpha/torii")) {
          return new Response(null, { status: 200 });
        }
        if (urlStr.includes("/x/beta/torii")) {
          return new Response(null, { status: 404 });
        }
        return new Response(null, { status: 500 });
      });

      const service = new ToriiAvailabilityService({ factoryChains: ["mainnet"] });
      await service.pollOnce();

      const availability = service.getAvailability();
      expect(availability["alpha"]).toBe(true);
      expect(availability["beta"]).toBe(false);

      const factoryCall = mockFetch.mock.calls.find(([url]) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
        return urlStr.includes("/x/eternum-factory-mainnet/torii/sql");
      });
      expect(factoryCall).toBeDefined();
    });

    it("handles factory fetch failure gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("network down"));

      const service = new ToriiAvailabilityService({ factoryChains: ["mainnet"] });
      // Should not throw
      await service.pollOnce();

      expect(service.getAvailability()).toEqual({});
    });

    it("handles factory returning empty results", async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

      const service = new ToriiAvailabilityService({ factoryChains: ["mainnet"] });
      await service.pollOnce();

      expect(service.getAvailability()).toEqual({});
    });

    it("deduplicates world names across chains", async () => {
      const factoryResponse = [{ name: "0x616c706861", address: "0xabc" }];

      let probeCount = 0;
      mockFetch.mockImplementation(async (url, opts) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;

        if (urlStr.includes("eternum-factory")) {
          return new Response(JSON.stringify(factoryResponse), { status: 200 });
        }
        if ((opts as RequestInit)?.method === "HEAD") {
          probeCount++;
          return new Response(null, { status: 200 });
        }
        return new Response(null, { status: 500 });
      });

      const service = new ToriiAvailabilityService({ factoryChains: ["mainnet", "slot"] });
      await service.pollOnce();

      // "alpha" appears in both chains but should only be probed once
      expect(probeCount).toBe(1);
      expect(service.getAvailability()["alpha"]).toBe(true);
    });
  });

  describe("start / stop", () => {
    it("starts polling and can be stopped", async () => {
      vi.useFakeTimers();

      mockFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 })));

      const service = new ToriiAvailabilityService({
        factoryChains: ["mainnet"],
        pollIntervalMs: 1000,
      });

      service.start();

      // The initial pollOnce is called immediately
      await vi.advanceTimersByTimeAsync(0);

      // Advance by one interval
      await vi.advanceTimersByTimeAsync(1000);

      service.stop();

      // Calls: initial poll (1 factory fetch) + interval poll (1 factory fetch)
      const factoryCalls = mockFetch.mock.calls.filter(([url]) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
        return urlStr.includes("eternum-factory");
      });
      expect(factoryCalls.length).toBe(2);

      vi.useRealTimers();
    });

    it("does not start a second poll while the previous cycle is still running", async () => {
      vi.useFakeTimers();

      const factoryFetchControl: { resolve: ((value: Response) => void) | null } = {
        resolve: null,
      };
      const factoryFetch = new Promise<Response>((resolve) => {
        factoryFetchControl.resolve = resolve;
      });

      mockFetch.mockImplementation(() => factoryFetch);

      const service = new ToriiAvailabilityService({
        factoryChains: ["mainnet"],
        pollIntervalMs: 1000,
      });

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const resolvePendingFactoryFetch = factoryFetchControl.resolve;
      if (!resolvePendingFactoryFetch) {
        throw new Error("Expected the factory fetch resolver to be assigned");
      }
      resolvePendingFactoryFetch(new Response(JSON.stringify([]), { status: 200 }));
      await Promise.resolve();
      service.stop();
      vi.useRealTimers();
    });

    it("stop is safe to call when not started", () => {
      const service = new ToriiAvailabilityService({ factoryChains: [] });
      expect(() => service.stop()).not.toThrow();
    });
  });
});
