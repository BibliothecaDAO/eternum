import { useMemo } from "react";
import { useSearch } from "wouter/use-location";

export const useQuery = () => {
  const searchString = useSearch();

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
    hexPosition,
    isLocation,
  };
};
