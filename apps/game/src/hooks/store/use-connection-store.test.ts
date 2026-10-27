// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import { useConnectionStore } from "./use-connection-store";

const initial = useConnectionStore.getState();

describe("useConnectionStore", () => {
  afterEach(() => useConnectionStore.setState(initial));

  it("reads a stream being retried as degraded, and Herald's greeting as connected again", () => {
    useConnectionStore.getState().setGlobalStatus("reconnecting");
    expect(useConnectionStore.getState().status).toBe("degraded");
    useConnectionStore.getState().setGlobalStatus("connected");
    expect(useConnectionStore.getState().status).toBe("connected");
  });

  it("reads a stream whose updates failed to apply as disconnected", () => {
    useConnectionStore.getState().setGlobalStatus("failed");
    expect(useConnectionStore.getState().status).toBe("disconnected");
  });
});
