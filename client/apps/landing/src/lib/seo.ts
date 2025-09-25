import type { MetaDescriptor } from "@tanstack/react-router";

export const OG_IMAGE_URL = "https://empire.realms.world/empire-og-image.jpg";

export const OG_IMAGE_META: MetaDescriptor[] = [
  { property: "og:image", content: OG_IMAGE_URL },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: OG_IMAGE_URL },
];
