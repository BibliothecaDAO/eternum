import type { FeatureType } from "./latest-features";

interface LatestFeaturePresentation {
  badgeClassName: string;
  iconSurfaceClassName: string;
  iconClassName: string;
  landingLabel: string;
  popupLabel: string;
}

const latestFeaturePresentationByType: Record<FeatureType, LatestFeaturePresentation> = {
  feature: {
    badgeClassName: "border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
    iconSurfaceClassName: "border-emerald-500/30 bg-emerald-500/20",
    iconClassName: "text-emerald-400",
    landingLabel: "New Feature",
    popupLabel: "New",
  },
  improvement: {
    badgeClassName: "border-sky-500/30 bg-sky-500/20 text-sky-400",
    iconSurfaceClassName: "border-sky-500/30 bg-sky-500/20",
    iconClassName: "text-sky-400",
    landingLabel: "Improvement",
    popupLabel: "Improved",
  },
  balance: {
    badgeClassName: "border-amber-500/30 bg-amber-500/20 text-amber-400",
    iconSurfaceClassName: "border-amber-500/30 bg-amber-500/20",
    iconClassName: "text-amber-400",
    landingLabel: "Balance",
    popupLabel: "Balance",
  },
  fix: {
    badgeClassName: "border-rose-500/30 bg-rose-500/20 text-rose-400",
    iconSurfaceClassName: "border-rose-500/30 bg-rose-500/20",
    iconClassName: "text-rose-400",
    landingLabel: "Bug Fix",
    popupLabel: "Fixed",
  },
};

export const getLatestFeaturePresentation = (type: FeatureType): LatestFeaturePresentation =>
  latestFeaturePresentationByType[type];
