import { useMemo } from "react";
import { useLocation } from "wouter";
import { useSearch } from "wouter/use-location";

export const useQuery = () => {
  const searchString = useSearch();
  const [location, setLocation] = useLocation();

  const handleUrlChange = (url: string) => {
    setLocation(url);
    window.dispatchEvent(new Event("urlChanged"));
  };

  const isMapView = location.includes(`/map`);

  const hexPosition = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const x = params.get("col");
    const y = params.get("row");
    return { col: Number(x), row: Number(y) };
  }, [searchString]);

  const isLocation = (col: number, row: number) => {
    return hexPosition.col === col && hexPosition.row === row;
  };

  return {
    isLocation,
    handleUrlChange,
    hexPosition,
    isMapView,
  };
};
