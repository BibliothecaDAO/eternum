import { APP_ADDRESS, STAGING_ORIGIN } from "../config/app-address";
import { LINK_PREVIEW } from "../ui/design-system/icon-meaning";

/** The link preview's address on an environment's own app: dev's pages unfurl dev's copy, production's production's. */
export const linkPreviewUrl = (devEnvironment: boolean) =>
  `${devEnvironment ? STAGING_ORIGIN : APP_ADDRESS}${LINK_PREVIEW}`;
