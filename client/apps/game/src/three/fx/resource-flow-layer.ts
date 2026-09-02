import { findResourceById } from "@bibliothecadao/types";
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";

interface ResourceFlowPayload {
  amount: number;
  resourceId: number;
}

export interface ResourceFlowSnapshot {
  id: string;
  resources: readonly ResourceFlowPayload[];
  seed: number;
  source: Readonly<Vector3>;
  sourceEntityId: number;
  target: Readonly<Vector3>;
  targetEntityId: number;
}

interface ResourceFlowPacketMetadata extends ResourceFlowPayload {
  flowId: string;
  sourceEntityId: number;
  targetEntityId: number;
}

export interface ResourceFlowStats {
  activeFlows: number;
  activePackets: number;
  activeRouteSegments: number;
  drawCalls: number;
  droppedFlows: number;
  droppedResources: number;
  packetCapacity: number;
  routeSegmentCapacity: number;
  triangles: number;
}

interface ResourceFlowState {
  arcHeight: number;
  bend: number;
  id: string;
  resources: readonly ResolvedResourceFlowPayload[];
  sourceEntityId: number;
  sourceX: number;
  sourceY: number;
  sourceZ: number;
  targetEntityId: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

interface ResolvedResourceFlowPayload extends ResourceFlowPayload {
  color: Color;
  phase: number;
}

export const RESOURCE_FLOW_CAPACITY = 64;
export const RESOURCE_FLOW_RESOURCES_PER_ROUTE = 3;
export const RESOURCE_FLOW_PACKETS_PER_RESOURCE = 2;
export const RESOURCE_FLOW_SEGMENTS_PER_ROUTE = 18;

const ROUTE_SEGMENT_CAPACITY = RESOURCE_FLOW_CAPACITY * RESOURCE_FLOW_SEGMENTS_PER_ROUTE;
const PACKET_CAPACITY = RESOURCE_FLOW_CAPACITY * RESOURCE_FLOW_RESOURCES_PER_ROUTE * RESOURCE_FLOW_PACKETS_PER_RESOURCE;
const ROUTE_WIDTH = 0.045;
const PACKET_SPEED = 0.16;
const Y_AXIS = new Vector3(0, 1, 0);

export class ResourceFlowLayer {
  readonly object3d = new Group();
  private readonly routeGeometry = createRouteGeometry();
  private readonly routeMaterial = createRouteMaterial();
  private readonly routeSegments = createInstancedMesh(
    this.routeGeometry,
    this.routeMaterial,
    ROUTE_SEGMENT_CAPACITY,
    "resource-flow-routes",
  );
  private readonly packetGeometry = new OctahedronGeometry(1, 0);
  private readonly packetMaterial = createPacketMaterial();
  private readonly packets = createInstancedMesh(
    this.packetGeometry,
    this.packetMaterial,
    PACKET_CAPACITY,
    "resource-flow-packets",
  );
  private readonly directionGeometry = new ConeGeometry(1, 1.8, 3);
  private readonly directionMaterial = createPacketMaterial();
  private readonly directions = createInstancedMesh(
    this.directionGeometry,
    this.directionMaterial,
    RESOURCE_FLOW_CAPACITY,
    "resource-flow-directions",
  );
  private readonly flows: ResourceFlowState[] = [];
  private readonly packetFlowIds: string[] = [];
  private readonly packetResourceIds = new Uint16Array(PACKET_CAPACITY);
  private readonly packetAmounts = new Float64Array(PACKET_CAPACITY);
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly previous = new Vector3();
  private readonly next = new Vector3();
  private readonly direction = new Vector3();
  private readonly scale = new Vector3();
  private readonly quaternion = new Quaternion();
  private elapsedSeconds = 0;
  private activePackets = 0;
  private activeRouteSegments = 0;
  private droppedFlows = 0;
  private droppedResources = 0;
  private disposed = false;

  constructor() {
    this.object3d.name = "resource-flow-layer";
    this.object3d.add(this.routeSegments, this.packets, this.directions);
  }

