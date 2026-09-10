// @refresh reset
import {
  Anchor,
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  Copy,
  Crosshair,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Ship,
  SkipForward,
  Waves,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  mountModelLabRenderer,
  type ModelLabRenderer,
  type ModelLabStats,
} from "@/three/debug/model-lab/model-lab-renderer";
import {
  readModelLabSettings,
  writeModelLabSettings,
  type ModelLabSettings,
} from "@/three/debug/model-lab/model-lab-settings";
import { MODEL_LAB_BIOMES } from "@/three/debug/model-lab/model-lab-environment";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import "./model-lab.css";

const CLASSES = ["knight", "crossbowman", "paladin"] as const;
const EMPTY_STATS: ModelLabStats = { triangles: 0, calls: 0, fps: 0, progress: 0, phase: "Loading", assets: [] };
const DESIGN_NOTES = {
  knight: [
    "Textured timber, bronze cannon broadsides and detailed rigging across all three tiers.",
    "An open single-mast T1, a naval escort T2 and a royal T3 with two grand sails.",
  ],
  crossbowman: [
    "Forest-green hulls and detailed ballistae, progressing to a twin-limb siege bow on T3.",
    "Army markings stay readable alongside player colours and prints.",
  ],
  paladin: [
    "Ivory-and-gold hulls, solar heraldry, carved wings and gilded reliquaries.",
    "T3 carries a sculpted dragon prow above the waterline.",
  ],
};
const CLASS_ICONS = { knight: 26, crossbowman: 29, paladin: 32 };

