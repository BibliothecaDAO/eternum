import { useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useSearch } from "wouter/use-location";

export const useQuery = () => {
  const searchString = useSearch();

  const [location, setLocation] = useLocation();

  const handleUrlChange = useCallback(
    (url: string) => {
      const normalizedTargetUrl = new URL(url, window.location.origin);
      const targetLocation = `${normalizedTargetUrl.pathname}${normalizedTargetUrl.search}`;
      const currentLocation = `${window.location.pathname}${window.location.search}`;
      if (targetLocation === currentLocation) {
        return;
      }

      setLocation(targetLocation);
      window.dispatchEvent(new Event("urlChanged"));
    },
    [setLocation],
  );

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
