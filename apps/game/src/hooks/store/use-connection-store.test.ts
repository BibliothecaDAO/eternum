// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useConnectionStore } from "./use-connection-store";

describe("useConnectionStore", () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: "connected",
      spatialStatus: "connected",
      globalStatus: "connected",
      lastSpatialUpdate: Date.now(),
      lastGlobalUpdate: Date.now(),
      lastConnectedAt: Date.now(),
      lastDisconnectedAt: null,
      reconnectAttempts: 0,
      streamReconnectVersion: 0,
    });
  });

  afterEach(() => {
    useConnectionStore.setState({
      status: "connected",
      spatialStatus: "connected",
      globalStatus: "connected",
      lastDisconnectedAt: null,
      reconnectAttempts: 0,
    });
  });

  it("derives overall status as disconnected when any stream is failed", () => {
    useConnectionStore.getState().setSpatialStatus("failed");
    expect(useConnectionStore.getState().status).toBe("disconnected");
  });

  it("derives overall status as degraded when a stream is reconnecting", () => {
    useConnectionStore.getState().setGlobalStatus("reconnecting");
    expect(useConnectionStore.getState().status).toBe("degraded");
  });

  it("stamps lastDisconnectedAt when transitioning from connected to degraded/disconnected", () => {
    expect(useConnectionStore.getState().lastDisconnectedAt).toBeNull();
    useConnectionStore.getState().setSpatialStatus("failed");
    expect(useConnectionStore.getState().lastDisconnectedAt).toBeGreaterThan(0);
  });

  it("clears lastDisconnectedAt and stamps lastConnectedAt when both streams recover", () => {
    useConnectionStore.getState().setSpatialStatus("failed");
    expect(useConnectionStore.getState().lastDisconnectedAt).toBeGreaterThan(0);

    useConnectionStore.getState().setSpatialStatus("connected");
    expect(useConnectionStore.getState().status).toBe("connected");
    expect(useConnectionStore.getState().lastDisconnectedAt).toBeNull();
  });

  it("keeps lastDisconnectedAt when already unhealthy and a second stream fails", () => {
    useConnectionStore.getState().setSpatialStatus("failed");
    const firstStamp = useConnectionStore.getState().lastDisconnectedAt;
    expect(firstStamp).toBeGreaterThan(0);

    useConnectionStore.getState().setGlobalStatus("failed");
    expect(useConnectionStore.getState().lastDisconnectedAt).toBe(firstStamp);
  });
});