export function ModelLabView() {
  const [params, setParams] = useSearchParams();
  const settings = readModelLabSettings(params);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ModelLabRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sailArtworkName, setSailArtworkName] = useState<string | null>(null);
  const updateVersion = useRef(0);
  const isStudy = settings.family === "ships" && settings.source === "study";
  const title = settings.family === "ships" ? `${settings.army} fleet` : `${settings.family} roster`;
  useBootDocumentState(ready || error ? "app-ready" : "app-loading", ready ? "model_lab_ready" : undefined);

  useEffect(() => {
    if (!containerRef.current) return;
    const abort = new AbortController();
    let mounted: ModelLabRenderer | null = null;
    mountModelLabRenderer({
      container: containerRef.current,
      settings: settingsRef.current,
      signal: abort.signal,
      onStats: (next) => {
        if (!abort.signal.aborted) setStats(next);
      },
    })
      .then((renderer) => {
        mounted = renderer;
        if (abort.signal.aborted) {
          renderer.dispose();
          return;
        }
        rendererRef.current = renderer;
        setReady(true);
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(String(reason));
      });
    return () => {
      abort.abort();
      mounted?.dispose();
      rendererRef.current = null;
    };
  }, []);

  const settingsKey = writeModelLabSettings(settings).toString();
  useEffect(() => {
    if (!rendererRef.current || !ready) return;
    const version = ++updateVersion.current;
    setBusy(true);
    setError(null);
    rendererRef.current
      .update(settingsRef.current)
      .catch((reason) => {
        if (version === updateVersion.current) setError(String(reason));
      })
      .finally(() => {
        if (version === updateVersion.current) setBusy(false);
      });
  }, [ready, settingsKey]);
  useEffect(() => {
    rendererRef.current?.pause(paused);
  }, [paused, ready]);

  const change = (patch: Partial<ModelLabSettings>) => {
    const next = readModelLabSettings(writeModelLabSettings({ ...settingsRef.current, ...patch }));
    settingsRef.current = next;
    setCopied(false);
    setParams(writeModelLabSettings(next), { replace: true });
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      setError("Clipboard unavailable. Copy the address bar to share this setup.");
    }
  };
  const setPlayerArtwork = async (file: File | null) => {
    if (!rendererRef.current) return;
    try {
      await rendererRef.current.setSailArtwork(file);
      setSailArtworkName(file?.name ?? null);
    } catch (reason) {
      setError(`Could not read sail artwork: ${String(reason)}`);
    }
  };
  const exportModel = async (tier: number) => {
    if (!rendererRef.current) return;
    try {
      const blob = await rendererRef.current.exportModel(tier);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `eternum-${settings.army}-ship-t${tier}.glb`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(String(reason));
    }
  };

  return (
    <main className="model-lab" data-ready={ready} data-debug-route="model-lab">
      <header className="ml-header">
        <Box size={25} />
        <div>
          <strong>Models & motion</strong>
          <span>FLEETS · ARMIES · BIOMES</span>
        </div>
        <button onClick={share}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Share setup"}
        </button>
      </header>
      <aside className="ml-library">
        <div className="ml-eyebrow">MODEL LIBRARY</div>
        <h1>
          The shipyard
          <br />& the army.
        </h1>
        <p>Compare silhouettes. Inspect motion. Build the next roster.</p>
        <button
          className="ml-family"
          aria-pressed={settings.family === "ships"}
          onClick={() => change({ family: "ships", source: "study", action: "idle" })}
        >
          <Ship size={20} />
          <span>
            Ships<small>9 fleet variants · 3 classes × 3 tiers</small>
          </span>
          <ArrowRight size={14} />
        </button>
        {CLASSES.map((family) => (
          <button
            className="ml-family"
            key={family}
            aria-pressed={settings.family === family}
            onClick={() => change({ family, source: "default", action: "idle" })}
          >
            <img src={`/images/resources/${CLASS_ICONS[family]}.png`} alt="" />
            <span>
              {family}
              <small>{family === "paladin" ? "Horse mounts · T3 dragon rider" : "T1 / T2 / T3"}</small>
            </span>
            <ArrowRight size={14} />
          </button>
        ))}
        {settings.family === "ships" && (
          <fieldset>
            <legend>ARMY CLASS</legend>
            <div className="ml-class-picker">
              {CLASSES.map((army) => (
                <button
                  key={army}
                  aria-label={`${army} ships`}
                  aria-pressed={settings.army === army}
                  onClick={() => change({ army })}
                >
                  <img src={`/images/resources/${CLASS_ICONS[army]}.png`} alt="" />
                  <span>{army === "crossbowman" ? "Ranged" : army === "paladin" ? "Paladin" : "Knight"}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <label className="ml-field">
          MODEL SOURCE
          <select
            value={settings.source}
            onChange={(event) => change({ source: event.target.value as ModelLabSettings["source"] })}
          >
            {settings.family === "ships" && <option value="study">Blender fleet concepts</option>}
            <option value="current">Current character runtime</option>
            <option value="default">Default game GLBs</option>
            <option value="legacy">Older alternatives</option>
          </select>
        </label>
        {isStudy && (
          <fieldset>
            <legend>SAIL IDENTITY & WIND</legend>
            <label className="ml-field">
              PLAYER COLOUR
              <input
                aria-label="Player sail colour"
                type="color"
                value={settings.sailColor}
                onChange={(event) => change({ sailColor: event.target.value })}
              />
            </label>
            <label className="ml-field">
              SAIL PRINT
              <select
                aria-label="Sail print"
                value={settings.sailPrint}
                onChange={(event) => change({ sailPrint: event.target.value as ModelLabSettings["sailPrint"] })}
              >
                <option value="army">Army marking</option>
                <option value="crown">Crown</option>
                <option value="chevron">Chevrons</option>
                <option value="sun">Sun</option>
              </select>
            </label>
            <label className="ml-field">
              CUSTOM PLAYER PRINT
              <input
                aria-label="Upload player sail print"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void setPlayerArtwork(file);
                }}
              />
            </label>
            {sailArtworkName && (
              <div className="ml-upload-note">
                <span>{sailArtworkName}</span>
                <button onClick={() => void setPlayerArtwork(null)}>Remove print</button>
                <small>
                  Uploaded artwork stays in this session. Colours and built-in prints are included in shared links.
                </small>
              </div>
            )}
            <label className="ml-field">
              WIND · {settings.wind.toFixed(1)}
              <input
                aria-label="Sailing wind strength"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.wind}
                onChange={(event) => change({ wind: Number(event.target.value) })}
              />
            </label>
          </fieldset>
        )}
        <label className="ml-field">
          REAL BIOME
          <select
            aria-label="Review biome"
            value={settings.biome}
            onChange={(event) => change({ biome: event.target.value as ModelLabSettings["biome"] })}
          >
            {Object.entries(MODEL_LAB_BIOMES).map(([id, biome]) => (
              <option key={id} value={id}>
                {biome.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ml-field">
          WORLD LIGHTING
          <select
            aria-label="World lighting"
            value={settings.lighting}
            onChange={(event) => change({ lighting: event.target.value as ModelLabSettings["lighting"] })}
          >
            <option value="day">Daylight</option>
            <option value="sunset">Sunset</option>
          </select>
        </label>
        <div className="ml-library-note">
          <Anchor size={17} />
          <p>
            {isStudy
              ? "Nine Blender-built ships with equal hull dimensions. Compare the new designs here before they enter the live fleet."
              : "Existing game assets. Use this baseline to decide what to keep, replace or rebuild."}
          </p>
        </div>
        <Link className="ml-advanced" to="/debug/procedural-characters">
          Advanced animation gym <ArrowRight size={12} />
        </Link>
      </aside>
      <section className="ml-workspace">
        <div className="ml-stage-heading">
          <div>
            <span className="ml-eyebrow">{isStudy ? "BLENDER FLEET / BIOME REVIEW" : "ASSET REVIEW / BASELINE"}</span>
            <h2>{title}</h2>
          </div>
          <span className="ml-status">
            {busy ? "Loading selection" : isStudy ? "SAME SIZE · 1 HEX" : "CURRENT ASSETS"}
          </span>
        </div>
        <div className="ml-toolbar">
          <div aria-label="Review camera">
            {(["orbit", "rts", "side", "top"] as const).map((camera) => (
              <button key={camera} aria-pressed={settings.camera === camera} onClick={() => change({ camera })}>
                {camera === "rts" ? "RTS scale" : camera}
              </button>
            ))}
          </div>
          <button onClick={() => rendererRef.current?.resetCamera()} aria-label="Reset camera">
            <Crosshair size={16} />
          </button>
          <label>
            <input
              type="checkbox"
              checked={settings.compare}
              onChange={(event) => change({ compare: event.target.checked })}
            />
            Compare tiers
          </label>
        </div>
        <div className="ml-canvas" ref={containerRef} />
        {!ready && !error && (
          <div className="ml-loading">
            <Ship size={34} />
            <strong>Preparing the model stage</strong>
            <span>Loading terrain textures, biome vegetation and authored game assets…</span>
          </div>
        )}
        <div className="ml-tier-cards">
          {stats.assets.map((asset) => (
            <article className="ml-tier-card" key={asset.tier}>
              <button onClick={() => change({ compare: false, tier: asset.tier as 1 | 2 | 3 })}>
                <span>T{asset.tier}</span>
                <div>
                  <strong>{asset.name}</strong>
                  <small>
                    {compact(asset.triangles)} triangles ·{" "}
                    {isStudy ? "procedural motion" : `${asset.clips} authored clips`}
                  </small>
                </div>
                <Maximize2 size={13} />
              </button>
              {isStudy && (
                <button
                  className="ml-export"
                  disabled={busy}
                  onClick={() => exportModel(asset.tier)}
                  aria-label={`Export T${asset.tier} ship GLB`}
                >
                  <ArrowDownToLine size={13} />
                  GLB
                </button>
              )}
            </article>
          ))}
        </div>
        <div className="ml-playback">
          <div className="ml-action-tabs" aria-label="Animation sequence">
            {(["idle", "move"] as const).map((action) => (
              <button
                key={action}
                aria-pressed={settings.action === action}
                onClick={() => {
                  change({ action });
                  setPaused(false);
                }}
              >
                {action === "idle" ? <Anchor size={13} /> : <Waves size={13} />}
                {action === "move" ? (settings.family === "ships" ? "Sail" : "Move") : "Idle"}
              </button>
            ))}
          </div>
          <div className="ml-transport">
            <button
              onClick={() => {
                rendererRef.current?.seek(0);
              }}
              aria-label="Replay sequence"
            >
              <RotateCcw size={16} />
            </button>
            <button onClick={() => setPaused(!paused)} aria-label={paused ? "Play animation" : "Pause animation"}>
              {paused ? <Play size={17} /> : <Pause size={17} />}
            </button>
            <button
              onClick={() => {
                setPaused(true);
                rendererRef.current?.step();
              }}
              aria-label="Advance animation one frame"
            >
              <SkipForward size={16} />
            </button>
            <input
              aria-label="Transition progress"
              type="range"
              min="0"
              max="1"
              step="0.002"
              value={stats.progress}
              onChange={(event) => {
                setPaused(true);
                rendererRef.current?.seek(Number(event.target.value));
              }}
            />
            <span>{stats.phase}</span>
            <select
              aria-label="Playback speed"
              value={settings.speed}
              onChange={(event) => change({ speed: Number(event.target.value) })}
            >
              {[0.25, 0.5, 1, 1.5, 2].map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
      <aside className="ml-inspector">
        <span className="ml-eyebrow">REVIEW NOTES</span>
        <h3>{isStudy ? "Read the silhouette." : "Know the baseline."}</h3>
        {(isStudy
          ? DESIGN_NOTES[settings.army]
          : settings.family === "paladin" && settings.source === "current"
            ? ["T1 and T2 use horse mounts.", "T3 uses the existing dragon rider. Switch to Move to inspect flight."]
            : [
                "Compare all three tiers using the same camera and lighting.",
                "Switch source to inspect the original GLBs and older alternatives.",
              ]
        ).map((note) => (
          <p key={note}>{note}</p>
        ))}
        <div className="ml-review-rule">
          <span>01</span>
          <div>
            <strong>Shape before detail</strong>
            <p>Each ship fits inside one hex, including sails and equipment. Tier and class should still read.</p>
          </div>
        </div>
        <div className="ml-review-rule">
          <span>02</span>
          <div>
            <strong>Motion without delay</strong>
            <p>Watch the sail belly fill, the cloth ripple and the pennants stream in the wind.</p>
          </div>
        </div>
        <div className="ml-review-rule">
          <span>03</span>
          <div>
            <strong>In the real environment</strong>
            <p>Production biome textures, vegetation, water, sunlight and movement effects.</p>
          </div>
        </div>
        <label className="ml-wireframe">
          <input
            type="checkbox"
            checked={settings.wireframe}
            onChange={(event) => change({ wireframe: event.target.checked })}
          />
          Wireframe
        </label>
        <dl className="ml-metrics">
          <div>
            <dt>Frame rate</dt>
            <dd>{stats.fps} fps</dd>
          </div>
          <div>
            <dt>Draw calls</dt>
            <dd>{stats.calls}</dd>
          </div>
          <div>
            <dt>Scene triangles</dt>
            <dd>{compact(stats.triangles)}</dd>
          </div>
        </dl>
        <small className="ml-footnote">
          Ship exports contain geometry and the current pose. Motion is driven by code. Movement paths are a lab
          preview.
        </small>
      </aside>
      {error && (
        <div className="ml-error" role="alert">
          <strong>Model review needs attention</strong>
          <p>{error}</p>
          <button onClick={() => location.reload()}>Reload lab</button>
        </div>
      )}
    </main>
  );
}

function compact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
