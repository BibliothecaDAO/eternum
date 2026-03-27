import { create } from "zustand";

import type { Headline, HeadlineType } from "./headline-types";

interface NewsHeadlinePreviewOption {
  type: HeadlineType;
  label: string;
}

export const NEWS_HEADLINE_PREVIEW_OPTIONS: NewsHeadlinePreviewOption[] = [
  { type: "realm-fall", label: "Realm Falls" },
  { type: "hyper-capture", label: "Hyperstructure Captures" },
  { type: "elimination", label: "Player Eliminations" },
  { type: "five-min-warning", label: "5 Minutes Remaining" },
];

const NEWS_HEADLINE_PREVIEW_COPY: Record<HeadlineType, Pick<Headline, "title" | "description">> = {
  "realm-fall": {
    title: "REALM FALLEN",
    description: '"Ashen Keep has fallen to Nettle Crown"',
  },
  "hyper-capture": {
    title: "HYPERSTRUCTURE SEIZED",
    description: '"House Meridian captures Hyperstructure from Ember Watch"',
  },
  elimination: {
    title: "PLAYER ELIMINATED",
    description: '"Valebreaker has been vanquished"',
  },
  "five-min-warning": {
    title: "FIVE MINUTES REMAIN",
    description: '"The age ends in 5:00. Make your last decisive moves."',
  },
  "game-end": {
    title: "THE AGE HAS ENDED",
    description: '"Aurora claims victory"',
  },
};

const buildNewsHeadlinePreview = (type: HeadlineType): Headline => {
  const preview = NEWS_HEADLINE_PREVIEW_COPY[type];

  return {
    id: `preview:${type}:${Date.now()}`,
    type,
    title: preview.title,
    description: preview.description,
    icon: type,
    timestamp: Date.now(),
  };
};

interface NewsHeadlinePreviewStore {
  activePreview: Headline | null;
  triggerPreview: (type: HeadlineType) => void;
  dismissPreview: () => void;
}

export const useNewsHeadlinePreviewStore = create<NewsHeadlinePreviewStore>((set) => ({
  activePreview: null,
  triggerPreview: (type) => set({ activePreview: buildNewsHeadlinePreview(type) }),
  dismissPreview: () => set({ activePreview: null }),
}));
