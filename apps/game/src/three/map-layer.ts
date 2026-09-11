import { useUIStore } from "@/hooks/store/use-ui-store";

/** The layer the scene renders. Three.js code reads it here; React code selects `mapLayer` from the UI store. */
export const activeMapLayer = (): boolean => useUIStore.getState().mapLayer;
