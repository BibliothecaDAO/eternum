import { describe, expect, it } from "vitest";
import { clientAddressOf, createRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("allows a client its budget per window, then refuses until the window rolls", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000, now: () => now });
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
    expect(limiter.allow("b")).toBe(true);
    now = 1_000;
    expect(limiter.allow("a")).toBe(true);
  });

  it("reads the client from the edge headers before the socket", () => {
    const withCloudflare = new Request("https://x", {
      headers: { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" },
    });
    expect(clientAddressOf(withCloudflare, "3.3.3.3")).toBe("1.1.1.1");
    const forwarded = new Request("https://x", { headers: { "x-forwarded-for": "2.2.2.2, 9.9.9.9" } });
    expect(clientAddressOf(forwarded, "3.3.3.3")).toBe("2.2.2.2");
    expect(clientAddressOf(new Request("https://x"), "3.3.3.3")).toBe("3.3.3.3");
    expect(clientAddressOf(new Request("https://x"), null)).toBe("unknown");
  });
});
