import { describe, expect, it } from "vitest";
import { appendConsoleFields } from "./console-message";

describe("appendConsoleFields", () => {
  it("keeps selected diagnostic fields on one physical line", () => {
    const message = appendConsoleFields("[Monitor] recovery requested", {
      kind: "stream_close",
      reason: "HTTP2 stream\nfailed",
      attempt: 2,
      omitted: undefined,
    });

    expect(message).toBe('[Monitor] recovery requested kind="stream_close" reason="HTTP2 stream failed" attempt=2');
    expect(message).not.toMatch(/[\r\n]/);
  });
});
