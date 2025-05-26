interface OGImageParams {
  title: string;
  description?: string;
  image?: string;
  path?: string;
}

// Base URL for your site - update this for production
const BASE_URL = import.meta.env.VITE_BASE_URL || "https://realms.world";

// Default OG image
const DEFAULT_OG_IMAGE = `${BASE_URL}/og.jpg`;

export function generateOGImageUrl(params: OGImageParams): string {
  // If a custom image is provided, use it
  if (params.image) {
    return params.image.startsWith("http")
      ? params.image
      : `${BASE_URL}${params.image}`;
  }

  // For dynamic OG image generation, you can use a service like Vercel OG
  // or create your own edge function
  // This example uses a hypothetical API endpoint
  const ogParams = new URLSearchParams({
    title: params.title,
    ...(params.description && { description: params.description }),
    ...(params.path && { path: params.path }),
  });

  // Option 1: Use Vercel OG (if deployed on Vercel)
  if (import.meta.env.VITE_USE_DYNAMIC_OG === "true") {
    return `${BASE_URL}/api/og?${ogParams}`;
  }

  // Option 2: Use an external service like og-image.vercel.app
  // return `https://og-image.vercel.app/${encodeURIComponent(params.title)}.png?theme=dark&md=1&fontSize=100px`;

  // Option 3: Static images per route (current approach)
  return DEFAULT_OG_IMAGE;
}

export function generateMetaTags(
  params: OGImageParams & {
    url?: string;
    type?: string;
    siteName?: string;
  }
) {
  const {
    title,
    description = "The future of gaming is onchain. Explore games powered by $LORDS token in the Realms ecosystem.",
    url = BASE_URL,
    type = "website",
    siteName = "Realms World",
  } = params;

  const ogImage = generateOGImageUrl(params);

  return [
    // Basic meta tags
    { title },
    { name: "description", content: description },

    // Open Graph tags
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: ogImage },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:url", content: url },
    { property: "og:type", content: type },
    { property: "og:site_name", content: siteName },

    // Twitter Card tags
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
    { name: "twitter:site", content: "@LordsRealms" },
    { name: "twitter:creator", content: "@LordsRealms" },
  ];
}
