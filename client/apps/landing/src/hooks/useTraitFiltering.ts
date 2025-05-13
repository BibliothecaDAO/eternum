import { RealmMetadata } from "@/types";
import { useCallback, useMemo, useState } from "react";

interface Trait {
  trait_type: string;
  value: any;
}

interface Metadata {
  attributes?: Trait[];
  [key: string]: any; // Allow other properties
}

// Define the structure of the hook's return value
interface UseTraitFilteringReturn<T> {
  selectedFilters: Record<string, string[]>;
  allTraits: Record<string, string[]>;
  filteredData: T[];
  handleFilterChange: (traitType: string, value: string) => void;
  clearFilter: (traitType: string) => void;
  clearAllFilters: () => void;
}

/**
 * A hook to manage trait-based filtering for an array of data.
 * @param data The raw array of data items to filter.
 * @param getMetadataString A function that takes a data item and returns its metadata string (expected to be JSON).
 * @returns An object containing filter state, extracted traits, filtered data, and handler functions.
 */
export function useTraitFiltering<T>(
  data: T[] | undefined | null,
  getMetadataString: (item: T) => RealmMetadata | null,
): UseTraitFilteringReturn<T> {
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

  // Memoize the extraction of all traits from the raw data
  const allTraits = useMemo(() => {
    const traitsMap: Record<string, Set<string>> = {};
    (data || []).forEach((item) => {
      const metadataString = getMetadataString(item);
      if (metadataString) {
        try {
          const metadata: Metadata = metadataString;
          if (metadata.attributes && Array.isArray(metadata.attributes)) {
            metadata.attributes.forEach((attr) => {
              if (attr.trait_type && attr.value !== undefined && attr.value !== null) {
                const traitType = String(attr.trait_type);
                const traitValue = String(attr.value);
                // Skip empty string values to avoid conflicts with placeholder
                if (traitValue !== "") {
                  if (!traitsMap[traitType]) {
                    traitsMap[traitType] = new Set();
                  }
                  traitsMap[traitType].add(traitValue);
                }
              }
            });
          }
        } catch (e) {
          console.error("Failed to parse metadata in useTraitFiltering:", e, metadataString);
        }
      }
    });

    // Convert Sets to sorted arrays
    const sortedTraits: Record<string, string[]> = {};
    for (const type in traitsMap) {
      sortedTraits[type] = Array.from(traitsMap[type]).sort((a, b) => {
        // Try numeric sort first, fallback to locale string sort
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b);
      });
    }
    return sortedTraits;
  }, [data, getMetadataString]);

  // Memoize the filtered data based on selected filters
  const filteredData = useMemo(() => {
    const inputData = data || [];
    if (Object.keys(selectedFilters).length === 0) {
      return inputData; // No filters applied, return original data
    }

    return inputData.filter((item) => {
      const metadataString = getMetadataString(item);
      let attributes: Trait[] = [];
      if (metadataString) {
        try {
          const metadata = metadataString;
          if (metadata.attributes && Array.isArray(metadata.attributes)) {
            attributes = metadata.attributes;
          }
        } catch (e) {
          // Error already logged during trait extraction
        }
      }

      // Check if the item satisfies all active filters
      return Object.entries(selectedFilters).every(([traitType, selectedValues]) => {
        if (selectedValues.length === 0) return true; // No specific value selected for this trait

        // Find the item's values for the current traitType
        const itemValues = attributes.filter((attr) => attr.trait_type === traitType).map((attr) => String(attr.value));

        // Special handling for the 'Wonder' checkbox filter
        if (traitType === "Wonder" && selectedValues.includes("__ALL_WONDERS__")) {
          // If the Wonder filter is active, check if the item has *any* Wonder trait
          return itemValues.length > 0;
        }

        // Original logic: Check if any of the item's values are included in the selected filter values
        return selectedValues.some((selectedValue) => itemValues.includes(selectedValue));
      });
    });
  }, [data, selectedFilters, getMetadataString]);

  // --- Filter Handlers ---
  const handleFilterChange = useCallback((traitType: string, value: string) => {
    setSelectedFilters((prev) => {
      const currentValues = prev[traitType] || [];
      let newValues: string[];

      if (value === "") {
        newValues = []; // Clear filter for this trait
      } else if (currentValues.includes(value)) {
        // Remove value if already selected (toggle behavior)
        newValues = currentValues.filter((v) => v !== value);
      } else {
        // Add new value to existing values
        newValues = [...currentValues, value];
      }

      const updatedFilters = { ...prev, [traitType]: newValues };

      // Remove the trait type from filters if its value array is empty
      if (updatedFilters[traitType]?.length === 0) {
        delete updatedFilters[traitType];
      }
      return updatedFilters;
    });
  }, []);

  const clearFilter = useCallback((traitType: string) => {
    setSelectedFilters((prev) => {
      const { [traitType]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedFilters({});
  }, []);
  // --- End Filter Handlers ---

  return {
    selectedFilters,
    allTraits,
    filteredData,
    handleFilterChange,
    clearFilter,
    clearAllFilters,
  };
}
