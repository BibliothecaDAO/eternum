import type { TransferRouteOverlayRoute } from "@/lib/transfer-route-overlay";
import * as THREE from "three";

import { getWorldPositionForHex } from "../utils/utils";

interface RouteVisual {
  curve: THREE.QuadraticBezierCurve3;
  group: THREE.Group;
  kind: TransferRouteOverlayRoute["kind"];
  marker?: THREE.Mesh;
  progress?: number;
  progressRatePerSecond?: number;
  pulses: THREE.Mesh[];
  signature: string;
}

const GROUP_NAME = "TransferRouteOverlayGroup";
const ROUTE_BASE_Y = 1.05;
const LIVE_PULSE_COUNT = 3;
const PLANNED_PULSE_COUNT = 2;

export class TransferRouteOverlayManager {
  private readonly group: THREE.Group;
  private readonly routeVisuals = new Map<string, RouteVisual>();
  private enabled = true;
  private elapsedSeconds = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = GROUP_NAME;
    this.group.renderOrder = 42;
    this.scene.add(this.group);
  }

  public getGroup(): THREE.Group {
    return this.group;
  }

  public getRouteCount(): number {
    return this.routeVisuals.size;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.group.visible = enabled;
  }

  public setRoutes(routes: TransferRouteOverlayRoute[]): void {
    const nextRouteIds = new Set<string>();
    const parallelRouteIndices = resolveParallelRouteIndices(routes);

    routes.forEach((route) => {
      const parallelIndex = parallelRouteIndices.get(route.id) ?? 0;
      nextRouteIds.add(route.id);
      this.upsertRouteVisual(route, parallelIndex);
    });

    this.removeStaleRouteVisuals(nextRouteIds);
  }

  public update(deltaTime: number): void {
    if (!this.enabled) {
      return;
    }

    this.elapsedSeconds += deltaTime;
    this.routeVisuals.forEach((visual) => this.updateRouteVisual(visual, deltaTime));
  }

  public destroy(): void {
    this.clearRoutes();
    this.group.parent?.remove(this.group);
  }

  private upsertRouteVisual(route: TransferRouteOverlayRoute, parallelIndex: number): void {
    const signature = buildRouteVisualSignature(route, parallelIndex);
    const existingVisual = this.routeVisuals.get(route.id);

    if (existingVisual?.signature === signature) {
      updateRouteVisualProgress(existingVisual, route);
      return;
    }

    if (existingVisual) {
      disposeRouteVisual(existingVisual);
      this.routeVisuals.delete(route.id);
    }

    this.addRouteVisual(route, parallelIndex, signature);
  }

  private addRouteVisual(route: TransferRouteOverlayRoute, parallelIndex: number, signature: string): void {
    const curve = buildRouteCurve(route, parallelIndex);
    const group = new THREE.Group();
    group.name = `transfer-route:${route.id}`;
    group.userData.routeId = route.id;
    group.renderOrder = 42;

    const path = createRoutePath(curve, route.kind);
    group.add(path);

    const pulses = createRoutePulses(route.kind);
    pulses.forEach((pulse) => group.add(pulse));

    const marker =
      route.kind === "live" && route.progress !== undefined
        ? createLiveProgressMarker(route.kind, curve, route.progress)
        : undefined;
    if (marker) {
      group.add(marker);
    }

    this.group.add(group);
    this.routeVisuals.set(route.id, {
      curve,
      group,
      kind: route.kind,
      marker,
      progress: route.progress,
      progressRatePerSecond: resolveProgressRatePerSecond(route),
      pulses,
      signature,
    });
  }

  private updateRouteVisual(visual: RouteVisual, deltaTime: number): void {
    const speed = visual.kind === "live" ? 0.24 : 0.1;

    visual.pulses.forEach((pulse, index) => {
      const phase = index / Math.max(visual.pulses.length, 1);
      const progress = (this.elapsedSeconds * speed + phase) % 1;
      pulse.position.copy(visual.curve.getPointAt(progress));
      const scale = visual.kind === "live" ? 0.85 + Math.sin((progress + phase) * Math.PI * 2) * 0.18 : 0.7;
      pulse.scale.setScalar(scale);
    });

    if (visual.marker && visual.progress !== undefined) {
      visual.progress = advanceRouteProgress(visual.progress, visual.progressRatePerSecond, deltaTime);
      visual.marker.position.copy(visual.curve.getPointAt(visual.progress));
      const markerScale = 1 + Math.sin(this.elapsedSeconds * Math.PI * 2.6) * 0.18;
      visual.marker.scale.setScalar(markerScale);
    }
  }

  private clearRoutes(): void {
    this.routeVisuals.forEach((visual) => disposeRouteVisual(visual));
    this.routeVisuals.clear();
  }

  private removeStaleRouteVisuals(nextRouteIds: Set<string>): void {
    this.routeVisuals.forEach((visual, routeId) => {
      if (nextRouteIds.has(routeId)) {
        return;
      }

      disposeRouteVisual(visual);
      this.routeVisuals.delete(routeId);
    });
  }
}

