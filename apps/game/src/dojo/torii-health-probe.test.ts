// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { probeToriiHealth } from "./torii-health-probe";

const okResponse = () => new Response(null, { status: 200 });
const notFoundResponse = () => new Response(null, { status: 404 });
const serverErrorResponse = () => new Response(null, { status: 503 });

describe("probeToriiHealth", () => {
  it("returns reachable from health when the health endpoint is ok", async () => {
    const fetchFn = vi.fn(async () => okResponse());

    const result = await probeToriiHealth("https://api.example.test/x/world/torii", { fetchFn });

    expect(result).toEqual({ status: "reachable", source: "health", httpStatus: 200 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith("https://api.example.test/x/world/torii/health", expect.any(Object));
  });

  it("falls back to sql when the health endpoint is not found", async () => {
    const fetchFn = vi.fn(async () => (fetchFn.mock.calls.length === 1 ? notFoundResponse() : okResponse()));

    const result = await probeToriiHealth("https://api.example.test/x/world/torii", { fetchFn });

    expect(result).toEqual({
      status: "reachable",
      source: "sql_fallback",
      httpStatus: 200,
      healthHttpStatus: 404,
    });
    expect(fetchFn).toHaveBeenNthCalledWith(2, "https://api.example.test/x/world/torii/sql", expect.any(Object));
  });

  it("classifies missing health and sql endpoints as endpoint_not_found", async () => {
    const fetchFn = vi.fn(async () => notFoundResponse());

    const result = await probeToriiHealth("https://api.example.test/x/world/torii", { fetchFn });

    expect(result).toEqual({
      status: "unreachable",
      reason: "endpoint_not_found",
      httpStatus: 404,
      healthHttpStatus: 404,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("classifies abort-style failures as timeouts", async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    });

    const result = await probeToriiHealth("https://api.example.test/x/world/torii", { fetchFn });

    expect(result).toEqual({ status: "unreachable", reason: "timeout" });
  });

  it("classifies thrown fetch failures as network errors", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await probeToriiHealth("https://api.example.test/x/world/torii", { fetchFn });

    expect(result).toEqual({ status: "unreachable", reason: "network_error" });
  });

  it("classifies server errors as server_error", async () => {
    const fetchFn = vi.fn(async () => serverErrorResponse());

    const result = await probeToriiHealth("https://api.example.test/x/world/torii", { fetchFn });

    expect(result).toEqual({
      status: "unreachable",
      reason: "server_error",
      httpStatus: 503,
      healthHttpStatus: 503,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("preserves health status when sql fallback times out", async () => {
    const fetchFn = vi.fn(async () => {
      if (fetchFn.mock.calls.length === 1) return notFoundResponse();
      throw new DOMException("The operation timed out", "TimeoutError");
    });

    const result = await probeToriiHealth("https://api.example.test/x/world/torii", { fetchFn });

    expect(result).toEqual({
      status: "unreachable",
      reason: "timeout",
      healthHttpStatus: 404,
    });
  });

  it("preserves health status when sql fallback has a network error", async () => {
    const fetchFn = vi.fn(async () => {
      if (fetchFn.mock.calls.length === 1) return serverErrorResponse();
      throw new TypeError("fetch failed");
    });

    const result = await probeToriiHealth("https://api.example.test/x/world/torii", { fetchFn });

    expect(result).toEqual({
      status: "unreachable",
      reason: "network_error",
      healthHttpStatus: 503,
    });
  });
});