  sync(snapshots: readonly ResourceFlowSnapshot[]): void {
    this.requireAlive();
    snapshots.forEach(validateResourceFlowSnapshot);
    const canonical = canonicalResourceFlows(snapshots);
    this.flows.length = 0;
    this.droppedFlows = Math.max(0, canonical.length - RESOURCE_FLOW_CAPACITY);
    this.droppedResources = 0;
    for (let index = 0; index < Math.min(canonical.length, RESOURCE_FLOW_CAPACITY); index += 1) {
      const snapshot = canonical[index];
      this.droppedResources += Math.max(0, snapshot.resources.length - RESOURCE_FLOW_RESOURCES_PER_ROUTE);
      this.flows.push(createResourceFlowState(snapshot));
    }
    this.writeRoutes();
    this.writePackets();
  }

  update(deltaSeconds: number): void {
    if (this.disposed) return;
    const delta = Number.isFinite(deltaSeconds) ? Math.min(0.05, Math.max(0, deltaSeconds)) : 0;
    this.elapsedSeconds += delta;
    this.writePackets();
  }

  getPacketMetadata(instanceId: number): ResourceFlowPacketMetadata | undefined {
    if (!Number.isInteger(instanceId) || instanceId < 0 || instanceId >= this.activePackets) return;
    const flow = this.flows.find(({ id }) => id === this.packetFlowIds[instanceId]);
    if (!flow) return;
    return {
      amount: this.packetAmounts[instanceId],
      flowId: flow.id,
      resourceId: this.packetResourceIds[instanceId],
      sourceEntityId: flow.sourceEntityId,
      targetEntityId: flow.targetEntityId,
    };
  }

