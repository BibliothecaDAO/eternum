import { brotliDecompressSync } from "zlib";
import { describe, expect, it } from "vitest";

import { createCachedJsonResponse, createJsonPayload } from "../cache-response";

describe("createCachedJsonResponse", () => {
  it("returns brotli-compressed JSON when the client accepts br", async () => {
    const payload = createJsonPayload({
      message: "x".repeat(2_048),
    });

    const response = createCachedJsonResponse({
      payload,
      acceptEncoding: "gzip, br",
      status: 202,
    });

    expect(response.status).toBe(202);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Content-Encoding")).toBe("br");
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");

    const compressedBody = new Uint8Array(await response.arrayBuffer());
    const decompressedBody = brotliDecompressSync(compressedBody).toString();

    expect(decompressedBody).toContain("message");
  });

  it("returns plain JSON when compression is not requested", async () => {
    const response = createCachedJsonResponse({
      payload: createJsonPayload({ ok: true }),
    });

    expect(response.headers.get("Content-Encoding")).toBeNull();
    expect(await response.text()).toBe('{"ok":true}');
  });
});
