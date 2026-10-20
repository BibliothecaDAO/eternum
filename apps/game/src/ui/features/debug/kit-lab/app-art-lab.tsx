import { Link } from "react-router-dom";
import { paintingSources, type Painting } from "@/ui/design-system/kit/paintings";

const STUDIES: { title: string; reference: Painting; painting: Painting; reason: string; page: string }[] = [
  {
    title: "Season · the seasonal citadel",
    reference: "winter-fortress",
    painting: "season-citadel",
    reason:
      "An inhabited citadel for the long competition. The winter fortress supplies the scale and cold atmosphere; warm masonry separates Season from the signed-out profile. The lower valley stays quiet behind the boards.",
    page: "/lab/app/season-running/season?capture=1",
  },
  {
    title: "Blitz Results · after the battle",
    reference: "blitz-spires",
    painting: "blitz-aftermath",
    reason:
      "The same spire and orb after the fighting, with the valley left open behind the ledger. No victory celebration: Results belongs to winners and losers. Lobby and age cards keep the active spire painting.",
    page: "/lab/app/reward-sealed/results/0x5245414c4d53-7?capture=1",
  },
];

export function AppArtLab() {
  return (
    <main className="h-full overflow-auto bg-kit-ground p-6 font-body text-kit-cream" data-app-art>
      <h1 className="text-title font-bold">App background paintings</h1>
      <p>Two additions on the existing painting path. Play and Lobby keep their age paintings.</p>
      <Link to="/lab/kit">HUD sheet</Link>
      {STUDIES.map((study) => (
        <section key={study.painting} data-art-study={study.painting} className="mt-6 border-t border-kit-line pt-4">
          <h2 className="text-heading font-bold">{study.title}</h2>
          <p className="my-2 max-w-5xl">{study.reason}</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {([study.reference, study.painting] as const).map((painting, index) => (
              <figure key={painting}>
                <figcaption className="mb-2">
                  {index === 0 ? "Existing style reference" : "New page background"} · {painting}
                </figcaption>
                <img
                  className="aspect-[3/2] w-full object-cover"
                  alt={painting}
                  {...paintingSources(painting)}
                  sizes="50vw"
                />
              </figure>
            ))}
          </div>
          <Link className="my-3 inline-block underline" to={study.page}>
            Open {study.painting === "season-citadel" ? "Season" : "Blitz Results"} on the real page
          </Link>
        </section>
      ))}
    </main>
  );
}
