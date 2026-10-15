import { useState } from "react";
import { latticeToWorld } from "@/three/utils/hex-lattice";
import { iconArt } from "./icon-art";
const owners = ["you", "ally", "enemy"] as const;
const symbols = { you: "●", ally: "■", enemy: "▲" };
const kinds = [
  { id: "map-realm", name: "Realm", old: "realm" },
  { id: "camp", name: "Camp", old: "village" },
  { id: "map-village", name: "Village", old: "village" },
  { id: "hyperstructure", name: "Hyperstructure", old: "hyperstructure" },
  { id: "chest", name: "Chest", old: "chest" },
  { id: "map-mine", name: "Mine", old: "fragment_mine" },
  { id: "map-army", name: "Army", old: "army" },
];
function hexPoints(radius: number, x: number, y: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return `${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`;
  }).join(" ");
}
function cell(index: number) {
  const { x, z } = latticeToWorld(index % 6, Math.floor(index / 6));
  return { x: 45 + x * 25, y: 30 + z * 25 };
}
function Badge({
  direction,
  kind,
  owner,
  size,
  value,
}: {
  direction: string;
  kind: (typeof kinds)[number];
  owner: (typeof owners)[number];
  size: number;
  value?: string;
}) {
  return (
    <>
      <span className="icon-marker">
        <svg viewBox="0 0 28 32" aria-hidden="true">
          <polygon points={hexPoints(15, 14, 16)} />
        </svg>
        <img
          src={direction === "shipped" ? `/images/labels/${kind.old}.png` : iconArt(direction, kind.id, size)}
          style={{ width: size, height: size }}
          alt=""
        />
        <i className="icon-owner-cue" data-cue={owner} aria-hidden="true" />
      </span>
      {value !== undefined && <b>{value}</b>}
    </>
  );
}

export function IconMinimap({ direction }: { direction: string }) {
  const [density, setDensity] = useState(20);
  const [size, setSize] = useState(16);
  const [sector, setSector] = useState<number>();
  const count = density + (density === 20 ? 6 : 18);
  const items = Array.from({ length: count }, (_, index) => ({
    index,
    army: index >= density,
    kind: kinds[index >= density ? 6 : index % 6],
    owner: owners[(index + Math.floor(index / 6)) % 3],
    value:
      index >= density ? "•".repeat(1 + (index % 3)) : index % 6 === 0 ? String(Math.floor(index / 6) % 4) : undefined,
    sector: Math.floor((index % 20) / 5) + Math.floor(Math.floor(index / 20) / 4) * 4,
  }));
  const visible = sector === undefined ? items : items.filter((item) => item.sector === sector);
  const grouped = density === 220 && sector === undefined;
  return (
    <div className="icon-minimap">
      <div className="icon-controls">
        <fieldset>
          <legend>Extent</legend>
          {[20, 220].map((value) => (
            <button
              key={value}
              data-density={value}
              aria-pressed={density === value && sector === undefined}
              onClick={() => {
                setDensity(value);
                setSector(undefined);
              }}
            >
              {value} sites · {value === 20 ? "detail" : "grouped"}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Painted emblem size</legend>
          {[12, 16].map((value) => (
            <button key={value} data-marker-size={value} aria-pressed={size === value} onClick={() => setSize(value)}>
              {value} px
            </button>
          ))}
        </fieldset>
      </div>
      <div className="icon-marker-kinds" aria-label="Marker kinds">
        {kinds.map((kind) => (
          <div key={kind.id} data-kind={kind.id}>
            <span className="icon-marker-key" data-owner="you">
              <Badge direction={direction} kind={kind} owner="you" size={size} />
            </span>
            <small>{kind.name}</small>
          </div>
        ))}
      </div>
      <div className="icon-map" aria-label="Minimap fixture" data-grouped={grouped}>
        {!grouped && (
          <svg className="icon-hex-grid" viewBox="0 0 320 250" aria-hidden="true">
            {Array.from({ length: 36 }, (_, index) => {
              const { x, y } = cell(index);
              return <polygon key={index} points={hexPoints(25, x, y)} />;
            })}
          </svg>
        )}
        {grouped
          ? Array.from({ length: 12 }, (_, index) => {
              const group = items.filter((item) => item.sector === index);
              const sites = group.filter((item) => !item.army).length;
              return (
                <button
                  className="icon-cluster"
                  key={index}
                  data-sector={index}
                  data-sites={sites}
                  data-armies={group.length - sites}
                  onClick={() => setSector(index)}
                >
                  <strong>
                    {sites}S · {group.length - sites}A
                  </strong>
                  <small>
                    {owners.map((owner) => (
                      <span key={owner} data-owner={owner}>
                        {symbols[owner]}
                        {group.filter((item) => item.owner === owner).length}{" "}
                      </span>
                    ))}
                  </small>
                </button>
              );
            })
          : visible.map((item, index) => {
              const { x, y } = cell(index);
              return (
                <span
                  className="icon-marker-wrap"
                  key={item.index}
                  data-index={item.index}
                  data-army={item.army}
                  data-owner={item.owner}
                  data-kind={item.kind.id}
                  style={{ left: x - 14, top: y - 16 }}
                  role="img"
                  aria-label={`${item.owner} ${item.kind.name}${item.value === undefined ? "" : `, ${item.army ? "strength band" : "level"} ${item.value}`}`}
                >
                  <Badge direction={direction} kind={item.kind} owner={item.owner} size={size} value={item.value} />
                </span>
              );
            })}
      </div>
      <p className="icon-map-note">
        {sector !== undefined
          ? `Sector ${sector} · ${visible.length} entities`
          : `${density} sites + ${count - density} armies`}
        .
      </p>
      <p className="icon-legend">
        ● You · ■ Ally · ▲ Enemy. Every badge fits one point-top hex. Realm level: 0–3. Army strength: • &lt;1k, ••
        1k–5k, ••• &gt;5k. Wide extent counts sites (S) and armies (A); open a sector to inspect every entity.
      </p>
    </div>
  );
}
