import { useCallback, useMemo, useSyncExternalStore } from "react";

// Scene navigation emits urlChanged after changing browser history. Subscribe to
// that same signal so the inspector and Three.js cannot disagree about the view.
const routeEvents = ["urlChanged", "popstate", "pushState", "replaceState", "hashchange"];
const subscribeToRoute = (listener: () => void) => {
  routeEvents.forEach((event) => window.addEventListener(event, listener));
  return () => routeEvents.forEach((event) => window.removeEventListener(event, listener));
};
const readRoute = () => window.location.pathname + window.location.search;

export const useQuery = () => {
  const route = useSyncExternalStore(subscribeToRoute, readRoute, () => "/");
  const [location, searchString = ""] = route.split("?");

  const handleUrlChange = useCallback((url: string) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new Event("urlChanged"));
  }, []);

  const isMapView = useMemo(() => location.includes("/map"), [location]);

  const hexPosition = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return {
      col: Number(params.get("col")),
      row: Number(params.get("row")),
    };
  }, [searchString]);

  const isLocation = useCallback(
    (col: number, row: number) => hexPosition.col === col && hexPosition.row === row,
    [hexPosition.col, hexPosition.row],
  );

  return {
    isLocation,
    handleUrlChange,
    hexPosition,
    isMapView,
  };
};
