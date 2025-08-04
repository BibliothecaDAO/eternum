export * from "./gui-manager";
export * from "./location-manager";
export * from "./pathfinding";
export * from "./utils";
// New modular label system exports
export * from "./labels/label-types";
export * from "./labels/label-config";
export * from "./labels/label-manager";
export * from "./labels/label-factory";
export * from "./labels/label-components";
// Keep minimal backward compatibility exports from label-transitions
export { applyLabelTransitions, transitionManager, transitionDB } from "./labels/label-transitions";