function resolveParallelRouteIndices(routes: TransferRouteOverlayRoute[]): Map<string, number> {
  const routeIdsByPairKey = new Map<string, TransferRouteOverlayRoute[]>();
  const parallelRouteIndices = new Map<string, number>();

  routes.forEach((route) => {
    const pairKey = buildParallelRoutePairKey(route);
    const pairRoutes = routeIdsByPairKey.get(pairKey) ?? [];
    pairRoutes.push(route);
    routeIdsByPairKey.set(pairKey, pairRoutes);
  });

  routeIdsByPairKey.forEach((pairRoutes) => {
    pairRoutes
      .toSorted(compareParallelRouteStability)
      .forEach((route, index) => parallelRouteIndices.set(route.id, index));
  });

  return parallelRouteIndices;
}

function buildParallelRoutePairKey(route: TransferRouteOverlayRoute): string {
  return [route.sourceEntityId, route.destinationEntityId].toSorted((left, right) => left - right).join(":");
}

function compareParallelRouteStability(left: TransferRouteOverlayRoute, right: TransferRouteOverlayRoute): number {
  return left.id.localeCompare(right.id);
}

function buildRouteCurve(route: TransferRouteOverlayRoute, parallelIndex: number): THREE.QuadraticBezierCurve3 {
  const start = getWorldPositionForHex(route.sourceHex).clone();
  const end = getWorldPositionForHex(route.destinationHex).clone();
  start.y += ROUTE_BASE_Y;
  end.y += ROUTE_BASE_Y;

  const direction = new THREE.Vector3().subVectors(end, start);
  const distance = Math.max(direction.length(), 1);
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const lateralOffset = resolveParallelLateralOffset(start, end, parallelIndex);
  const height = Math.max(2.8, Math.min(distance * 0.18, 18));

  midpoint.add(lateralOffset);
  midpoint.y += height;

  return new THREE.QuadraticBezierCurve3(start, midpoint, end);
}

function buildRouteVisualSignature(route: TransferRouteOverlayRoute, parallelIndex: number): string {
  return [
    route.kind,
    route.sourceHex.col,
    route.sourceHex.row,
    route.destinationHex.col,
    route.destinationHex.row,
    parallelIndex,
  ].join(":");
}

function resolveParallelLateralOffset(start: THREE.Vector3, end: THREE.Vector3, parallelIndex: number): THREE.Vector3 {
  if (parallelIndex === 0) {
    return new THREE.Vector3();
  }

  const direction = new THREE.Vector3(end.x - start.x, 0, end.z - start.z).normalize();
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
  const side = parallelIndex % 2 === 0 ? -1 : 1;
  const lane = Math.ceil(parallelIndex / 2);
  return perpendicular.multiplyScalar(side * lane * 0.9);
}

function createRoutePath(curve: THREE.QuadraticBezierCurve3, kind: TransferRouteOverlayRoute["kind"]): THREE.Mesh {
  const geometry = new THREE.TubeGeometry(curve, 36, kind === "live" ? 0.055 : 0.035, 6, false);
  const material = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: kind === "live" ? 0xffcf72 : 0x6bd9cf,
    depthWrite: false,
    opacity: kind === "live" ? 0.72 : 0.38,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "transfer-route-arc";
  mesh.frustumCulled = false;
  mesh.renderOrder = 42;
  return mesh;
}

function createRoutePulses(kind: TransferRouteOverlayRoute["kind"]): THREE.Mesh[] {
  const pulseCount = kind === "live" ? LIVE_PULSE_COUNT : PLANNED_PULSE_COUNT;
  return Array.from({ length: pulseCount }, (_, index) => {
    const geometry = new THREE.SphereGeometry(kind === "live" ? 0.22 : 0.16, 12, 8);
    const material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: kind === "live" ? 0xfff0b8 : 0x9ff8ee,
      depthWrite: false,
      opacity: kind === "live" ? 0.92 : 0.56,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `transfer-route-pulse-${index}`;
    mesh.frustumCulled = false;
    mesh.renderOrder = 43;
    return mesh;
  });
}

function createLiveProgressMarker(
  kind: TransferRouteOverlayRoute["kind"],
  curve: THREE.QuadraticBezierCurve3,
  progress: number,
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(0.32, 16, 10);
  const material = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: kind === "live" ? 0xffffff : 0x9ff8ee,
    depthWrite: false,
    opacity: 0.96,
    transparent: true,
  });
  const marker = new THREE.Mesh(geometry, material);
  marker.name = "transfer-route-progress-marker";
  marker.position.copy(curve.getPointAt(progress));
  marker.frustumCulled = false;
  marker.renderOrder = 44;
  return marker;
}

function resolveProgressRatePerSecond(route: TransferRouteOverlayRoute): number | undefined {
  if (route.startedAtMs === undefined || route.endsAtMs === undefined) {
    return undefined;
  }

  const durationSeconds = (route.endsAtMs - route.startedAtMs) / 1000;
  return durationSeconds > 0 ? 1 / durationSeconds : undefined;
}

function updateRouteVisualProgress(visual: RouteVisual, route: TransferRouteOverlayRoute): void {
  visual.progress = route.progress;
  visual.progressRatePerSecond = resolveProgressRatePerSecond(route);
  if (visual.marker && route.progress !== undefined) {
    visual.marker.position.copy(visual.curve.getPointAt(route.progress));
  }
}

function advanceRouteProgress(progress: number, progressRatePerSecond: number | undefined, deltaTime: number): number {
  if (progressRatePerSecond === undefined) {
    return progress;
  }

  return Math.min(progress + progressRatePerSecond * deltaTime, 1);
}

function disposeRouteVisual(visual: RouteVisual): void {
  visual.group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      disposeMaterial(object.material);
    }
  });
  visual.group.parent?.remove(visual.group);
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}
