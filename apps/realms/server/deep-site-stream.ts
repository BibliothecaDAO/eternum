import { buildHeraldGameStreamUrl, nativeModelDefinition } from "@bibliothecadao/eternum/game-client";
import { HeraldGameSyncTransport, type HeraldSocket } from "@bibliothecadao/eternum/game-sync";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { STAMINA_MODELS } from "@bibliothecadao/eternum/troop-stamina";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";

const WATCH_INPUTS = new Set([
  ...STAMINA_MODELS,
  "DeepSite",
  "Guard",
  "ArmyRelicEffect",
  "RealmKnowledge",
  "PlayerEntry",
]);

/** Rivals' confirmed changes re-arm every eligible player's watches; a reconnect re-reads the cohort. */
export function followDeepSites(shardUrl: string, gameId: number, changed: () => void): () => void {
  const transport = new HeraldGameSyncTransport({
    url: buildHeraldGameStreamUrl(shardUrl, gameId),
    gameId,
    modelDefinition: nativeModelDefinition(bindings as unknown as NativeWorldBindings),
    socketFactory: workerSocket,
  });
  let enabled = false;
  let stopped = false;
  void transport
    .subscribe({
      onSnapshotStart() {
        enabled = false;
      },
      onSnapshotModel(model, facts) {
        if (model === "DeepRules") enabled = facts.length > 0;
      },
      onSnapshotEnd() {
        if (!enabled) {
          stopped = true;
          transport.dispose();
          return false;
        }
        changed();
        return true;
      },
      onScope() {
        return true;
      },
      onFacts(batch) {
        if (!batch.preconfirmed && batch.facts.some(({ model }) => WATCH_INPUTS.has(model))) changed();
      },
      onEvent() {},
      onHead() {},
      onTransaction() {},
      onStartFailure() {},
    })
    .catch((error: unknown) => {
      if (!stopped) console.error("deep_site_stream_failed", shardUrl, gameId, error);
    });
  return () => {
    stopped = true;
    transport.dispose();
  };
}

/** The shared Herald transport owns reconnects; Workers opens an outbound socket through an HTTP upgrade. */
function workerSocket(address: string): HeraldSocket {
  const url = new URL(address);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  const controller = new AbortController();
  let connection: WebSocket | undefined;
  let closed = false;
  const socket: HeraldSocket = {
    onclose: null,
    onerror: null,
    onmessage: null,
    onopen: null,
    close() {
      closed = true;
      controller.abort();
      connection?.close(1000, "watch stopped");
    },
    send(data) {
      if (!connection) throw new Error("Herald watch is not connected");
      connection.send(data);
    },
  };
  void fetch(url, { headers: { Upgrade: "websocket" }, redirect: "manual", signal: controller.signal })
    .then((response) => {
      if (response.status !== 101 || !response.webSocket) throw new Error(`Herald upgrade refused: ${response.status}`);
      connection = response.webSocket;
      connection.accept();
      if (closed) {
        connection.close(1000, "watch stopped");
        return;
      }
      connection.addEventListener("message", (event) => socket.onmessage?.({ data: event.data }));
      connection.addEventListener("close", (event) => socket.onclose?.({ code: event.code, reason: event.reason }));
      connection.addEventListener("error", () => socket.onerror?.());
      socket.onopen?.();
    })
    .catch(() => {
      if (!closed) socket.onerror?.();
    });
  return socket;
}
