import type { Plugin } from "vite";
import { linkPreviewUrl } from "../src/brand/link-preview";
import { APP_ADDRESS } from "../src/config/app-address";
import { REALMS_MARK } from "../src/ui/design-system/icon-meaning";
import { paintingSources } from "../src/ui/design-system/kit/paintings";

export const appIdentity = (devEnvironment: boolean) => {
  const icons = devEnvironment ? "game-dev-" : "game-";
  return {
    name: devEnvironment ? "Realms dev" : "Realms",
    icon: (file: string) => `/images/${icons}${file}`,
    linkPreview: linkPreviewUrl(devEnvironment),
  };
};

export const appIdentityHtml = (identity: ReturnType<typeof appIdentity>) => {
  const mist = paintingSources("frontier-mist");
  return {
    name: "app-identity-html",
    transformIndexHtml: {
      order: "pre" as const,
      handler: (html: string) =>
        html
          .replace("<title>Realms</title>", `<title>${identity.name}</title>`)
          .replaceAll("/images/game-", identity.icon(""))
          .replaceAll("%LINK_PREVIEW%", identity.linkPreview)
          .replaceAll("%APP_ADDRESS%", APP_ADDRESS)
          .replaceAll("%BOOT_MIST_SRC%", mist.src)
          .replaceAll("%BOOT_MIST_SRCSET%", mist.srcSet)
          .replaceAll("%BOOT_LOCKUP_SRC%", REALMS_MARK.lettered),
    },
  } satisfies Plugin;
};
