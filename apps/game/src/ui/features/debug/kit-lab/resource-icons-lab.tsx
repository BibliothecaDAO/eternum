import { useState } from "react";
import { resources as resourceDefinitions } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";
import { type IconMeaning } from "@/ui/design-system/icon-meaning";
import resources from "../../../../../asset-sources/facets/resources.json";
import study from "../../../../../asset-sources/rss-icons/catalog.json";
import "./resource-icons-lab.css";

type Proposal = (typeof study.proposals)[number];
const label = (meaning: string) => {
  const entry = Object.entries(resources).find(([, resource]) => resource.meaning === meaning);
  const definition = resourceDefinitions.find((resource) => resource.id === Number(entry?.[0]));
  if (!definition) throw new Error(`Missing resource label for ${meaning}`);
  return meaning === "lords" ? "LORDS" : definition.trait;
};

/** Review artwork is deliberately confined to this lab; the semantic map stays the shipped set. */
function Sample({ meaning, option }: { meaning: string; option?: string }) {
  const art = (size: number) =>
    option ? (
      <img
        data-proposal-art={option}
        src={`/lab/rss-icons/${size > 32 ? 128 : 64}/${option}.webp`}
        width={size}
        height={size}
        alt=""
        draggable={false}
      />
    ) : (
      <Icon name={meaning as IconMeaning} size={size} />
    );
  return (
    <div className="rss-sample">
      <span className="rss-ring" data-size="40">
        <span className="rss-ring-face">{art(40)}</span>
        <span className="rss-ring-count">1.2K</span>
      </span>
      {[20, 16].map((size) => (
        <span key={size} className="rss-chip" data-size={size}>
          {art(size)}
          <span>120</span>
        </span>
      ))}
    </div>
  );
}

function Comparison({ proposal }: { proposal: Proposal }) {
  return (
    <article data-resource-study={proposal.meaning} className="rss-comparison">
      <h3>
        {label(proposal.meaning)} <small>{proposal.risk} confusion risk</small>
      </h3>
      <p>
        {proposal.shape} {proposal.colourValue}
      </p>
      <div className="rss-options">
        <figure data-version="shipped">
          <figcaption>Shipped</figcaption>
          <Sample meaning={proposal.meaning} />
        </figure>
        {proposal.options.map((option, index) => (
          <figure key={option.id} data-version={index === 0 ? "a" : "b"}>
            <figcaption>
              {index === 0 ? "A" : "B"} · {option.label}
            </figcaption>
            <Sample meaning={proposal.meaning} option={option.id} />
          </figure>
        ))}
      </div>
      <div className="rss-neighbours">
        {proposal.against.map((meaning) => (
          <figure key={meaning}>
            <figcaption className="rss-name">{label(meaning)} · shipped neighbour</figcaption>
            <Sample meaning={meaning} />
          </figure>
        ))}
      </div>
      <p className="rss-note">Lore: {proposal.lore}</p>
    </article>
  );
}

export function ResourceIconsLab() {
  const [tab, setTab] = useState("Inventory");
  const [labels, setLabels] = useState(true);
  const [vision, setVision] = useState("colour");
  const [art, setArt] = useState("shipped");
  return (
    <main className="rss-lab" data-labels={labels} data-vision={vision}>
      <header>
        <h1>Resource icon review</h1>
        <p>58 resources. 17 proposed changes, two options each. 41 kept. Nothing changes in the game until selected.</p>
        <p>40 px painting in the ring · 20 px and 16 px chips. Same surfaces and amounts for every comparison.</p>
      </header>
      <div className="rss-controls">
        <nav aria-label="Resource review sections">
          {["Inventory", "Materials", "Troops", "Relics", "Kept pairs"].map((name) => (
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
      {tab === "Inventory" ? (
        <section aria-label="All resource icons">
          <div className="rss-controls">
            <label>
              Inventory artwork{" "}
              <select aria-label="Inventory artwork" value={art} onChange={(event) => setArt(event.target.value)}>
                <option value="shipped">Shipped</option>
                <option value="a">Option A</option>
                <option value="b">Option B</option>
              </select>
            </label>
            <span>Only the 17 reviewed meanings change when an option is selected.</span>
          </div>
          <div className="rss-inventory" data-inventory-art={art}>
            {Object.entries(resources).map(([id, resource]) => {
              const proposal = study.proposals.find((entry) => entry.meaning === resource.meaning);
              const option = art === "shipped" ? undefined : proposal?.options[art === "a" ? 0 : 1].id;
              return (
                <figure key={id} data-resource-id={id}>
                  <figcaption className="rss-name">
                    {id} · {label(resource.meaning)}
                  </figcaption>
                  <Sample meaning={resource.meaning} option={option} />
                </figure>
              );
            })}
          </div>
        </section>
      ) : tab === "Kept pairs" ? (
        <section aria-label="Kept resource comparisons">
          {study.controls.map((control) => (
            <article className="rss-comparison" key={control.meanings.join("-")}>
              <h3>{control.risk}</h3>
              <p>{control.reason}</p>
              <div className="rss-neighbours">
                {control.meanings.map((meaning) => (
                  <figure key={meaning}>
                    <figcaption className="rss-name">{label(meaning)}</figcaption>
                    <Sample meaning={meaning} />
                  </figure>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section aria-label={`${tab} comparisons`}>
          {study.proposals
            .filter((proposal) => proposal.family === tab)
            .map((proposal) => (
              <Comparison key={proposal.meaning} proposal={proposal} />
            ))}
        </section>
      )}
      <footer>
        {study.method} Lore: {study.loreSource}. Baseline {study.base.slice(0, 12)}.
      </footer>
    </main>
  );
}
