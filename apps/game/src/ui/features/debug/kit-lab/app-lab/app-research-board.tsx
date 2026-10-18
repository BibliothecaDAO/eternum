import { AppChip, AppPanel } from "@/ui/design-system/kit/app-elements";

import { PRINCIPLES, REFERENCES, type Reference, SOURCES, TAKEN } from "./app-research";

/**
 * The research board, first on /lab/kit/app: shipped game launchers and menus (desktop, then mobile), what makes them
 * simple and efficient, and what the app's pages take from them.
 */
export const ResearchBoard = () => (
  <section id="research" data-sheet-element="Research" className="flex flex-col gap-4 rounded-lg bg-black/20 p-4">
    <header data-lab-chrome className="flex flex-col gap-1">
      <h2 className="text-lg font-bold text-white">Research: shipped game launchers and menus</h2>
      <p className="text-sm text-white/60">
        What each puts on its first screen, where its one verb sits and how it uses pictures; desktop first, then
        mobile. Read from the shipped clients and the sources below; their screens are in the Game UI Database.
      </p>
    </header>
    {(["desktop", "mobile"] as const).map((platform) => (
      <AppPanel key={platform} title={platform === "desktop" ? "Desktop" : "Mobile"} flush>
        <ReferenceTable references={REFERENCES.filter((reference) => reference.platform === platform)} />
      </AppPanel>
    ))}
    <div className="grid grid-cols-2 gap-4">
      <AppPanel title="What makes them simple and efficient">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-app-body text-app-ink">
          {PRINCIPLES.map((principle) => (
            <li key={principle.rule}>
              {principle.rule} <span className="text-app-label text-app-muted">{principle.seen}</span>
            </li>
          ))}
        </ol>
      </AppPanel>
      <AppPanel title="What the app takes">
        <dl className="flex flex-col gap-2 text-app-body text-app-ink">
          {TAKEN.map((taken) => (
            <div key={taken.where} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
              <dt className="text-app-strong">{taken.where}</dt>
              <dd>{taken.what}</dd>
            </div>
          ))}
        </dl>
      </AppPanel>
    </div>
    <p className="flex flex-wrap gap-2">
      {SOURCES.map((source) => (
        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
          <AppChip>{source.label}</AppChip>
        </a>
      ))}
    </p>
  </section>
);

const COLUMNS = ["Game", "First screen", "The verb", "Pictures", "Lesson"] as const;

const ReferenceTable = ({ references }: { references: readonly Reference[] }) => (
  <table className="w-full border-collapse text-left align-top text-app-label text-app-ink">
    <thead className="text-app-muted">
      <tr>
        {COLUMNS.map((column) => (
          <th key={column} className="border-b border-app-line px-4 py-2">
            {column}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {references.map((reference) => (
        <tr key={reference.game} className="align-top">
          <td className="w-48 border-b border-app-line px-4 py-2 text-app-strong">{reference.game}</td>
          <td className="border-b border-app-line px-4 py-2">{reference.screen}</td>
          <td className="border-b border-app-line px-4 py-2">{reference.verb}</td>
          <td className="border-b border-app-line px-4 py-2">{reference.pictures}</td>
          <td className="border-b border-app-line px-4 py-2 text-[rgb(var(--app-accent))]">{reference.lesson}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
