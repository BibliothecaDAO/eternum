import { createContext, PropsWithChildren, useContext, useMemo } from "react";

export type EntityDetailLayoutVariant = "default" | "banner" | "hud" | "sidebar";
export type EntityDetailDensity = "loose" | "cozy" | "compact";

export interface EntityDetailLayoutSettings {
  variant: EntityDetailLayoutVariant;
  density: EntityDetailDensity;
  /**
   * True when the layout should prefer abbreviated labels and minimal copy.
   */
  minimizeCopy: boolean;
}

const DEFAULT_LAYOUT: EntityDetailLayoutSettings = {
  variant: "default",
  density: "cozy",
  minimizeCopy: false,
};

const EntityDetailLayoutContext = createContext<EntityDetailLayoutSettings>(DEFAULT_LAYOUT);

export interface EntityDetailLayoutProviderProps extends Partial<EntityDetailLayoutSettings> {}

export const EntityDetailLayoutProvider = ({
  children,
  density,
  minimizeCopy,
  variant,
}: PropsWithChildren<EntityDetailLayoutProviderProps>) => {
  const value = useMemo<EntityDetailLayoutSettings>(() => {
    const resolvedVariant = variant ?? DEFAULT_LAYOUT.variant;
    let resolvedDensity: EntityDetailDensity;
    if (density) {
      resolvedDensity = density;
    } else {
      resolvedDensity =
        resolvedVariant === "hud"
          ? "compact"
          : resolvedVariant === "banner"
            ? "cozy"
            : DEFAULT_LAYOUT.density;
    }

    const resolvedMinimizeCopy =
      typeof minimizeCopy === "boolean" ? minimizeCopy : resolvedVariant === "hud";

    return {
      variant: resolvedVariant,
      density: resolvedDensity,
      minimizeCopy: resolvedMinimizeCopy,
    } satisfies EntityDetailLayoutSettings;
  }, [density, minimizeCopy, variant]);

  return <EntityDetailLayoutContext.Provider value={value}>{children}</EntityDetailLayoutContext.Provider>;
};

export const useEntityDetailLayout = () => useContext(EntityDetailLayoutContext);
