/// <reference lib="webworker" />

import { prepareTerrainPage } from "./terrain-page-builder";
import {
  getTerrainGeometryBufferViews,
  type PreparedTerrainPage,
  type TerrainGeometryBuffers,
  type TerrainPageRequest,
} from "./terrain-types";

interface TerrainPageWorkerRequest {
  id: number;
  request: TerrainPageRequest;
}

interface TerrainPageWorkerResponse {
  error?: string;
  id: number;
  page?: PreparedTerrainPage;
}

self.onmessage = (event: MessageEvent<TerrainPageWorkerRequest>) => {
  try {
    const page = prepareTerrainPage(event.data.request);
    const response: TerrainPageWorkerResponse = { id: event.data.id, page };
    self.postMessage(response, collectTransferables(page));
  } catch (error) {
    const response: TerrainPageWorkerResponse = {
      error: error instanceof Error ? error.message : String(error),
      id: event.data.id,
    };
    self.postMessage(response);
  }
};

function collectTransferables(page: PreparedTerrainPage): Transferable[] {
  return [
    ...collectGeometryTransferables(page.buffers),
    ...(page.waterBuffers ? collectGeometryTransferables(page.waterBuffers) : []),
  ];
}

function collectGeometryTransferables(buffers: TerrainGeometryBuffers): Transferable[] {
  return getTerrainGeometryBufferViews(buffers).map((buffer) => buffer.buffer as ArrayBuffer);
}
