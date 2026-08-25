import { collection, config, fields } from "@keystatic/core";
import { env } from "env";

function storage() {
  if (env.NODE_ENV == "development") {
    return { kind: "local" } as const;
  } else {
    return {
      kind: "github",
      repo: `${import.meta.env.VITE_PUBLIC_GITHUB_REPO_OWNER}/${import.meta.env.VITE_PUBLIC_GITHUB_REPO_NAME}`,
      pathPrefix: "apps/nextjs",
    } as const;
  }
}

export default config({
  storage: storage(),
  ui: {
    brand: { name: "Realms.World" },
  },
  collections: {
    games: collection({
      label: "Games",
      slugField: "title",
      path: "content/games/*",
      previewUrl: `/preview/start?branch={branch}&to=/games/{slug}`,
      format: { contentField: "content" },
      columns: ["title", "icon"],
      schema: {
        title: fields.slug({ name: { label: "Game Title" } }),
        color: fields.text({ label: "Color" }),
        status: fields.select({
          label: "Status",
          defaultValue: "development",
          options: [
            { label: "Development", value: "development" },
            { label: "Alpha", value: "alpha" },
            { label: "Beta", value: "beta" },
            { label: "Mainnet", value: "mainnet" },
          ],
        }),
        developer: fields.relationship({
          label: "Developer",
          collection: "studios",
        }),
        genres: fields.array(fields.text({ label: "Genre" }), {
          label: "Genres",
        }),

        whitepaper: fields.text({ label: "Whitepaper URL" }),
        description: fields.text({ label: "Description" }),
        content: fields.markdoc({ label: "Content" }),
        operatingSystems: fields.array(fields.text({ label: "OS" }), {
          label: "Operating Systems",
        }),
        lords: fields.text({
          label: "Lords Usage",
          description: "How the Lords Token is used in the game",
        }),
        chains: fields.array(fields.text({ label: "Chain ID" }), {
          label: "Chains",
        }),

        collections: fields.array(fields.text({ label: "Collection" }), {
          label: "Collections",
        }),
        tokens: fields.array(fields.text({ label: "Token" }), {
          label: "Tokens",
        }),
        icon: fields.image({
          label: "Icon",
          directory: "public/content/games",
        }),
        coverImage: fields.image({
          label: "Image",
          directory: "public/content/games",
        }),
        screenshots: fields.array(
          fields.image({
            label: "Screenshot",
            directory: "public/content/games",
          }),
          { label: "Screenshots" },
        ),
        links: fields.object(
          {
            homepage: fields.url({ label: "Website" }),
            discord: fields.url({ label: "Discord" }),
            twitter: fields.text({ label: "Twitter" }),
            telegram: fields.url({ label: "Telegram" }),
            github: fields.url({ label: "Github" }),
            mainnet: fields.url({ label: "Mainnet" }),
            testnet: fields.url({ label: "Testnet" }),
          },
          { label: "Links" },
        ),
        playable: fields.checkbox({ label: "Playable" }),
      },
    }),
    events: collection({
      label: "Events",
      slugField: "name",
      path: "content/events/*",
      format: { contentField: "content" },
      columns: ["name", "endDate"],
      schema: {
        name: fields.slug({
          name: { label: "Name" },
        }),
        description: fields.text({ label: "Description" }),
        startDate: fields.datetime({ label: "Start" }),
        endDate: fields.datetime({ label: "End" }),
        content: fields.markdoc({ label: "Content" }),
        image: fields.image({
          label: "Image",
          directory: "public/content/events",
        }),
        website: fields.url({ label: "Website" }),
        type: fields.multiselect({
          label: "Type",
          options: [
            { label: "Play", value: "play" },
            { label: "Watch", value: "watch" },
            { label: "Learn", value: "learn" },
            { label: "Banter", value: "banter" },
          ],
        }),
      },
    }),
    studios: collection({
      label: "Studios",
      slugField: "title",
      path: "content/studios/*",
      format: { contentField: "content" },
      columns: ["title", "description"],
      schema: {
        title: fields.slug({
          name: { label: "Title" },
        }),
        description: fields.text({ label: "Description" }),
        content: fields.markdoc({ label: "Content" }),
        links: fields.object(
          {
            homepage: fields.url({ label: "Website" }),
            discord: fields.url({ label: "Discord" }),
            twitter: fields.text({ label: "Twitter" }),
            telegram: fields.url({ label: "Telegram" }),
            github: fields.url({ label: "Github" }),
          },
          { label: "Links" },
        ),
        logo: fields.image({
          label: "Logo",
          directory: "public/content/studios",
        }),
        games: fields.array(
          fields.relationship({
            label: "Games",
            collection: "games",
          }),
          {
            label: "Games",
            itemLabel: (props) => props.value ?? "",
          },
        ),
      },
    }),
    blogs: collection({
      label: "Blogs",
      slugField: "title",
      path: "content/blogs/*",
      format: { contentField: "content" },
      previewUrl: `/preview/start?branch={branch}&to=/blogs/{slug}`,
      columns: ["title", "subtitle"],
      schema: {
        author: fields.text({ label: "Author" }),
        publishDate: fields.datetime({ label: "Published Date" }),
        title: fields.slug({ name: { label: "Title" } }),
        image: fields.image({
          label: "Banner Image",
          directory: "public/content/blogs",
        }),
        previewImage: fields.image({
          label: "Preview Image",
          directory: "public/content/blogs",
        }),
        subtitle: fields.text({ label: "Subtitle" }),
        content: fields.markdoc({
          label: "Content",
          options: {
            image: {
              directory: "public/content/blogs",
              publicPath: "/content/blogs",
            },
          },
        }),
      },
    }),
    collections: collection({
      label: "Collections",
      slugField: "title",
      path: "content/collections/*",
      format: { contentField: "content" },
      columns: ["title", "description"],
      schema: {
        title: fields.slug({
          name: { label: "Title" },
        }),
        description: fields.text({ label: "Description" }),
        content: fields.markdoc({ label: "Content" }),
        links: fields.object(
          {
            homepage: fields.url({ label: "Website" }),
            discord: fields.url({ label: "Discord" }),
            twitter: fields.text({ label: "Twitter" }),
            telegram: fields.url({ label: "Telegram" }),
            github: fields.url({ label: "Github" }),
          },
          { label: "Links" },
        ),
        logo: fields.image({
          label: "Logo",
          directory: "public/content/studios",
        }),
        games: fields.array(
          fields.relationship({
            label: "Games",
            collection: "games",
          }),
          {
            label: "Games",
            itemLabel: (props) => props.value,
          },
        ),
      },
    }),
  },
});