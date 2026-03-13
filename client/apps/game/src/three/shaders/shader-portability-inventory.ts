export const SHADER_PORTABILITY_INVENTORY = {
  "fx-manager.ts": {
    strategy: "rewrite",
  },
  "highlight-hex-material.ts": {
    strategy: "rewrite",
  },
  "hover-hex-material.ts": {
    strategy: "rewrite",
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
    strategy: "rewrite",
  },
} as const;
