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
    it("returns true when the torii endpoint responds with 200 and fires the summary fetch", async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      const alive = await service.probeWorld("my-world");

      expect(alive).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [headUrl, headOpts] = mockFetch.mock.calls[0]!;
      expect(headUrl).toBe("https://api.cartridge.gg/x/my-world/torii/sql");
      expect((headOpts as RequestInit).method).toBe("HEAD");
      const [summaryUrl] = mockFetch.mock.calls[1]!;
      const summaryUrlStr =
        typeof summaryUrl === "string"
          ? summaryUrl
          : summaryUrl instanceof URL
            ? summaryUrl.toString()
            : (summaryUrl as Request).url;
      expect(summaryUrlStr).toMatch(/^https:\/\/api\.cartridge\.gg\/x\/my-world\/torii\/sql\?query=/);
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

      const service = new ToriiAvailabilityService({ factoryChains: ["mainnet", "appchain"] });
      await service.pollOnce();

      // "alpha" appears in both chains but should only be probed once
      expect(probeCount).toBe(1);
      expect(service.getAvailability()["alpha"]).toBe(true);
    });
  });

  describe("summary folding", () => {
    const blitzSummaryRow = {
      blitz_mode_on: 1,
      start_settling_at: "0x65b0fde0",
      start_main_at: "0x65b1ffe0",
      end_at: "0x65b2ffe0",
      dev_mode_on: 0,
      mmr_enabled: 1,
      registration_count: 3,
      registration_count_max: 10,
      entry_token_address: null,
      fee_token: "0xabcd",
      fee_amount: "0xff",
      registration_start_at: "0x65b0fde0",
      max_ring_count: 1,
      single_realm_mode: 0,
      two_player_mode: 1,
      season_pass_address: null,
      village_pass_token_address: null,
      settled_players_count: null,
      settled_realms_count: null,
      settled_villages_count: null,
      hyperstructure_created_count: 0,
    };

    it("fetches summary for alive worlds and exposes getSummaries()", async () => {
      const factoryResponse = [{ name: "0x616c706861", address: "0xabc" }]; // "alpha"

      mockFetch.mockImplementation(async (url, opts) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
        if (urlStr.includes("eternum-factory")) {
          return new Response(JSON.stringify(factoryResponse), { status: 200 });
        }
        const method = (opts as RequestInit)?.method;
        if (method === "HEAD" && urlStr.includes("/x/alpha/torii/sql")) {
          return new Response(null, { status: 200 });
        }
        if (urlStr.includes("/x/alpha/torii/sql?query=")) {
          return new Response(JSON.stringify([blitzSummaryRow]), { status: 200 });
        }
        return new Response(null, { status: 500 });
      });

      const service = new ToriiAvailabilityService({ factoryChains: ["mainnet"] });
      await service.pollOnce();

      const summaries = service.getSummaries();
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        name: "alpha",
        chain: "mainnet",
        alive: true,
        worldAddress: "0xabc",
        mode: "blitz",
        registrationCount: 3,
        startMainAt: 0x65b1ffe0,
      });
    });

    it("preserves the last good summary when a later summary fetch fails", async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200 })) // probe 1: HEAD
        .mockResolvedValueOnce(new Response(JSON.stringify([blitzSummaryRow]), { status: 200 })) // probe 1: summary
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: ["0x64", "0x0"] }), { status: 200 }),
        ) // probe 1: jackpot
        .mockResolvedValueOnce(new Response(null, { status: 200 })) // probe 2: HEAD
        .mockResolvedValueOnce(new Response(null, { status: 500 })) // probe 2: summary fails
        .mockResolvedValueOnce(new Response(null, { status: 500 })); // probe 2: jackpot fails

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      await service.probeWorld("alpha", "mainnet", "0xprize", "0xabc");
      await service.probeWorld("alpha", "mainnet", "0xprize", "0xabc");

      const [summary] = service.getSummaries();
      expect(summary).toMatchObject({
        name: "alpha",
        alive: true,
        mode: "blitz",
        startMainAt: 0x65b1ffe0,
        prizeDistributionAddress: "0xprize",
        worldAddress: "0xabc",
        // Jackpot from probe 1 is preserved when probe 2's RPC call fails.
        winnerJackpotAmount: "100",
      });
    });

    it("folds the mainnet jackpot balance into the summary via one RPC call", async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200 })) // HEAD
        .mockResolvedValueOnce(new Response(JSON.stringify([blitzSummaryRow]), { status: 200 })) // summary
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: ["0xff", "0x0"] }), { status: 200 }),
        ); // jackpot

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      await service.probeWorld("alpha", "mainnet", "0xprize", "0xabc");

      expect(mockFetch).toHaveBeenCalledTimes(3);
      const [rpcUrl, rpcOpts] = mockFetch.mock.calls[2]!;
      expect(rpcUrl).toBe("https://api.cartridge.gg/x/starknet/mainnet");
      const body = JSON.parse((rpcOpts as RequestInit).body as string);
      expect(body.method).toBe("starknet_call");
      expect(body.params.request.contract_address).toBe("0xabcd");
      expect(body.params.request.calldata).toEqual(["0xprize"]);

      const [summary] = service.getSummaries();
      expect(summary?.winnerJackpotAmount).toBe("255");
    });

    it("does not fetch the jackpot for non-mainnet worlds", async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(null, { status: 200 })) // HEAD
        .mockResolvedValueOnce(new Response(JSON.stringify([blitzSummaryRow]), { status: 200 })); // summary

      const service = new ToriiAvailabilityService({ factoryChains: [] });
      await service.probeWorld("alpha", "appchain", "0xprize", "0xabc");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [summary] = service.getSummaries();
      expect(summary?.winnerJackpotAmount).toBeNull();
    });

    it("does not fetch summary for dead worlds", async () => {
      const factoryResponse = [{ name: "0x6465616432", address: "0xabc" }]; // "dead2"

      let summaryCallCount = 0;
      mockFetch.mockImplementation(async (url, opts) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
        if (urlStr.includes("eternum-factory")) {
          return new Response(JSON.stringify(factoryResponse), { status: 200 });
        }
        const method = (opts as RequestInit)?.method;
        if (method === "HEAD") {
          return new Response(null, { status: 503 });
        }
        if (urlStr.includes("?query=")) {
          summaryCallCount++;
        }
        return new Response(null, { status: 500 });
      });

      const service = new ToriiAvailabilityService({ factoryChains: ["mainnet"] });
      await service.pollOnce();

      expect(summaryCallCount).toBe(0);
      const summaries = service.getSummaries();
      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        name: "dead2",
        chain: "mainnet",
        alive: false,
        mode: null,
      });
    });

    it("tolerates summary-fetch failure while keeping world alive", async () => {
      const factoryResponse = [{ name: "0x616c706861", address: "0xabc" }];

      mockFetch.mockImplementation(async (url, opts) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
        if (urlStr.includes("eternum-factory")) {
          return new Response(JSON.stringify(factoryResponse), { status: 200 });
        }
        const method = (opts as RequestInit)?.method;
        if (method === "HEAD") {
          return new Response(null, { status: 200 });
        }
        if (urlStr.includes("?query=")) {
          return new Response(null, { status: 500 });
        }
        return new Response(null, { status: 500 });
      });

      const service = new ToriiAvailabilityService({ factoryChains: ["mainnet"] });
      await service.pollOnce();

      const summaries = service.getSummaries();
      expect(summaries[0]).toMatchObject({
        name: "alpha",
        alive: true,
        mode: null,
        startMainAt: null,
      });
    });

    it("preserves getAvailability() backcompat (name → boolean map)", async () => {
      const factoryResponse = [
        { name: "0x616c706861", address: "0xabc" }, // alpha
        { name: "0x62657461", address: "0xdef" }, // beta
      ];

      mockFetch.mockImplementation(async (url, opts) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
        if (urlStr.includes("eternum-factory")) {
          return new Response(JSON.stringify(factoryResponse), { status: 200 });
        }
        const method = (opts as RequestInit)?.method;
        if (method === "HEAD" && urlStr.includes("/x/alpha/torii")) {
          return new Response(null, { status: 200 });
        }
        if (urlStr.includes("/x/alpha/torii/sql?query=")) {
          return new Response(JSON.stringify([blitzSummaryRow]), { status: 200 });
        }
        if (method === "HEAD" && urlStr.includes("/x/beta/torii")) {
          return new Response(null, { status: 404 });
        }
        return new Response(null, { status: 500 });
      });

      const service = new ToriiAvailabilityService({ factoryChains: ["mainnet"] });
      await service.pollOnce();

      const availability = service.getAvailability();
      expect(availability["alpha"]).toBe(true);
      expect(availability["beta"]).toBe(false);
    });

    it("records chain of the first factory that yielded the world name", async () => {
      const factoryResponse = [{ name: "0x616c706861", address: "0xabc" }];

      mockFetch.mockImplementation(async (url, opts) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
        if (urlStr.includes("eternum-factory")) {
          return new Response(JSON.stringify(factoryResponse), { status: 200 });
        }
        const method = (opts as RequestInit)?.method;
        if (method === "HEAD") return new Response(null, { status: 200 });
        if (urlStr.includes("?query=")) return new Response(JSON.stringify([blitzSummaryRow]), { status: 200 });
        return new Response(null, { status: 500 });
      });

      const service = new ToriiAvailabilityService({ factoryChains: ["sepolia", "mainnet"] });
      await service.pollOnce();

      const summaries = service.getSummaries();
      expect(summaries[0]!.chain).toBe("appchain");
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

      // Each poll cycle makes 2 factory fetches per chain (worlds + prize addresses).
      // 1 chain × 2 fetches × 2 poll cycles = 4.
      const factoryCalls = mockFetch.mock.calls.filter(([url]) => {
        const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url;
        return urlStr.includes("eternum-factory");
      });
      expect(factoryCalls.length).toBe(4);

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
      // Poll fires 2 parallel factory fetches (worlds + prize addresses) then awaits both.
      expect(mockFetch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(3000);
      // No new cycle should have started while the first is still in-flight.
      expect(mockFetch).toHaveBeenCalledTimes(2);

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
