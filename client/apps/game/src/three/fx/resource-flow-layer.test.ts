import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  RESOURCE_FLOW_CAPACITY,
  RESOURCE_FLOW_PACKETS_PER_RESOURCE,
  RESOURCE_FLOW_RESOURCES_PER_ROUTE,
  RESOURCE_FLOW_SEGMENTS_PER_ROUTE,
  ResourceFlowLayer,
  type ResourceFlowSnapshot,
} from "./resource-flow-layer";

describe("ResourceFlowLayer", () => {
  it("syncs routes, moving resource packets, direction markers, and hover metadata", () => {
    const layer = new ResourceFlowLayer();
    layer.sync([
      createFlow("a", 1, 2, [
        { amount: 1_200, resourceId: 3 },
        { amount: 80, resourceId: 7 },
      ]),
      createFlow("b", 3, 4, [{ amount: 450, resourceId: 35 }]),
    ]);
    layer.update(0.5);

    expect(layer.getStats()).toMatchObject({
      activeFlows: 2,
      activePackets: 3 * RESOURCE_FLOW_PACKETS_PER_RESOURCE,
      activeRouteSegments: 2 * RESOURCE_FLOW_SEGMENTS_PER_ROUTE,
      drawCalls: 3,
      droppedFlows: 0,
      droppedResources: 0,
    });
    expect(layer.getPacketMetadata(0)).toEqual({
      amount: 1_200,
      flowId: "a",
      resourceId: 3,
      sourceEntityId: 1,
      targetEntityId: 2,
    });
    expect(layer.getPacketMetadata(999)).toBeUndefined();

    layer.sync([]);
    expect(layer.getStats()).toMatchObject({ activeFlows: 0, activePackets: 0, activeRouteSegments: 0, drawCalls: 0 });
    layer.dispose();
  });

  it("keeps route and resource saturation bounded and visible", () => {
    const layer = new ResourceFlowLayer();
    const resources = Array.from({ length: RESOURCE_FLOW_RESOURCES_PER_ROUTE + 2 }, (_, index) => ({
      amount: 100 + index,
      resourceId: index + 1,
    }));
    layer.sync(
      Array.from({ length: RESOURCE_FLOW_CAPACITY + 3 }, (_, index) =>
        createFlow(`flow-${index}`, index, index + 1, resources),
      ),
    );

    expect(layer.getStats()).toMatchObject({
      activeFlows: RESOURCE_FLOW_CAPACITY,
      droppedFlows: 3,
      droppedResources: RESOURCE_FLOW_CAPACITY * 2,
      packetCapacity: RESOURCE_FLOW_CAPACITY * RESOURCE_FLOW_RESOURCES_PER_ROUTE * RESOURCE_FLOW_PACKETS_PER_RESOURCE,
      routeSegmentCapacity: RESOURCE_FLOW_CAPACITY * RESOURCE_FLOW_SEGMENTS_PER_ROUTE,
    });
    layer.dispose();
  });

  it("rejects ambiguous flow identity and invalid endpoints", () => {
    const layer = new ResourceFlowLayer();
    const duplicate = createFlow("same", 1, 2, [{ amount: 1, resourceId: 1 }]);
    expect(() => layer.sync([duplicate, { ...duplicate }])).toThrow("Duplicate resource flow id");
    expect(() => layer.sync([{ ...duplicate, id: "zero", target: duplicate.source }])).toThrow(
      "distinct source and target positions",
    );
    layer.dispose();
    expect(() => layer.sync([])).toThrow("disposed");
  });
});

function createFlow(
  id: string,
  sourceEntityId: number,
  targetEntityId: number,
  resources: ResourceFlowSnapshot["resources"],
): ResourceFlowSnapshot {
  return {
    id,
    resources,
    seed: sourceEntityId * 31 + targetEntityId,
    source: new Vector3(sourceEntityId, 0, -1),
    sourceEntityId,
    target: new Vector3(targetEntityId + 2, 0, 1),
    targetEntityId,
  };
}
