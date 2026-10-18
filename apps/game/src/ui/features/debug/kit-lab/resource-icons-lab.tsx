import { useState } from "react";
import { resources as resourceDefinitions } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";
import { iconDefinition, type IconMeaning } from "@/ui/design-system/icon-meaning";
import resources from "../../../../../asset-sources/facets/resources.json";
import study from "../../../../../asset-sources/rss-icons/catalog.json";
import history from "../../../../../asset-sources/rss-icons/history.json";
import "./resource-icons-lab.css";

type Category = (typeof study.categories)[number];
type Version = "old" | "shipped" | "proposal";
const label = (meaning: string) => {
  const entry = Object.entries(resources).find(([, resource]) => resource.meaning === meaning);
  const definition = resourceDefinitions.find((resource) => resource.id === Number(entry?.[0]));
  if (!definition) return iconDefinition(meaning as IconMeaning).label;
  return meaning === "lords" ? "LORDS" : definition.trait;
};

/** Review artwork is confined to this lab; production still resolves through Icon. */
function Artwork({ meaning, art, version, size }: { meaning: string; art?: string; version: Version; size: number }) {
  if (version === "shipped") return <Icon name={meaning as IconMeaning} size={size} />;
  if (version === "proposal") {
    if (!art) throw new Error(`Missing template sample for ${meaning}`);
    return (
      <img
        data-proposal-art={art}
        src={`/lab/rss-icons/${size > 32 ? 128 : 64}/${art}.webp`}
        width={size}
        height={size}
        alt=""
        draggable={false}
      />
    );
  }
  const previous = history.entries[meaning as keyof typeof history.entries];
  return previous.url ? (
    <img
      data-history-art={meaning}
      src={previous.url}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      alt=""
      draggable={false}
    />
  ) : (
    <span
      data-history-glyph={meaning}
      className="rss-history-glyph"
      style={{ width: size, height: size, fontSize: size }}
    >
      {previous.glyph}
    </span>
  );
}

function Sizes({ meaning, art, version }: { meaning: string; art?: string; version: Version }) {
  const tier = meaning.match(/-relic-([12])$/)?.[1];
  return (
    <div className="rss-sizes" data-meaning={meaning}>
      {[16, 24, 32, 40].map((size) => (
        <div className="rss-size" key={size}>
          <span className={size === 40 && !tier ? "rss-art-slot rss-art-slot--ring" : "rss-art-slot"} data-size={size}>
            <Artwork meaning={meaning} art={art} version={version} size={size} />
            {tier && (
              <span className="rss-tier-mark" data-tier={tier}>
                {tier === "1" ? "I" : "II"}
              </span>
            )}
          </span>
          <small>{size} px</small>
        </div>
      ))}
    </div>
  );
}

