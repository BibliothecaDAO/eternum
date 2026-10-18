import { useState } from "react";
import { Icon } from "@/ui/design-system/icon";
import { iconDefinition, type IconMeaning } from "@/ui/design-system/icon-meaning";
import resources from "../../../../../asset-sources/facets/resources.json";
import study from "../../../../../asset-sources/rss-icons/catalog.json";
import history from "../../../../../asset-sources/rss-icons/history.json";
import "./resource-icons-lab.css";

type Version = "old" | "before" | "current" | "facets";
function Artwork({ meaning, version, size }: { meaning: string; version: Version; size: number }) {
  if (version === "current") return <Icon name={meaning as IconMeaning} size={size} />;
  if (version === "facets")
    return (
      <img
        data-relic-proposal={meaning}
        src={`/lab/rss-icons/relics/${size > 32 ? 128 : 64}/${meaning}.webp`}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        alt=""
        draggable={false}
      />
    );
  const previous = history.entries[meaning as keyof typeof history.entries];
  const url = version === "before" ? `/lab/rss-icons/before/${size > 32 ? 128 : 64}/${meaning}.webp` : previous.url;
  return url ? (
    <img
      src={url}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
      alt=""
      draggable={false}
    />
  ) : (
    <span className="rss-history-glyph" style={{ fontSize: size }}>
      {previous.glyph}
    </span>
  );
}
function Sizes({ meaning, version }: { meaning: string; version: Version }) {
  return (
    <div className="rss-sizes">
      {[16, 24, 32, 40].map((size) => (
        <div key={size}>
          <span className="rss-art-slot" data-size={size} style={{ width: size, height: size }}>
            <Artwork meaning={meaning} version={version} size={size} />
          </span>
          <small>{size} px</small>
        </div>
      ))}
    </div>
  );
}
function Comparison({ meaning, versions }: { meaning: string; versions: Version[] }) {
  return (
    <div className="rss-comparison" data-resource-comparison={meaning}>
      <h3>{iconDefinition(meaning as IconMeaning).label}</h3>
      <div className="rss-versions">
        {versions.map((version) => (
          <figure data-version={version} key={version}>
            <figcaption>
              {version === "old"
                ? "Pre-Facets"
                : version === "before"
                  ? "Before"
                  : version === "facets"
                    ? "Facets style · proposal"
                    : meaning.includes("-relic-")
                      ? "Old · production"
                      : "Current · production"}
            </figcaption>
            <Sizes meaning={meaning} version={version} />
          </figure>
        ))}
      </div>
    </div>
  );
}
export function ResourceIconsLab() {
  const [section, setSection] = useState("Relics");
  return (
    <main className="rss-lab">
      <header>
        <h1>Resource icons</h1>
        <p>
          Old relic designs repainted in Facets, compared at 16, 24, 32 and 40 px. The old relics stay in production
          until selected.
        </p>
      </header>
      <nav aria-label="Resource review sections">
        {["Resources", "Relics", "Models", "Kept", "Inventory"].map((name) => (
          <button
            data-resource-section={name}
            key={name}
            aria-pressed={section === name}
            onClick={() => setSection(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {section === "Relics" && (
        <p>
          All 18 proposals preserve the old symbols, compositions and tier distinctions. Prefer 40 px for the larger
          sheet; compare 32 px for family and tier recognition, and 16/24 px for compact use.
        </p>
      )}
      {section === "Models" && (
        <p>
          Rendered directly from the current game models. Workshop keeps its shipped icon until its dedicated model is
          ready. The Hyperstructure site uses the game’s foundation-only model kit.
        </p>
      )}
      {study.changes
        .filter((entry) => entry.group === section)
        .map((entry) => (
          <article key={entry.meaning} data-change={entry.meaning}>
            <Comparison
              meaning={entry.meaning}
              versions={section === "Relics" ? ["current", "facets"] : ["before", "current"]}
            />
            {section === "Models" && (
              <figure className="rss-model">
                <img
                  src={`/lab/rss-icons/models/${entry.meaning}.png`}
                  width={180}
                  height={180}
                  alt={`${iconDefinition(entry.meaning as IconMeaning).label} model render`}
                />
                <figcaption>Actual model render</figcaption>
              </figure>
            )}
            {section !== "Relics" && <p>{entry.note}</p>}
          </article>
        ))}
      {section === "Kept" && (
        <>
          <p>
            All other resources, all nine troop tiers, Labor and UI glyphs are unchanged. Workshop waits for its model.
          </p>
          <div className="rss-inventory">
            {study.kept.map((meaning) => (
              <Comparison key={meaning} meaning={meaning} versions={["current"]} />
            ))}
          </div>
        </>
      )}
      {section === "Inventory" && (
        <div className="rss-inventory">
          {Object.entries(resources).map(([id, resource]) => (
            <div key={id} data-resource-id={id}>
              <Comparison meaning={resource.meaning} versions={["old", "current"]} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
