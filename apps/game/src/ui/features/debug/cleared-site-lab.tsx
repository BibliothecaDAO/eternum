import { SiteReceipt } from "../frontier/sites/site-receipt";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { siteReward } from "@bibliothecadao/eternum";
import { formatAmount, resourceName, structureName, StructureType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { mountClearedSiteStudy, type ClearedSiteStudy } from "@/three/debug/model-lab/cleared-site-renderer";
import { Icon } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { XP } from "@/ui/design-system/kit/words";
import { campBeside } from "../frontier/sites/site-fixture";
import { siteClearXp } from "../frontier/sites/site-card-plan";
import "./cleared-site-lab.css";

/** The shipped standard and receipt beside the standing site, over native fixture facts. */
export function ClearedSiteLab() {
  const [params, setParams] = useSearchParams();
  const kind: ClearedSiteStudy = params.get("site") === "stragglers" ? "stragglers" : "camp";
  const distance = params.get("distance") === "8" ? 8 : 20;
  const host = useRef<HTMLDivElement>(null);
  const [selected, select] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState<string | null>(null);
  const signature = `${kind}:${distance}`;
  const fixture = useMemo(() => campBeside(kind === "camp" ? "Camp" : "Stragglers"), [kind]);
  const reward = siteReward(kind === "camp" ? "Camp" : "Stragglers", fixture.site);
  const cleared = useMemo(() => {
    const source = campBeside(kind === "camp" ? "Camp" : "Stragglers");
    source.store.applyFacts([
      {
        model: "ExpeditionSite",
        key: "0x72",
        value: {
          ...source.site,
          clear: {
            explorer_id: 201n,
            home_id: 7n,
            reward: reward ? { resource_type: reward.resourceType, amount: reward.amount } : null,
          },
        },
      },
    ]);
    return { site: source.store.require("ExpeditionSite", source.site), structure: source.structure };
  }, [kind, reward?.amount, reward?.resourceType]);
  const name = structureName(fixture.structure.base.category);

  useEffect(() => {
    const abort = new AbortController();
    let dispose: (() => void) | undefined;
    setError(null);
    void mountClearedSiteStudy(host.current!, { kind, distance }, abort.signal, select)
      .then((view) => {
        dispose = view.dispose;
        if (abort.signal.aborted) dispose();
        else setLoaded(`${kind}:${distance}`);
      })
      .catch((reason: unknown) => {
        if (!abort.signal.aborted) setError(String(reason));
      });
    return () => {
      abort.abort();
      dispose?.();
    };
  }, [kind, distance]);

  const change = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(key, value);
      return next;
    });

  return (
    <main className="cleared-site-lab" data-ready={loaded === signature && !error}>
      <header>
        <Link to="/lab">Lab</Link>
        <div>
          <h1>After the fight</h1>
          <p>Standing site · cleared standard</p>
        </div>
        <label>
          Site{" "}
          <select aria-label="Site" value={kind} onChange={(event) => change("site", event.target.value)}>
            <option value="camp">{structureName(StructureType.Camp)}</option>
            <option value="stragglers">{structureName(StructureType.Stragglers)}</option>
          </select>
        </label>
        <label>
          View{" "}
          <select aria-label="View" value={distance} onChange={(event) => change("distance", event.target.value)}>
            <option value="20">Gameplay</option>
            <option value="8">Detail</option>
          </select>
        </label>
      </header>
      <section className="cleared-site-stage">
        <div className="cleared-site-canvas" ref={host} />
        {(loaded !== signature || error) && (
          <p role="status" className="cleared-site-loading">
            {error ?? "Loading the world…"}
          </p>
        )}
        <div className="cleared-site-choices">
          <button aria-pressed={selected === false} onClick={() => select(false)}>
            Select current site
          </button>
          <button aria-pressed={selected === true} onClick={() => select(true)}>
            Select cleared site
          </button>
        </div>
        {selected !== null && (
          <aside className="cleared-site-receipt" aria-label="Selected site">
            <button className="cleared-site-close" aria-label="Close site" onClick={() => select(null)}>
              ×
            </button>
            {selected ? (
              <SiteReceipt selected={cleared} />
            ) : (
              <>
                <span className="cleared-site-status">{selected ? "Cleared" : "Standing"}</span>
                <h2>{name}</h2>
                <p>{selected ? "Clear reward" : "Reward for clearing"}</p>
                <div className="cleared-site-rewards">
                  {reward && (
                    <span>
                      <Icon name={resourceMeaning(reward.resourceType)} size={28} />
                      <strong>{formatAmount(Number(reward.amount) / RESOURCE_PRECISION)}</strong>{" "}
                      {resourceName(reward.resourceType)}
                    </span>
                  )}
                  <span>
                    <strong>{formatAmount(siteClearXp(fixture.site))}</strong> {XP}
                  </span>
                </div>
              </>
            )}
          </aside>
        )}
      </section>
      <footer>
        The standard leaves the tile centre open. Select it to read the stored clear reward. Drag to orbit or scroll to
        inspect.
      </footer>
    </main>
  );
}
