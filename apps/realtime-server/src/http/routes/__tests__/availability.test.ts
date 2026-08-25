import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

// Mock the service module before importing the route
vi.mock("../../../services/torii-availability", () => {
  const mockService = {
    getAvailability: vi.fn().mockReturnValue({}),
    probeWorld: vi.fn(),
    pollOnce: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    ToriiAvailabilityService: vi.fn().mockImplementation(() => mockService),
    availabilityService: mockService,
  };
});

import availabilityRoutes from "../availability";
import { availabilityService } from "../../../services/torii-availability";

describe("availability routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/api/availability", availabilityRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /worlds returns the cached availability map", async () => {
    (availabilityService.getAvailability as ReturnType<typeof vi.fn>).mockReturnValue({
      "world-a": true,
      "world-b": false,
    });

    const res = await app.request("/api/availability/worlds");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      "world-a": true,
      "world-b": false,
    });
  });

  it("GET /worlds returns empty map when no data cached", async () => {
    (availabilityService.getAvailability as ReturnType<typeof vi.fn>).mockReturnValue({});

    const res = await app.request("/api/availability/worlds");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });
});
