import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { TransferRouteOverlayManager } from "./transfer-route-overlay-manager";
import type { TransferRouteOverlayRoute } from "@/lib/transfer-route-overlay";

const createRoute = (overrides: Partial<TransferRouteOverlayRoute> = {}): TransferRouteOverlayRoute => ({
  id: "live:1",
  kind: "live",
  sourceEntityId: 11,
  destinationEntityId: 22,
  sourceHex: { col: 1, row: 2 },
  destinationHex: { col: 8, row: 5 },
  resourceIds: [1],
  startedAtMs: 100_000,
  endsAtMs: 130_000,
  progress: 0.4,
  ...overrides,
});

describe("TransferRouteOverlayManager", () => {
  it("owns a named scene group and renders one group per route", () => {
    const scene = new THREE.Scene();
    const manager = new TransferRouteOverlayManager(scene);

    manager.setRoutes([createRoute(), createRoute({ id: "planned:2", kind: "planned", progress: undefined })]);

    const group = scene.getObjectByName("TransferRouteOverlayGroup") as THREE.Group;
    expect(group).toBeDefined();
    expect(group.children).toHaveLength(2);
    expect(manager.getRouteCount()).toBe(2);
  });

  it("animates route pulses and live progress markers", () => {
    const scene = new THREE.Scene();
    const manager = new TransferRouteOverlayManager(scene);

    manager.setRoutes([createRoute()]);

    const routeGroup = manager.getGroup().children[0] as THREE.Group;
    const pulse = routeGroup.getObjectByName("transfer-route-pulse-0") as THREE.Mesh;
    const marker = routeGroup.getObjectByName("transfer-route-progress-marker") as THREE.Mesh;
    const initialPulsePosition = pulse.position.clone();
    const initialMarkerPosition = marker.position.clone();
    const initialMarkerScale = marker.scale.x;

    manager.update(0.5);

    expect(pulse.position.equals(initialPulsePosition)).toBe(false);
    expect(marker.position.equals(initialMarkerPosition)).toBe(false);
    expect(marker.scale.x).not.toBe(initialMarkerScale);
  });

  it("hides and skips animation work when disabled", () => {
    const scene = new THREE.Scene();
    const manager = new TransferRouteOverlayManager(scene);

    manager.setRoutes([createRoute()]);
    manager.setEnabled(false);

    const pulse = manager.getGroup().children[0].getObjectByName("transfer-route-pulse-0") as THREE.Mesh;
    const initialPulsePosition = pulse.position.clone();

    manager.update(0.5);

    expect(manager.getGroup().visible).toBe(false);
    expect(pulse.position.equals(initialPulsePosition)).toBe(true);
  });

  it("updates route progress without recreating stable visuals", () => {
    const scene = new THREE.Scene();
    const manager = new TransferRouteOverlayManager(scene);

    manager.setRoutes([createRoute({ progress: 0.2 })]);

    const routeGroup = manager.getGroup().children[0] as THREE.Group;
    const marker = routeGroup.getObjectByName("transfer-route-progress-marker") as THREE.Mesh;
    const initialMarkerPosition = marker.position.clone();

    manager.setRoutes([createRoute({ progress: 0.6 })]);

    expect(manager.getGroup().children[0]).toBe(routeGroup);
    expect(marker.position.equals(initialMarkerPosition)).toBe(false);
  });

  it("keeps concurrent routes on stable lanes when route ordering changes", () => {
    const scene = new THREE.Scene();
    const manager = new TransferRouteOverlayManager(scene);

    const leadingRoute = createRoute({ id: "live:b", progress: 0.8 });
    const trailingRoute = createRoute({ id: "live:a", progress: 0.3 });

    manager.setRoutes([leadingRoute, trailingRoute]);

    const initialGroups = Object.fromEntries(
      manager.getGroup().children.map((child) => [(child as THREE.Group).userData.routeId, child]),
    );

    manager.setRoutes([
      { ...trailingRoute, progress: 0.9 },
      { ...leadingRoute, progress: 0.1 },
    ]);

    const nextGroups = Object.fromEntries(
      manager.getGroup().children.map((child) => [(child as THREE.Group).userData.routeId, child]),
    );

    expect(nextGroups["live:a"]).toBe(initialGroups["live:a"]);
    expect(nextGroups["live:b"]).toBe(initialGroups["live:b"]);
  });

  it("reconciles removed routes and disposes all visuals on destroy", () => {
    const scene = new THREE.Scene();
    const manager = new TransferRouteOverlayManager(scene);

    manager.setRoutes([createRoute(), createRoute({ id: "planned:2", kind: "planned", progress: undefined })]);
    manager.setRoutes([createRoute()]);

    expect(manager.getRouteCount()).toBe(1);

    manager.destroy();

    expect(scene.getObjectByName("TransferRouteOverlayGroup")).toBeUndefined();
    expect(manager.getRouteCount()).toBe(0);
  });
});
