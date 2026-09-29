/// <reference lib="webworker" />

import type { HexPosition } from "@bibliothecadao/types";
import { setWorldOrigin } from "../world-origin";
import { prepareTerrainPage } from "./terrain-page-builder";
import { buildTerrainFogMask, type TerrainFogMask } from "./terrain-fog-mask";
import {
  getTerrainBorderBufferViews,
  getTerrainGeometryBufferViews,
  type PreparedTerrainPage,
  type TerrainGeometryBuffers,
  type TerrainPageRequest,
  type TerrainShroudInstance,
} from "./terrain-types";

type TerrainPageWorkerRequest =
  | { id: number; kind: "fog-mask"; instances: TerrainShroudInstance[] }
  | { id: number; kind: "terrain-page"; origin: HexPosition; request: TerrainPageRequest };

interface TerrainPageWorkerResponse {
  error?: string;
  fogMask?: TerrainFogMask | null;
  id: number;
  kind: TerrainPageWorkerRequest["kind"];
  page?: PreparedTerrainPage;
}

self.onmessage = (event: MessageEvent<TerrainPageWorkerRequest>) => {
  try {
    if (event.data.kind === "fog-mask") {
      const fogMask = buildTerrainFogMask(event.data.instances);
      const response: TerrainPageWorkerResponse = { fogMask, id: event.data.id, kind: "fog-mask" };
      self.postMessage(response, fogMask ? [fogMask.data.buffer as ArrayBuffer] : []);
      return;
    }
    setWorldOrigin(event.data.origin);
    const page = prepareTerrainPage(event.data.request);
    const response: TerrainPageWorkerResponse = { id: event.data.id, kind: "terrain-page", page };
    self.postMessage(response, collectTransferables(page));
  } catch (error) {
    const response: TerrainPageWorkerResponse = {
      error: error instanceof Error ? error.message : String(error),
      id: event.data.id,
      kind: event.data.kind,
    };
    self.postMessage(response);
  }
};

function collectTransferables(page: PreparedTerrainPage): Transferable[] {
  return [
    ...collectGeometryTransferables(page.buffers),
    ...(page.waterBuffers ? collectGeometryTransferables(page.waterBuffers) : []),
    ...(page.basaltInstances ? [page.basaltInstances.buffer as ArrayBuffer] : []),
    ...(page.borderBuffers
      ? getTerrainBorderBufferViews(page.borderBuffers).map((buffer) => buffer.buffer as ArrayBuffer)
      : []),
  ];
}

function collectGeometryTransferables(buffers: TerrainGeometryBuffers): Transferable[] {
  return getTerrainGeometryBufferViews(buffers).map((buffer) => buffer.buffer as ArrayBuffer);
}
