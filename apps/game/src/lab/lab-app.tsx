import { Suspense, useEffect, useRef } from "react";
import { Link, matchPath, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { SceneRoute } from "../scene-route";
import { useBootDocumentState } from "../ui/modules/boot-loader";
import "./lab-app.css";
import { type Device, type LabPage, type LabRoom, type LabView, type Mode, ROOMS } from "./rooms";

const MODE_NAMES: Record<Mode, string> = { blitz: "Blitz", frontier: "Frontier", eternum: "Eternum" };
/** The Game switch lists the ages in their order, whichever a page draws first. */
const GAMES: readonly Mode[] = ["blitz", "frontier", "eternum"];
const DEVICE_NAMES: Record<Device, string> = { desktop: "Desktop", phone: "Phone", both: "Both" };

/**
 * Every view with its page and room: the header and the routes read the lab from here. A page's `inside` routes (the HUD
 * room's frames) are `alone` when opened by themselves: they belong to the page but are not where it reopens.
 */
const VIEWS = ROOMS.flatMap((room) =>
  room.pages.flatMap((page) => [
    ...page.views.map((view) => ({ room, page, view, alone: false })),
    ...(page.inside ?? []).map((view) => ({ room, page, view, alone: true })),
  ]),
);
/** The page-wide choices a page keeps across its views. */
const SHARED = ["mode", "device"] as const;
/** One route per address pattern: the Game room's two lab games share theirs. */
const ROUTES = VIEWS.filter(({ view }, index) => VIEWS.findIndex((other) => other.view.route === view.route) === index);

const LoadingTool = () => (
  <div className="lab-loading" role="status">
    Loading…
  </div>
);

/** One bootstrap owns the viewport and boot shell; changing pages unmounts the previous renderer before loading another. */
export function LabApp() {
  useBootDocumentState("app-ready", "lab_ready");
  return (
    <SceneRoute fallback={<LoadingTool />}>
      <LabRooms />
    </SceneRoute>
  );
}

const withQuery = (path: string, changes: Record<string, string>) => {
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  Object.entries(changes).forEach(([key, value]) => params.set(key, value));
  return params.size > 0 ? `${pathname}?${params}` : pathname!;
};

/** Where a page opens: where it was last left, else its first view, on Frontier when it draws Frontier. */
const opening = (page: LabPage, saved: Map<LabPage, string>) =>
  saved.get(page) ??
  (page.modes?.includes("frontier") ? withQuery(page.views[0]!.path, { mode: "frontier" }) : page.views[0]!.path);

function LabRooms() {
  const { pathname: rawPathname, search } = useLocation();
  const pathname = rawPathname.replace(/\/$/, "");
  const navigate = useNavigate();
  const saved = useRef(new Map<LabPage, string>());
  const shown = VIEWS.find(({ view }) => matchPath({ path: `/lab/${view.route}`, end: true }, pathname));
  const params = new URLSearchParams(search);
  const capture = params.get("capture") === "1";
  useEffect(() => {
    if (shown && !shown.alone) saved.current.set(shown.page, `${pathname}${search}`);
  }, [pathname, search, shown]);

  return (
    <div className="lab-app" data-capture={capture}>
      {!capture && (
        <LabHeader
          shown={shown}
          params={params}
          open={(page) => navigate(opening(page, saved.current))}
          set={(changes) => navigate(withQuery(`${pathname}${search}`, changes))}
        />
      )}
      <div className="lab-tool">
        {/* A page reads its game as it opens; another game opens it again. */}
        <Suspense key={`${shown?.view.route ?? pathname}|${params.get("mode")}`} fallback={<LoadingTool />}>
          <Routes>
            <Route index element={<Navigate to="/lab/kit" replace />} />
            {ROUTES.map(({ view: { route, View } }) => (
              <Route key={route} path={route} element={<View />} />
            ))}
            <Route
              path="*"
              element={
                <div className="lab-loading">
                  No lab page here. <Link to="/lab/kit">Open the kit</Link>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

function LabHeader({
  shown,
  params,
  open,
  set,
}: {
  shown: { room: LabRoom; page: LabPage; view: LabView; alone: boolean } | undefined;
  params: URLSearchParams;
  open: (page: LabPage) => void;
  set: (changes: Record<string, string>) => void;
}) {
  const page = shown?.page;
  // A route opened alone picks its game from its path and its layout from the window: no switch would change it.
  const modes = (!shown?.alone && page?.modes) || [];
  const mode = (params.get("mode") as Mode | null) ?? modes[0];
  const devices = (!shown?.alone && page?.devices) || [];
  const device = (params.get("device") as Device | null) ?? devices[0];
  return (
    <header className="lab-header">
      <div className="lab-row">
        <Link to="/" aria-label="Exit lab to home">
          Eternum Lab
        </Link>
        <nav aria-label="Rooms">
          {ROOMS.map((room) => (
            <button
              key={room.title}
              type="button"
              aria-current={room === shown?.room ? "page" : undefined}
              onClick={() => open(room.pages[0]!)}
            >
              {room.title}
            </button>
          ))}
        </nav>
        <span className="lab-switches">
          {modes.length > 1 && (
            <Switch
              label="Game"
              options={GAMES.filter((each) => modes.includes(each))}
              names={MODE_NAMES}
              value={mode}
              onChange={(next) => set({ mode: next })}
            />
          )}
          {devices.length > 1 && (
            <Switch
              label="Device"
              options={devices}
              names={DEVICE_NAMES}
              value={device}
              onChange={(next) => set({ device: next })}
            />
          )}
        </span>
      </div>
      {shown && (
        <div className="lab-row">
          <nav aria-label="Pages">
            {shown.room.pages.map((each) => (
              <button
                key={each.title}
                type="button"
                aria-current={each === page ? "page" : undefined}
                onClick={() => open(each)}
              >
                {each.title}
              </button>
            ))}
          </nav>
          {shown.alone && (
            <nav aria-label="Views">
              <button type="button" onClick={() => open(shown.page)}>
                ← Back to {shown.page.title}
              </button>
            </nav>
          )}
          {!shown.alone && shown.page.views.length > 1 && (
            <nav aria-label="Views">
              {shown.page.views.map((each) => (
                <Link
                  key={each.path}
                  to={withQuery(
                    each.path,
                    Object.fromEntries(SHARED.flatMap((key) => (params.has(key) ? [[key, params.get(key)!]] : []))),
                  )}
                  aria-current={each === shown.view ? "page" : undefined}
                >
                  {each.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      )}
    </header>
  );
}

function Switch<K extends string>({
  label,
  options,
  names,
  value,
  onChange,
}: {
  label: string;
  options: readonly K[];
  names: Record<K, string>;
  value: K | undefined;
  onChange: (next: K) => void;
}) {
  return (
    <span role="group" aria-label={label}>
      {label}
      {options.map((key) => (
        <button key={key} type="button" aria-pressed={key === value} onClick={() => onChange(key)}>
          {names[key]}
        </button>
      ))}
    </span>
  );
}
