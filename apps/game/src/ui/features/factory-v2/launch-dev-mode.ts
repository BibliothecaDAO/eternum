import type { FactoryLaunchPreset } from "./types";

/**
 * The launch service accepts `devModeOn` only when it is `true` (its schema is
 * `Schema.optional(Schema.Literal(true))`); a `false` is rejected with a 400.
 * Sending it from the preset must therefore collapse to `true | undefined`, not
 * a raw boolean — the one place that maps a preset onto the request field so the
 * three run-request builders can never diverge on it again.
 */
export const resolveLaunchDevModeOn = (preset: FactoryLaunchPreset | null): true | undefined =>
  preset?.defaults.devMode ? true : undefined;
