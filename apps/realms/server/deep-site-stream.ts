import {
  buildHeraldGameStreamUrl,
  nativeModelDefinition,
  ShardReleaseMismatchError,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { HeraldGameSyncTransport, type HeraldSocket } from "@bibliothecadao/eternum/game-sync";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import { assertPinReadable, readReleaseCatalogue } from "./game-facts";
import { STAMINA_MODELS } from "@bibliothecadao/eternum/troop-stamina";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";

const WATCH_INPUTS = new Set([
  ...STAMINA_MODELS,
  "DeepSite",
  "DeepEntries",
  "Guard",
  "ArmyRelicEffect",
  "RealmKnowledge",
  "PlayerEntry",
]);

/** Confirmed public or player-scoped facts re-arm watches; a reconnect re-reads the cohort. A release check that could not be made leaves the re-read to the notifier, whose readers check again and whose dirty game is retried at its next alarm. */
export function followDeepSites(
  shardUrl: string,
  gameId: number,
  changed: () => void,
  actor?: string,
  openSocket: (address: string) => HeraldSocket = workerSocket,
): () => void {
  const transport = new HeraldGameSyncTransport({
    url: buildHeraldGameStreamUrl(shardUrl, gameId, actor),
    gameId,
    modelDefinition: nativeModelDefinition(bindings as unknown as NativeWorldBindings),
    socketFactory: openSocket,
  });
  let enabled = false;
  let stopped = false;
  let pin: NativeRows["GameRelease"] | undefined;
  let family: number | undefined;
  const stop = () => {
    stopped = true;
    transport.dispose();
  };
  const revalidate = async () => {
    try {
      assertPinReadable(shardUrl, pin, family, await readReleaseCatalogue(shardUrl));
    } catch (error) {
      if (error instanceof ShardReleaseMismatchError) return stop();
      console.error("deep_site_release_unchecked", shardUrl, gameId, error);
    }
    changed();
  };
  void transport
    .subscribe({
      onSnapshotStart() {
        enabled = false;
        pin = undefined;
        family = undefined;
      },
      onSnapshotModel(model, facts) {
        if (model === "DeepRules") enabled = facts.length > 0;
        if (model === "GameRelease") pin = facts[0]?.value as NativeRows["GameRelease"] | undefined;
        if (model === "GameRegistry") family = (facts[0]?.value as NativeRows["GameRegistry"] | undefined)?.family;
      },
      onSnapshotEnd() {
        if (!enabled) {
          stop();
          return false;
        }
        void revalidate();
        return true;
      },
      onScope() {
        return true;
      },
      onFacts(batch) {
        if (batch.preconfirmed) return;
        const release = batch.facts.find(({ model }) => model === "GameRelease");
        if (release) {
          pin = (release.value ?? undefined) as NativeRows["GameRelease"] | undefined;
          void revalidate();
        } else if (batch.facts.some(({ model }) => WATCH_INPUTS.has(model))) changed();
      },
      onEvent() {},
      onHead() {},
      onTransaction() {},
      onStartFailure() {},
    })
    .catch((error: unknown) => {
      if (!stopped) console.error("deep_site_stream_failed", shardUrl, gameId, error);
    });
  return stop;
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
