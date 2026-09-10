import { FlaskConical } from "lucide-react";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { GRAPHICS_LAB_TOOLS } from "./graphics-lab-routes";
import "./graphics-lab.css";

const TerrainTools = lazy(() =>
  import("./procedural-terrain-debug-view").then((module) => ({ default: module.ProceduralTerrainDebugView })),
);
const ModelTools = lazy(() => import("./model-lab-view").then((module) => ({ default: module.ModelLabView })));
const RewardTools = lazy(() => import("./reward-lab-view").then((module) => ({ default: module.RewardLabView })));

export function GraphicsLabView() {
  const { pathname, search } = useLocation();
  const capture = new URLSearchParams(search).get("capture") === "1";
  const savedSearches = useRef(new Map<string, string>());
  useEffect(() => {
    savedSearches.current.set(pathname, search);
  }, [pathname, search]);

  return (
    <div className="graphics-lab" data-capture={capture}>
      {!capture && (
        <header className="graphics-lab-header">
          <Link to="/" className="graphics-lab-brand" aria-label="Exit lab to home">
            <FlaskConical size={20} />
            <span>
              ETERNUM <strong>LAB</strong>
            </span>
          </Link>
          <nav aria-label="Lab tools">
            {GRAPHICS_LAB_TOOLS.map((tool) => (
              <Link
                key={tool.id}
                to={`${tool.path}${tool.path === pathname ? search : (savedSearches.current.get(tool.path) ?? "")}`}
                aria-current={pathname === tool.path ? "page" : undefined}
              >
                {tool.label}
              </Link>
            ))}
          </nav>
        </header>
      )}
      <Suspense
        fallback={
          <div className="graphics-lab-loading" role="status">
            Loading tools…
          </div>
        }
      >
        <Routes>
          <Route index element={<TerrainTools />} />
          <Route path="models" element={<ModelTools />} />
          <Route path="rewards" element={<RewardTools />} />
          <Route path="*" element={<Navigate to="/lab" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