  getStats(): ResourceFlowStats {
    const routeTriangles = this.activeRouteSegments * trianglesPerInstance(this.routeGeometry);
    const packetTriangles = this.activePackets * trianglesPerInstance(this.packetGeometry);
    const directionTriangles = this.flows.length * trianglesPerInstance(this.directionGeometry);
    return {
      activeFlows: this.flows.length,
      activePackets: this.activePackets,
      activeRouteSegments: this.activeRouteSegments,
      drawCalls: Number(this.routeSegments.visible) + Number(this.packets.visible) + Number(this.directions.visible),
      droppedFlows: this.droppedFlows,
      droppedResources: this.droppedResources,
      packetCapacity: PACKET_CAPACITY,
      routeSegmentCapacity: ROUTE_SEGMENT_CAPACITY,
      triangles: routeTriangles + packetTriangles + directionTriangles,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.flows.length = 0;
    this.object3d.clear();
    this.object3d.removeFromParent();
    this.routeSegments.dispose();
    this.packets.dispose();
    this.directions.dispose();
    this.routeGeometry.dispose();
    this.routeMaterial.dispose();
    this.packetGeometry.dispose();
    this.packetMaterial.dispose();
    this.directionGeometry.dispose();
    this.directionMaterial.dispose();
  }

  private writeRoutes(): void {
    let segmentIndex = 0;
    for (const flow of this.flows) {
      for (let index = 0; index < RESOURCE_FLOW_SEGMENTS_PER_ROUTE; index += 1) {
        const startProgress = index / RESOURCE_FLOW_SEGMENTS_PER_ROUTE;
        const endProgress = (index + 0.68) / RESOURCE_FLOW_SEGMENTS_PER_ROUTE;
        sampleRoutePoint(flow, startProgress, 0.055, this.previous);
        sampleRoutePoint(flow, endProgress, 0.055, this.next);
        this.writeRouteSegment(flow, index, segmentIndex);
        segmentIndex += 1;
      }
    }
    this.activeRouteSegments = segmentIndex;
    this.routeSegments.count = segmentIndex;
    this.routeSegments.visible = segmentIndex > 0;
    this.routeSegments.instanceMatrix.needsUpdate = segmentIndex > 0;
    if (this.routeSegments.instanceColor) this.routeSegments.instanceColor.needsUpdate = segmentIndex > 0;
    this.writeDirections();
  }

  private writeRouteSegment(flow: ResourceFlowState, localIndex: number, segmentIndex: number): void {
    this.direction.copy(this.next).sub(this.previous);
    const length = this.direction.length();
    this.position.copy(this.previous).add(this.next).multiplyScalar(0.5);
    this.quaternion.setFromAxisAngle(Y_AXIS, Math.atan2(this.direction.x, this.direction.z));
    const emphasis = localIndex % 3 === 1 ? 1.18 : 0.82;
    this.scale.set(ROUTE_WIDTH * emphasis, 1, length);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.routeSegments.setMatrixAt(segmentIndex, this.matrix);
    this.routeSegments.setColorAt(segmentIndex, flow.resources[localIndex % flow.resources.length].color);
  }

  private writeDirections(): void {
    for (let index = 0; index < this.flows.length; index += 1) {
      const flow = this.flows[index];
      sampleRoutePoint(flow, 0.7, 0.09, this.previous);
      sampleRoutePoint(flow, 0.73, 0.09, this.next);
      this.direction.copy(this.next).sub(this.previous).normalize();
      this.quaternion.setFromUnitVectors(Y_AXIS, this.direction);
      this.scale.setScalar(0.1);
      this.matrix.compose(this.next, this.quaternion, this.scale);
      this.directions.setMatrixAt(index, this.matrix);
      this.directions.setColorAt(index, flow.resources[0].color);
    }
    this.directions.count = this.flows.length;
    this.directions.visible = this.flows.length > 0;
    this.directions.instanceMatrix.needsUpdate = this.flows.length > 0;
    if (this.directions.instanceColor) this.directions.instanceColor.needsUpdate = this.flows.length > 0;
  }

  private writePackets(): void {
    let packetIndex = 0;
    for (const flow of this.flows) {
      for (let resourceIndex = 0; resourceIndex < flow.resources.length; resourceIndex += 1) {
        const resource = flow.resources[resourceIndex];
        for (let copyIndex = 0; copyIndex < RESOURCE_FLOW_PACKETS_PER_RESOURCE; copyIndex += 1) {
          const progress = (this.elapsedSeconds * PACKET_SPEED + resource.phase + copyIndex * 0.5) % 1;
          sampleRoutePoint(flow, progress, flow.arcHeight, this.position);
          const pulse = 0.92 + Math.sin((this.elapsedSeconds + progress) * Math.PI * 2) * 0.08;
          this.scale.setScalar(resolvePacketSize(resource.amount) * pulse);
          this.quaternion.setFromAxisAngle(Y_AXIS, progress * Math.PI * 4 + flow.bend);
          this.matrix.compose(this.position, this.quaternion, this.scale);
          this.packets.setMatrixAt(packetIndex, this.matrix);
          this.packets.setColorAt(packetIndex, resource.color);
          this.packetFlowIds[packetIndex] = flow.id;
          this.packetResourceIds[packetIndex] = resource.resourceId;
          this.packetAmounts[packetIndex] = resource.amount;
          packetIndex += 1;
        }
      }
    }
    this.activePackets = packetIndex;
    this.packetFlowIds.length = packetIndex;
    this.packets.count = packetIndex;
    this.packets.visible = packetIndex > 0;
    this.packets.instanceMatrix.needsUpdate = packetIndex > 0;
    if (this.packets.instanceColor) this.packets.instanceColor.needsUpdate = packetIndex > 0;
  }

  private requireAlive(): void {
    if (this.disposed) throw new Error("Resource flow layer is disposed");
  }
}

function createInstancedMesh(
  geometry: PlaneGeometry | OctahedronGeometry | ConeGeometry,
  material: MeshBasicMaterial,
  capacity: number,
  name: string,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.name = name;
  mesh.count = 0;
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 28;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  return mesh;
}

function createRouteGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.name = "resource-flow-route-segment";
  return geometry;
}

function createRouteMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    opacity: 0.42,
    side: DoubleSide,
    transparent: true,
    vertexColors: true,
  });
}

function createPacketMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    blending: AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    opacity: 0.9,
    transparent: true,
    vertexColors: true,
  });
}

function createResourceFlowState(snapshot: ResourceFlowSnapshot): ResourceFlowState {
  const distance = Math.hypot(snapshot.target.x - snapshot.source.x, snapshot.target.z - snapshot.source.z);
  return {
    arcHeight: 0.28 + Math.min(0.55, distance * 0.055),
    bend: (seededUnit(snapshot.seed, 0, 409) - 0.5) * Math.min(1.8, distance * 0.44),
    id: snapshot.id,
    resources: snapshot.resources.slice(0, RESOURCE_FLOW_RESOURCES_PER_ROUTE).map((resource, index) => ({
      ...resource,
      color: resolveResourceColor(resource.resourceId),
      phase: seededUnit(snapshot.seed, index, 401),
    })),
    sourceEntityId: snapshot.sourceEntityId,
    sourceX: snapshot.source.x,
    sourceY: snapshot.source.y,
    sourceZ: snapshot.source.z,
    targetEntityId: snapshot.targetEntityId,
    targetX: snapshot.target.x,
    targetY: snapshot.target.y,
    targetZ: snapshot.target.z,
  };
}