function Comparison({ meaning, art }: { meaning: string; art?: string }) {
  const versions: Version[] = art ? ["old", "shipped", "proposal"] : ["old", "shipped"];
  return (
    <div className="rss-resource-comparison" data-resource-comparison={meaning}>
      <h3 className="rss-name">{label(meaning)}</h3>
      <div className="rss-versions">
        {versions.map((version) => (
          <figure key={version} data-version={version}>
            <figcaption>{version === "old" ? "Old" : version === "shipped" ? "Shipped" : "Template sample"}</figcaption>
            <Sizes meaning={meaning} art={art} version={version} />
          </figure>
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ category }: { category: Category }) {
  return (
    <article className="rss-template" data-template={category.id}>
      <header>
        <h2>{category.name}</h2>
        <p>
          {category.members.length} resources assigned. {category.samples.length} sample reskins. Template awaiting
          owner selection.
        </p>
        {category.id === "relics" && (
          <p>
            Use 40 px for the larger relic sheet; 32 px is the minimum proposed size. The 16/24 px columns expose what
            gets lost.
          </p>
        )}
      </header>
      <TemplateRules template={category.template} />
      <div className="rss-template-samples">
        {category.samples.map((sample) => (
          <section key={sample.art} data-template-sample={sample.art}>
            {sample.meanings.map((meaning) => (
              <Comparison key={meaning} meaning={meaning} art={sample.art} />
            ))}
          </section>
        ))}
      </div>
      <h3>Palette slots and the one distinguishing feature</h3>
      <div className="rss-palette">
        {category.members.map((member) => (
          <div key={member.meaning} data-template-member={member.meaning}>
            <span className="rss-swatch" style={{ background: member.color }} />
            <span>
              <strong className="rss-name">{label(member.meaning)}</strong>
              <small>{member.feature}</small>
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function TemplateRules({ template }: { template: Category["template"] }) {
  const titles: Record<keyof Category["template"], string> = {
    silhouette: "Silhouette",
    framing: "Framing",
    light: "Light",
    outline: "Edge",
    value: "Value",
    palette: "Palette",
    detail: "Detail budget",
    fit: "Ring / chip fit",
  };
  return (
    <dl className="rss-contract">
      {Object.entries(template).map(([key, rule]) => (
        <div key={key}>
          <dt>{titles[key as keyof Category["template"]]}</dt>
          <dd>{rule}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ResourceIconsLab() {
  const [tab, setTab] = useState("Templates");
  const [category, setCategory] = useState("all");
  const [labels, setLabels] = useState(true);
  const [vision, setVision] = useState("colour");
  const [art, setArt] = useState<"old" | "shipped">("shipped");
  return (
    <main className="rss-lab" data-labels={labels} data-vision={vision}>
      <header>
        <h1>Icon style sheet</h1>
        <p>
          Choose the category templates first. Nine templates, 21 sample reskins, all 58 resources assigned. The rest
          wait for selection.
        </p>
        <p>
          Compare Old, Shipped and Template at 16, 24, 32 and 40 px. Relics use one symbol with the same external I / II
          mark.
        </p>
        <p>Production is unchanged. LORDS keeps its official SVG; SAT and the pack donkey stay as shipped.</p>
      </header>
      <div className="rss-controls">
        <nav aria-label="Resource review sections">
          {["Templates", "Other families", "Inventory", "Findings"].map((name) => (
            <button key={name} onClick={() => setTab(name)} aria-pressed={tab === name}>
              {name}
            </button>
          ))}
        </nav>
        <label>
          View{" "}
          <select aria-label="Resource view" value={vision} onChange={(event) => setVision(event.target.value)}>
            <option value="colour">Colour</option>
            <option value="greyscale">Greyscale</option>
            <option value="silhouette">Silhouette</option>
          </select>
        </label>
        <button aria-pressed={!labels} onClick={() => setLabels(!labels)}>
          {labels ? "Hide names" : "Show names"}
        </button>
      </div>
      {tab === "Templates" ? (
        <section aria-label="Category templates">
          <label className="rss-category-select">
            Category{" "}
            <select
              aria-label="Template category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">All templates</option>
              {study.categories.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
              <option value="retained">Retained marks and carrier</option>
            </select>
          </label>
          {study.categories
            .filter((entry) => category === "all" || category === entry.id)
            .map((entry) => (
              <TemplateCard key={entry.id} category={entry} />
            ))}
          {(category === "all" || category === "retained") && (
            <article className="rss-template" data-template="retained">
              <h2>Retained marks and carrier</h2>
              {study.retained.map((entry) => (
                <section key={entry.meaning} data-retained={entry.meaning}>
                  <p>{entry.reason}</p>
                  <Comparison meaning={entry.meaning} />
                </section>
              ))}
            </article>
          )}
        </section>
      ) : tab === "Other families" ? (
        <section aria-label="Other icon families">
          <p>
            Template rules drawn from the shipped set. These paintings stay as shipped; troop portrait reskins are in
            Templates → People and troops. Building cards continue to use renders of the actual models.
          </p>
          {study.shippedFamilies.map((family) => (
            <article className="rss-template" key={family.id} data-shipped-family={family.id}>
              <h2>{family.name}</h2>
              <TemplateRules template={family.template} />
              <div className="rss-neighbours">
                {family.members.map((meaning) => (
                  <figure key={meaning}>
                    <figcaption className="rss-name">{label(meaning)} · shipped</figcaption>
                    <Sizes meaning={meaning} version="shipped" />
                  </figure>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : tab === "Inventory" ? (
        <section aria-label="All resource icons">
          <label className="rss-category-select">
            Inventory artwork{" "}
            <select
              aria-label="Inventory artwork"
              value={art}
              onChange={(event) => setArt(event.target.value as "old" | "shipped")}
            >
              <option value="shipped">Shipped</option>
              <option value="old">Old · before Facets</option>
            </select>
          </label>
          <div className="rss-inventory" data-inventory-art={art}>
            {Object.entries(resources).map(([id, resource]) => (
              <figure key={id} data-resource-id={id}>
                <figcaption className="rss-name">
                  {id} · {label(resource.meaning)}
                </figcaption>
                <Sizes meaning={resource.meaning} version={art} />
              </figure>
            ))}
          </div>
        </section>
      ) : (
        <section aria-label="Confusion findings">
          <p>
            These findings describe the shipped set. The template samples above are the new direction; the per-icon A/B
            choices have been retired.
          </p>
          {study.confusions.map((entry) => (
            <article className="rss-template" key={entry.meaning} data-confusion={entry.meaning}>
              <h2>{label(entry.meaning)}</h2>
              <p>
                {entry.shape} {entry.colourValue}
              </p>
              <div className="rss-neighbours">
                {[entry.meaning, ...entry.against].map((meaning) => (
                  <figure key={meaning}>
                    <figcaption className="rss-name">{label(meaning)}</figcaption>
                    <Sizes meaning={meaning} version="shipped" />
                  </figure>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
      <footer>
        {study.method} Lore: {study.loreSource}. Old set {history.revision.slice(0, 12)}, before replacement{" "}
        {history.replacedBy.slice(0, 12)}. Donkey used the trade thumbnail; SAT used a text glyph.
      </footer>
    </main>
  );
}
