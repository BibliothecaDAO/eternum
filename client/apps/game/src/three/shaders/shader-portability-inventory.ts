export const SHADER_PORTABILITY_INVENTORY = {
  "fx-manager.ts": {
    strategy: "rewrite",
  },
  "highlight-hex-material.ts": {
    strategy: "replace",
  },
  "hover-hex-material.ts": {
    strategy: "replace",
  },
  "label-stack.ts": {
    strategy: "keep",
  },
  "path-line-material.ts": {
    strategy: "rewrite",
  },
  "points-label-material.ts": {
    strategy: "redesign",
  },
  "resource-fx-manager.ts": {
    strategy: "replace",
  },
  "selection-pulse-material.ts": {
    strategy: "replace",
  },
} as const;
