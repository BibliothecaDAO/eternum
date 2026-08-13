import { env } from "../../env";

/**
 * The active S2 architecture is game-wide. True selects the complete S1
 * bounded adapter solely as a short-lived rollback path through S4.
 */
export const shouldUseLegacyBoundedSpatialSync = (): boolean => env.VITE_PUBLIC_WORLDMAP_BOUNDED_SPATIAL_SYNC === true;
