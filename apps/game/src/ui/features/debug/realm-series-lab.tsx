import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { orders } from "@bibliothecadao/types";
import { mountRealmSeries, type RealmSeriesSettings } from "@/three/debug/model-lab/realm-series-renderer";

export function RealmSeriesLab() {
  const [params, setParams] = useSearchParams();
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading");
  const [loaded, setLoaded] = useState("");
  const seed = params.get("seed") ?? "1003";
  const settings: RealmSeriesSettings = {
    level: Math.max(0, Math.min(3, Number(params.get("level") ?? 0))),
    wonder: params.get("wonder") === "1",
    seed,
    order: Number(params.get("order") ?? orders[0].orderId),
    owned: params.get("owned") !== "0",
    distance: Number(params.get("distance") ?? 10),
    lineup: params.get("lineup") === "1",
    reference: params.get("wonder") === "1" ? undefined : (params.get("reference") ?? undefined),
    comparison:
      params.get("comparison") === "before" ? "before" : params.get("comparison") === "pair" ? "pair" : "after",
  };
  const signature = JSON.stringify(settings);
  useEffect(() => {
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    setStatus("Loading");
    void mountRealmSeries(host.current!, JSON.parse(signature), controller.signal)
      .then((view) => {
        dispose = view.dispose;
        if (controller.signal.aborted) dispose();
        else {
          setStatus(view.labels.join(" · "));
          setLoaded(signature);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(`Error: ${error.message}`);
      });
    return () => {
      controller.abort();
      dispose?.();
    };
  }, [signature]);
  const change = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });
  return (
    <main
      style={{
        height: "var(--lab-viewport-height, 100vh)",
        display: "flex",
        flexDirection: "column",
        background: "#172322",
        color: "#eee",
      }}
    >
      <header style={{ padding: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/lab">Lab</Link>
        <strong>Realms · production series</strong>
        {settings.reference && (
          <label>
            Revision{" "}
            <select
              aria-label="Revision"
              value={settings.comparison}
              onChange={(e) => change("comparison", e.target.value)}
            >
              <option value="after">After</option>
              <option value="before">Before</option>
              <option value="pair">Before / After</option>
            </select>
          </label>
        )}
        <label>
          Age{" "}
          <select aria-label="Age" value={settings.level} onChange={(e) => change("level", e.target.value)}>
            {["Canvas & Thatch", "Terrace Forum", "Twin Ward", "Empire"].map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Series{" "}
          <select
            aria-label="Series"
            value={Number(settings.wonder)}
            onChange={(e) => change("wonder", e.target.value)}
          >
            <option value="0">Normal</option>
            <option value="1">Wonder</option>
          </select>
        </label>
        <label>
          Entity{" "}
          <select aria-label="Entity" value={seed} onChange={(e) => change("seed", e.target.value)}>
            {[1002, 1003, 1004, 1008, 1009, 1010, 1042, 1043].map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        <label>
          Order{" "}
          <select aria-label="Order" value={settings.order} onChange={(e) => change("order", e.target.value)}>
            {orders.map((order) => (
              <option key={order.orderId} value={order.orderId}>
                {order.orderName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ownership{" "}
          <select
            aria-label="Ownership"
            value={Number(settings.owned)}
            onChange={(e) => change("owned", e.target.value)}
          >
            <option value="1">Owned</option>
            <option value="0">Other</option>
          </select>
        </label>
        <label>
          View{" "}
          <select aria-label="Distance" value={settings.distance} onChange={(e) => change("distance", e.target.value)}>
            {[
              [6, "Close"],
              [20, "Gameplay"],
              [45, "Far"],
              [10, "Detail"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.lineup}
            disabled={Boolean(settings.reference && settings.comparison !== "after")}
            onChange={(e) => change("lineup", e.target.checked ? "1" : "0")}
          />{" "}
          All ages
        </label>
      </header>
      <p role="status" style={{ padding: "0 16px" }}>
        {status}
      </p>
      <div
        ref={host}
        style={{ flex: 1, minHeight: 0 }}
        data-realm-ready={loaded === signature && status !== "Loading" && !status.startsWith("Error")}
        data-realm-loaded={loaded}
      />
    </main>
  );
}
