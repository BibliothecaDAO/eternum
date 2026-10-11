import { WORDS } from "../words";
import { IS_DEV_ENVIRONMENT } from "./environment";

/**
 * The dev environment's two marks (brand.html): a dashed Dev chip just outside the lockup's clear space and a hatched
 * edge along the top of every page. No colour of its own, so it never reads as a warning; nothing on production.
 */
export const EnvChip = () =>
  IS_DEV_ENVIRONMENT ? (
    <span className="rounded-md border-[1.5px] border-dashed border-kit-muted px-[7px] py-1 font-ui text-xs font-semibold leading-none text-kit-cream">
      {WORDS.dev}
    </span>
  ) : null;

export const EnvEdge = () =>
  IS_DEV_ENVIRONMENT ? (
    <div
      aria-hidden
      data-env-edge
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 bg-[repeating-linear-gradient(135deg,theme(colors.kit.muted)_0_4px,transparent_4px_8px)]"
    />
  ) : null;