function sampleRoutePoint(flow: ResourceFlowState, progress: number, arcHeight: number, target: Vector3): Vector3 {
  const inverse = 1 - progress;
  const midpointX = (flow.sourceX + flow.targetX) * 0.5;
  const midpointZ = (flow.sourceZ + flow.targetZ) * 0.5;
  const deltaX = flow.targetX - flow.sourceX;
  const deltaZ = flow.targetZ - flow.sourceZ;
  const distance = Math.max(0.001, Math.hypot(deltaX, deltaZ));
  const controlX = midpointX + (-deltaZ / distance) * flow.bend;
  const controlZ = midpointZ + (deltaX / distance) * flow.bend;
  target.set(
    inverse * inverse * flow.sourceX + 2 * inverse * progress * controlX + progress * progress * flow.targetX,
    flow.sourceY + (flow.targetY - flow.sourceY) * progress + Math.sin(Math.PI * progress) * arcHeight,
    inverse * inverse * flow.sourceZ + 2 * inverse * progress * controlZ + progress * progress * flow.targetZ,
  );
  return target;
}

function resolvePacketSize(amount: number): number {
  return Math.min(0.16, 0.07 + Math.log10(amount + 1) * 0.012);
}

function resolveResourceColor(resourceId: number): Color {
  const definition = findResourceById(resourceId);
  const color = new Color(definition?.colour ?? "#f6c76b");
  if (Math.max(color.r, color.g, color.b) < 0.48) color.lerp(new Color("#ffffff"), 0.42);
  return color;
}

function trianglesPerInstance(geometry: PlaneGeometry | OctahedronGeometry | ConeGeometry): number {
  return (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
}

function canonicalResourceFlows(snapshots: readonly ResourceFlowSnapshot[]): readonly ResourceFlowSnapshot[] {
  for (let index = 1; index < snapshots.length; index += 1) {
    if (snapshots[index - 1].id === snapshots[index].id)
      throw new Error(`Duplicate resource flow id: ${snapshots[index].id}`);
    if (snapshots[index - 1].id > snapshots[index].id) {
      const sorted = snapshots.toSorted((left, right) => left.id.localeCompare(right.id));
      for (let sortedIndex = 1; sortedIndex < sorted.length; sortedIndex += 1) {
        if (sorted[sortedIndex - 1].id === sorted[sortedIndex].id) {
          throw new Error(`Duplicate resource flow id: ${sorted[sortedIndex].id}`);
        }
      }
      return sorted;
    }
  }
  return snapshots;
}

function validateResourceFlowSnapshot(snapshot: ResourceFlowSnapshot): void {
  if (!snapshot.id) throw new Error("Resource flows require a stable non-empty id");
  if (!Number.isFinite(snapshot.sourceEntityId) || !Number.isFinite(snapshot.targetEntityId)) {
    throw new Error(`Resource flow ${snapshot.id} requires finite entity ids`);
  }
  if (snapshot.sourceEntityId === snapshot.targetEntityId) {
    throw new Error(`Resource flow ${snapshot.id} must connect different entities`);
  }
  requireFiniteVector(snapshot.source, `resource flow ${snapshot.id} source`);
  requireFiniteVector(snapshot.target, `resource flow ${snapshot.id} target`);
  const deltaX = snapshot.target.x - snapshot.source.x;
  const deltaY = snapshot.target.y - snapshot.source.y;
  const deltaZ = snapshot.target.z - snapshot.source.z;
  if (deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ < 1e-6) {
    throw new Error(`Resource flow ${snapshot.id} requires distinct source and target positions`);
  }
  if (snapshot.resources.length === 0) throw new Error(`Resource flow ${snapshot.id} requires at least one resource`);
  snapshot.resources.forEach((resource) => {
    if (
      !Number.isInteger(resource.resourceId) ||
      resource.resourceId <= 0 ||
      !Number.isFinite(resource.amount) ||
      resource.amount <= 0
    ) {
      throw new Error(`Resource flow ${snapshot.id} contains an invalid resource payload`);
    }
  });
}

function requireFiniteVector(value: Readonly<Vector3>, label: string): void {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new Error(`${label} requires finite coordinates`);
  }
}

function seededUnit(seed: number, index: number, salt: number): number {
  let value = (seed >>> 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}
