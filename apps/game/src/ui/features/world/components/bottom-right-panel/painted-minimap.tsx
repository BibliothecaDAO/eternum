import { useState, type ComponentProps } from "react";
import { HexMarker } from "@/ui/design-system/hex-marker";
import { resolveMinimapMarker } from "./minimap-markers";
import { MarkerClusters, ownershipSymbols, markerOwners } from "@/ui/design-system/painted/marker-clusters";
import { HexMinimapView } from "./hex-minimap";

type Props = ComponentProps<typeof HexMinimapView>;
export function PaintedMinimapView(props: Props) {
  const [sector, setSector] = useState<number>();
  const occupied = props.tiles.filter((tile) => tile.occupier_id && tile.occupier_id !== "0");
  let minCol = Infinity,
    minRow = Infinity,
    maxCol = -Infinity,
    maxRow = -Infinity;
  for (const tile of props.tiles) {
    minCol = Math.min(minCol, tile.col);
    minRow = Math.min(minRow, tile.row);
    maxCol = Math.max(maxCol, tile.col);
    maxRow = Math.max(maxRow, tile.row);
  }
  const width = maxCol - minCol + 1,
    height = maxRow - minRow + 1;
  const items = occupied.map((tile) => ({
    tile,
    owner:
      resolveMinimapMarker(tile, props.markers, props.ownedStructureIds, props.ownedExplorerIds)?.owner ?? "neutral",
    army: !tile.occupier_is_structure,
    sector:
      Math.min(3, Math.floor(((tile.col - minCol) / width) * 4)) +
      4 * Math.min(2, Math.floor(((tile.row - minRow) / height) * 3)),
  }));
  const crowded =
    occupied.length > 20 ||
    occupied.some((tile, i) =>
      occupied.slice(i + 1).some((other) => Math.abs(tile.col - other.col) + Math.abs(tile.row - other.row) < 2),
    );
  const grouped = crowded && sector === undefined;
  const selected = sector === undefined ? [] : items.filter((item) => item.sector === sector);
  const target = selected[0]?.tile;
  return (
    <section className="minimap" data-group="Minimap">
      <div className="minimap-heading" data-notice>
        Area map {sector !== undefined && <button onClick={() => setSector(undefined)}>Overview</button>}
      </div>
      <div className="minimap-field" aria-label="Area map markers" data-grouped={grouped}>
        <HexMinimapView
          {...props}
          cameraDistance={sector === undefined ? props.cameraDistance : 8}
          cameraTargetHex={target ? { col: target.col, row: target.row } : props.cameraTargetHex}
          renderMarker={(tile, pixel) => {
            if (!tile.occupier_id || tile.occupier_id === "0" || grouped) return <g />;
            const badge = resolveMinimapMarker(tile, props.markers, props.ownedStructureIds, props.ownedExplorerIds);
            if (!badge) return <g />;
            return (
              <g data-entity-id={tile.occupier_id} data-marker-kind={badge.name} data-marker-hex-radius="7">
                <HexMarker {...badge} x={pixel.x} y={pixel.y} radius={6.5} />
              </g>
            );
          }}
        />
        {grouped && <MarkerClusters items={items} onSelect={setSector} />}
      </div>
      <p className="map-legend" data-notice>
        {markerOwners.map((owner) => (
          <span key={owner} data-owner={owner}>
            {ownershipSymbols[owner]}{" "}
            {owner === "you" ? "You" : owner === "ally" ? "Ally" : owner === "enemy" ? "Enemy" : "Neutral"}
          </span>
        ))}
      </p>
      <p className="map-values" data-notice>
        Realm level · army strength
      </p>
    </section>
  );
}
