import { useMemo } from "react";
import { useSearch } from "wouter";

export const useQuery = () => {
  const searchString = useSearch();

  const hexPosition = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const x = params.get("col");
    const y = params.get("row");
    return { col: Number(x), row: Number(y) };
  }, [searchString]);

  return {
    hexPosition,
  };
};
