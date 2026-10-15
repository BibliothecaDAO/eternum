import "./marker-clusters.css";
import type { MarkerOwner } from "../hex-marker";
export const markerOwners = ["you", "ally", "enemy", "neutral"] as const;
export const ownershipSymbols = { you: "●", ally: "■", enemy: "▲", neutral: "◆" };
export function MarkerClusters({
  items,
  onSelect,
}: {
  items: { sector: number; army: boolean; owner: MarkerOwner }[];
  onSelect: (sector: number) => void;
}) {
  return (
    <div className="marker-clusters">
      {Array.from({ length: 12 }, (_, sector) => {
        const group = items.filter((item) => item.sector === sector);
        const sites = group.filter((item) => !item.army).length;
        return (
          <button
            className="icon-cluster"
            key={sector}
            data-sector={sector}
            data-sites={sites}
            data-armies={group.length - sites}
            disabled={!group.length}
            onClick={() => onSelect(sector)}
          >
            <strong>
              {sites}S · {group.length - sites}A
            </strong>
            <small>
              {markerOwners.map((owner) => (
                <span key={owner} data-owner={owner}>
                  {ownershipSymbols[owner]}
                  {group.filter((item) => item.owner === owner).length}{" "}
                </span>
              ))}
            </small>
          </button>
        );
      })}
    </div>
  );
}
