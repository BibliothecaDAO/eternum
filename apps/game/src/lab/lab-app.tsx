import { lazy, Suspense, useEffect, useRef } from "react";
import { Link, matchPath, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { SceneRoute } from "../scene-route";
import { useBootDocumentState } from "../ui/modules/boot-loader";
import "./lab-app.css";

const TOOLS = [
  {
    group: "Art",
    label: "Terrain & buildings",
    path: "/lab",
    route: "",
    View: lazy(() =>
      import("../ui/features/debug/procedural-terrain-debug-view").then((module) => ({
        default: module.ProceduralTerrainDebugView,
      })),
    ),
  },
  {
    group: "Art",
    label: "Models & motion",
    path: "/lab/models",
    route: "models",
    View: lazy(() =>
      import("../ui/features/debug/model-lab-view").then((module) => ({ default: module.ModelLabView })),
    ),
  },
  {
    group: "Art",
    label: "Rewards",
    path: "/lab/rewards",
    route: "rewards",
    View: lazy(() =>
      import("../ui/features/debug/reward-lab-view").then((module) => ({ default: module.RewardLabView })),
    ),
  },
  {
    group: "Art",
    label: "Terrain props",
    path: "/lab/terrain-props",
    route: "terrain-props",
    View: lazy(() =>
      import("../ui/features/debug/terrain-prop-debug-view").then((module) => ({
        default: module.TerrainPropDebugView,
      })),
    ),
  },
  {
    group: "Art",
    label: "World FX",
    path: "/lab/world-fx",
    route: "world-fx",
    View: lazy(() =>
      import("../ui/features/debug/world-fx-gym-view").then((module) => ({ default: module.WorldFxGymView })),
    ),
  },
  {
    group: "Characters",
    label: "Character review",
    path: "/lab/characters",
    route: "characters",
    View: lazy(() =>
      import("../ui/features/debug/procedural-character-gym-view").then((module) => ({
        default: module.ProceduralCharacterGymView,
      })),
    ),
  },
  {
    group: "Characters",
    label: "Character benchmark",
    path: "/lab/character-benchmark",
    route: "character-benchmark",
    View: lazy(() =>
      import("../ui/features/debug/procedural-character-benchmark-view").then((module) => ({
        default: module.ProceduralCharacterBenchmarkView,
      })),
    ),
  },
  {
    group: "Characters",
    label: "World integration",
    path: "/lab/world",
    route: "world",
    View: lazy(() =>
      import("../ui/features/debug/procedural-character-benchmark-view").then((module) => ({
        default: module.ProceduralWorldGymView,
      })),
    ),
  },
  {
    group: "Renderer",
    label: "Chunk fixtures",
    path: "/lab/chunks",
    route: "chunks",
    View: lazy(() =>
      import("../ui/features/debug/three-chunk-debug-view").then((module) => ({ default: module.ThreeChunkDebugView })),
    ),
  },
  {
    group: "Renderer",
    label: "Terrain benchmark",
    path: "/lab/terrain-benchmark",
    route: "terrain-benchmark",
    View: lazy(() =>
      import("../ui/features/debug/procedural-terrain-benchmark-view").then((module) => ({
        default: module.ProceduralTerrainBenchmarkView,
      })),
    ),
  },
  {
    group: "Interface",
    label: "Motion primitives",
    path: "/lab/motion",
    route: "motion",
    View: lazy(() =>
      import("../ui/features/debug/motion-lab/motion-lab-view").then((module) => ({ default: module.MotionLabView })),
    ),
  },
  {
    group: "Interface",
    label: "UI kit & HUD",
    path: "/lab/kit",
    route: "kit/*",
    View: lazy(() =>
      import("../ui/features/debug/kit-lab/kit-lab-view").then((module) => ({ default: module.KitLabView })),
    ),
  },
  {
    group: "Interface",
    label: "App fixtures",
    path: "/lab/app/home",
    route: "app/:screen/*",
    View: lazy(() => import("../shell/lab/app-lab").then((module) => ({ default: module.AppLabView }))),
  },
] as const;

const LoadingTool = () => (
  <div className="lab-loading" role="status">
    Loading tool…
  </div>
);

/** One bootstrap owns the viewport and boot shell; changing tools unmounts the previous renderer before loading another. */
export function LabApp() {
  useBootDocumentState("app-ready", "lab_ready");
  return (
    <SceneRoute fallback={<LoadingTool />}>
      <LabTools />
    </SceneRoute>
  );
}

function LabTools() {
  const { pathname: rawPathname, search } = useLocation();
  const pathname = rawPathname.replace(/\/$/, "");
  const navigate = useNavigate();
  const savedAddresses = useRef(new Map<string, string>());
  const tool = TOOLS.find((entry) =>
    matchPath({ path: entry.route ? `/lab/${entry.route}` : "/lab", end: true }, pathname),
  );
  const capture = new URLSearchParams(search).get("capture") === "1";
  useEffect(() => {
    if (tool) savedAddresses.current.set(tool.path, `${pathname}${search}`);
  }, [pathname, search, tool]);

  return (
    <div className="lab-app" data-capture={capture}>
      {!capture && (
        <header className="lab-header">
          <Link to="/" aria-label="Exit lab to home">
            Eternum Lab
          </Link>
          <label>
            Tool{" "}
            <select
              aria-label="Lab tool"
              value={tool?.path ?? ""}
              onChange={(event) => {
                const path = event.target.value;
                navigate(savedAddresses.current.get(path) ?? path);
              }}
            >
              {!tool && (
                <option value="" disabled>
                  Choose a tool
                </option>
              )}
              {[...new Set(TOOLS.map((entry) => entry.group))].map((group) => (
                <optgroup key={group} label={group}>
                  {TOOLS.filter((entry) => entry.group === group).map((entry) => (
                    <option key={entry.path} value={entry.path}>
                      {entry.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </header>
      )}
      <div className="lab-tool">
        <Suspense key={tool?.path ?? pathname} fallback={<LoadingTool />}>
          <Routes>
            {TOOLS.map(({ route, path, View }) =>
              route === "" ? (
                <Route key={path} index element={<View />} />
              ) : (
                <Route key={path} path={route} element={<View />} />
              ),
            )}
            <Route
              path="*"
              element={
                <div className="lab-loading">
                  Tool not found. <Link to="/lab">Open terrain tools</Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
