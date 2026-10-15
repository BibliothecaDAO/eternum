import { useState } from "react";
import { iconArt } from "./icon-art";
const owners = ["you", "ally", "enemy"] as const;
const symbols = { you: "●", ally: "■", enemy: "▲" };

export function IconMinimap({ direction }: { direction: string }) {
  const [density, setDensity] = useState(20);
  const [size, setSize] = useState(16);
  const [sector, setSector] = useState<number>();
  const count = density + (density === 20 ? 6 : 18);
  const items = Array.from({ length: count }, (_, index) => ({
    index,
    army: index >= density,
    owner: owners[index % 3],
    value: index >= density ? "•".repeat(1 + (index % 3)) : String(index % 4),
    sector: Math.floor((index % 20) / 5) + Math.floor(Math.floor(index / 20) / 4) * 4,
  }));
  const visible = sector === undefined ? items : items.filter((item) => item.sector === sector);
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
      <div className="icon-map" aria-label="Minimap fixture">
        {density === 220 && sector === undefined
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
          : visible.map((item) => (
              <span
                className="icon-marker-wrap"
                key={item.index}
                data-index={item.index}
                data-army={item.army}
                data-owner={item.owner}
                role="img"
                aria-label={`${item.owner} ${item.army ? "army, strength band" : "realm, level"} ${item.value}`}
              >
                <span className="icon-marker">
                  <img
                    src={iconArt(direction, item.army ? "map-army" : "map-realm", size)}
                    style={{ width: size, height: size }}
                    alt=""
                  />
                </span>
                <b>{item.value}</b>
              </span>
            ))}
      </div>
      <p className="icon-map-note">
        {sector !== undefined
          ? `Sector ${sector} · ${visible.length} entities`
          : `${density} realm sites + ${count - density} armies`}
        .
      </p>
      <p className="icon-legend">
        ● You · ■ Ally · ▲ Enemy. Realm level: 0–3. Army strength: • &lt;1k, •• 1k–5k, ••• &gt;5k. At wide extent, each
        sector counts sites (S) and armies (A); open it to inspect every entity.
      </p>
    </div>
  );
}
