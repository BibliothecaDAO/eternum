import { describe, expect, it } from "vitest";

import { RealtimeClient } from "./client";

describe("RealtimeClient identity transport", () => {
  it("opens the websocket without identity query parameters", () => {
    let openedUrl = "";
    const socket = {
      addEventListener: () => undefined,
      close: () => undefined,
    } as unknown as WebSocket;

    new RealtimeClient({
      baseUrl: "https://chat.realms.party?playerId=0xvictim",
      createSocket: (url) => {
        openedUrl = url;
        return socket;
      },
    });

    expect(openedUrl).toBe("wss://chat.realms.party/ws");
  });
});
