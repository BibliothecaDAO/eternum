import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToriiAvailabilityService } from "../torii-availability";

const mockFetch = vi.fn<typeof globalThis.fetch>();

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const registryName = (name: string): string => {
  const hex = Array.from(new TextEncoder().encode(name), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `0x${hex.padStart(64, "0")}`;
};

const summaryRow = {
  game_id: 3,
  blitz_mode_on: 1,
  registration_count: 2,
  registration_count_max: 96,
  fee_amount: 0,
};

describe("ToriiAvailabilityService", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    process.env.TORII_SQL_URL = "http://torii.test/sql";
    process.env.STARKNET_MAINNET_RPC_URL = "https://rpc.test";
  });

  afterEach(() => {
    mockFetch.mockReset();
    vi.restoreAllMocks();
  });

  it("probes the configured Torii and folds in the indexed game summary", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse([summaryRow]));
    const service = new ToriiAvailabilityService({ factoryChains: [] });

    await expect(service.probeWorld("alpha", "madara")).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]![0]).toBe("http://torii.test/sql");
    expect(service.getSummaries()[0]).toMatchObject({
      alive: true,
      chain: "madara",
      gameId: 3,
      mode: "blitz",
      name: "alpha",
      registrationCountMax: 96,
    });
  });

  it("records a dead world when Torii is unavailable", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const service = new ToriiAvailabilityService({ factoryChains: [] });

    await expect(service.probeWorld("alpha", "madara")).resolves.toBe(false);
    expect(service.getSummaries()[0]).toMatchObject({ alive: false, name: "alpha" });
  });

  it("discovers games from GameRegistry and probes each once", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { game_id: 1, name: registryName("alpha") },
        { game_id: 2, name: registryName("beta") },
      ]),
    );
    const service = new ToriiAvailabilityService({ factoryChains: ["madara"] });
    const probe = vi.spyOn(service, "probeWorld").mockResolvedValue(true);

    await service.pollOnce();

    expect(probe).toHaveBeenCalledTimes(2);
    expect(probe).toHaveBeenCalledWith("alpha", "madara", null, null);
    expect(probe).toHaveBeenCalledWith("beta", "madara", null, null);
    expect(decodeURIComponent(String(mockFetch.mock.calls[0]![0]))).toContain('FROM "s2-GameRegistry"');
  });

  it("deduplicates a game returned by multiple configured chains", async () => {
    const row = [{ game_id: 1, name: registryName("alpha") }];
    mockFetch.mockResolvedValueOnce(jsonResponse(row)).mockResolvedValueOnce(jsonResponse(row));
    const service = new ToriiAvailabilityService({ factoryChains: ["madara", "appchain"] });
    const probe = vi.spyOn(service, "probeWorld").mockResolvedValue(true);

    await service.pollOnce();

    expect(probe).toHaveBeenCalledOnce();
    expect(probe).toHaveBeenCalledWith("alpha", "madara", null, null);
  });

  it("uses the required mainnet RPC endpoint for jackpot reads", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse([{ ...summaryRow, fee_token: "0x123" }]))
      .mockResolvedValueOnce(jsonResponse({ result: ["0x2", "0x0"] }));
    const service = new ToriiAvailabilityService({ factoryChains: [] });

    await service.probeWorld("alpha", "appchain", "0x456");

    expect(mockFetch.mock.calls[2]![0]).toBe("https://rpc.test");
    expect(service.getSummaries()[0]?.winnerJackpotAmount).toBe("2");
  });

  it("preserves the last indexed summary when a later summary query fails", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse([summaryRow]))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const service = new ToriiAvailabilityService({ factoryChains: [] });

    await service.probeWorld("alpha", "madara");
    await service.probeWorld("alpha", "madara");

    expect(service.getSummaries()[0]).toMatchObject({ alive: true, gameId: 3, registrationCountMax: 96 });
  });
});
