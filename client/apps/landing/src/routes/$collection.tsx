import { marketplaceCollections } from "@/config";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$collection")({
  head: ({ params }) => {
    const { collection } = params;
    const collectionConfig = marketplaceCollections[collection as keyof typeof marketplaceCollections];
    const collectionName = collectionConfig?.name || collection;

    return {
      title: `${collectionName} Collection | Realms`,
      meta: [
        {
          name: "description",
          content: `View and manage your ${collectionName} NFTs. Browse, filter, and trade your collection on the Realms marketplace.`,
        },
        {
          property: "og:title",
          content: `${collectionName} Collection | Realms`,
        },
        {
          property: "og:description",
          content: `View and manage your ${collectionName} NFTs. Browse, filter, and trade your collection on the Realms marketplace.`,
        },
        {
          property: "og:image",
          content: `https://empire.realms.world/collections/${collection.toLowerCase()}.png`,
        },
        {
          property: "og:url",
          content: `https://empire.realms.world/${collection}`,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:title",
          content: `${collectionName} Collection | Realms`,
        },
        {
          name: "twitter:description",
          content: `View and manage your ${collectionName} NFTs. Browse, filter, and trade your collection on Realms.`,
        },
        {
          name: "twitter:image",
          content: `https://empire.realms.world/collections/${collection.toLowerCase()}.png`,
        },
      ],
    };
  },
});
